const EmailService = require('./emailService');
const SmsService = require('./smsService');
const WhatsAppService = require('./whatsappService');
const TrelloService = require('./trelloService');
const Template = require('../models/Template');
const Configuration = require('../models/Configuration');
const Log = require('../models/Log');

class NotificationService {
  constructor() {
    this.services = {
      email: EmailService,
      sms: SmsService,
      whatsapp: WhatsAppService,
      trello: TrelloService
    };
    this.isInitialized = false;
    this.config = null;
  }

  // Initialize notification service
  async initialize() {
    try {
      this.config = await Configuration.getCurrent();
      
      // Initialize all notification services
      const initPromises = Object.entries(this.services).map(async ([type, service]) => {
        try {
          if (service.initialize) {
            await service.initialize();
            console.log(`${type} service initialized`);
          }
        } catch (error) {
          console.error(`Failed to initialize ${type} service:`, error);
          // Don't throw here - allow other services to initialize
        }
      });

      await Promise.all(initPromises);
      
      this.isInitialized = true;
      console.log('Notification service initialized');
      
      await Log.logSystem({
        action: 'notification_service_initialized',
        message: 'Unified notification service has been initialized'
      });
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      throw error;
    }
  }

  // Send notification through specified channel
  async sendNotification(channel, data) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const service = this.services[channel];
      if (!service) {
        throw new Error(`Unsupported notification channel: ${channel}`);
      }

      // Check if channel is enabled
      if (!this.isChannelEnabled(channel)) {
        throw new Error(`${channel} notifications are disabled`);
      }

      let result;
      switch (channel) {
        case 'email':
          result = await service.sendEmail(data);
          break;
        case 'sms':
          result = await service.sendSms(data);
          break;
        case 'whatsapp':
          result = await service.sendWhatsApp(data);
          break;
        case 'trello':
          result = await service.postComment(data.cardId, data.text, data.memberIds);
          break;
        default:
          throw new Error(`No send method defined for channel: ${channel}`);
      }

      return result;
    } catch (error) {
      console.error(`Failed to send ${channel} notification:`, error);
      throw error;
    }
  }

  // Send card reminder through specified channel
  async sendCardReminder(card, user, channel, template = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const service = this.services[channel];
      if (!service) {
        throw new Error(`Unsupported notification channel: ${channel}`);
      }

      // Check if channel is enabled
      if (!this.isChannelEnabled(channel)) {
        throw new Error(`${channel} notifications are disabled`);
      }

      // Validate user has required contact information for the channel
      if (!this.validateUserContactInfo(user, channel)) {
        throw new Error(`User ${user.username} missing contact info for ${channel}`);
      }

      let result;
      switch (channel) {
        case 'email':
          result = await service.sendCardReminder(card, user, template);
          break;
        case 'sms':
          result = await service.sendCardReminder(card, user, template);
          break;
        case 'whatsapp':
          result = await service.sendCardReminder(card, user, template);
          break;
        case 'trello':
          result = await service.sendReminderComment(card, template);
          break;
        default:
          throw new Error(`No card reminder method defined for channel: ${channel}`);
      }

      return result;
    } catch (error) {
      console.error(`Failed to send ${channel} card reminder:`, error);
      throw error;
    }
  }

  // Send multi-channel reminder (escalation)
  async sendMultiChannelReminder(card, user, channels = ['email', 'sms']) {
    try {
      const results = [];
      const errors = [];

      for (const channel of channels) {
        try {
          if (this.isChannelEnabled(channel) && this.validateUserContactInfo(user, channel)) {
            const result = await this.sendCardReminder(card, user, channel);
            results.push({ channel, success: true, result });
          } else {
            results.push({ 
              channel, 
              success: false, 
              error: `Channel disabled or user missing contact info` 
            });
          }
        } catch (error) {
          console.error(`Failed to send ${channel} reminder:`, error);
          errors.push({ channel, error: error.message });
          results.push({ channel, success: false, error: error.message });
        }
      }

      // Log multi-channel reminder attempt
      await Log.logActivity({
        cardId: card.trelloId,
        cardName: card.name,
        userId: user.trelloId,
        username: user.username,
        action: 'multi_channel_reminder',
        message: `Multi-channel reminder sent via: ${channels.join(', ')}`,
        metadata: { results, errors }
      });

      return { results, errors };
    } catch (error) {
      console.error('Failed to send multi-channel reminder:', error);
      throw error;
    }
  }

  // Send bulk notifications
  async sendBulkNotifications(channel, notificationList) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const service = this.services[channel];
      if (!service) {
        throw new Error(`Unsupported notification channel: ${channel}`);
      }

      // Check if channel is enabled
      if (!this.isChannelEnabled(channel)) {
        throw new Error(`${channel} notifications are disabled`);
      }

      let result;
      switch (channel) {
        case 'email':
          result = await service.sendBulkEmails(notificationList);
          break;
        case 'sms':
          result = await service.sendBulkSms(notificationList);
          break;
        case 'whatsapp':
          result = await service.sendBulkWhatsApp(notificationList);
          break;
        default:
          throw new Error(`No bulk send method defined for channel: ${channel}`);
      }

      return result;
    } catch (error) {
      console.error(`Failed to send bulk ${channel} notifications:`, error);
      throw error;
    }
  }

  // Send system notification to administrators
  async sendSystemNotification(message, priority = 'normal', channels = ['email']) {
    try {
      const adminEmails = this.config.reporting.reportRecipients || [];
      const adminPhones = process.env.ADMIN_PHONE_NUMBERS ? 
        process.env.ADMIN_PHONE_NUMBERS.split(',') : [];

      const results = [];

      for (const channel of channels) {
        try {
          const service = this.services[channel];
          if (!service || !this.isChannelEnabled(channel)) {
            continue;
          }

          switch (channel) {
            case 'email':
              if (adminEmails.length > 0) {
                const result = await service.sendSystemNotification(
                  adminEmails, 
                  `System Notification`, 
                  message, 
                  priority
                );
                results.push({ channel, success: true, result });
              }
              break;
            case 'sms':
              if (adminPhones.length > 0) {
                for (const phone of adminPhones) {
                  const result = await service.sendSystemNotification(phone, message, priority);
                  results.push({ channel, success: true, result, recipient: phone });
                }
              }
              break;
            case 'whatsapp':
              if (adminPhones.length > 0) {
                for (const phone of adminPhones) {
                  const result = await service.sendSystemNotification(phone, message, priority);
                  results.push({ channel, success: true, result, recipient: phone });
                }
              }
              break;
          }
        } catch (error) {
          console.error(`Failed to send system notification via ${channel}:`, error);
          results.push({ channel, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to send system notification:', error);
      throw error;
    }
  }

  // Validate service configurations
  async validateAllConfigurations() {
    try {
      const validations = {};

      for (const [channel, service] of Object.entries(this.services)) {
        try {
          if (service.validateConfiguration) {
            validations[channel] = await service.validateConfiguration();
          } else {
            validations[channel] = { valid: true, message: 'No validation method available' };
          }
        } catch (error) {
          validations[channel] = { valid: false, error: error.message };
        }
      }

      return validations;
    } catch (error) {
      console.error('Failed to validate configurations:', error);
      throw error;
    }
  }

  // Check if notification channel is enabled
  isChannelEnabled(channel) {
    if (!this.config) return false;

    switch (channel) {
      case 'email':
        return this.config.notifications.email.enabled;
      case 'sms':
        return this.config.notifications.sms.enabled;
      case 'whatsapp':
        return this.config.notifications.whatsapp.enabled;
      case 'trello':
        return true; // Trello is always enabled if configured
      default:
        return false;
    }
  }

  // Validate user has required contact information for channel
  validateUserContactInfo(user, channel) {
    switch (channel) {
      case 'email':
        return user.email && user.email.trim() !== '';
      case 'sms':
      case 'whatsapp':
        return user.phone && user.phone.trim() !== '';
      case 'trello':
        return user.trelloId && user.trelloId.trim() !== '';
      default:
        return false;
    }
  }

  // Get notification statistics for all channels
  async getNotificationStats(startDate, endDate) {
    try {
      const stats = {};

      for (const [channel, service] of Object.entries(this.services)) {
        try {
          if (service.getStats || service.getEmailStats || service.getSmsStats || service.getWhatsAppStats) {
            switch (channel) {
              case 'email':
                stats[channel] = await service.getEmailStats(startDate, endDate);
                break;
              case 'sms':
                stats[channel] = await service.getSmsStats(startDate, endDate);
                break;
              case 'whatsapp':
                stats[channel] = await service.getWhatsAppStats(startDate, endDate);
                break;
              default:
                // For services without specific stats methods
                stats[channel] = { message: 'Stats not available' };
            }
          }
        } catch (error) {
          console.error(`Failed to get ${channel} stats:`, error);
          stats[channel] = { error: error.message };
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      throw error;
    }
  }

  // Get service status for all channels
  getServicesStatus() {
    const status = {};

    for (const [channel, service] of Object.entries(this.services)) {
      try {
        if (service.getStatus) {
          status[channel] = service.getStatus();
        } else {
          status[channel] = { available: true, message: 'Status method not available' };
        }
      } catch (error) {
        status[channel] = { available: false, error: error.message };
      }
    }

    return {
      isInitialized: this.isInitialized,
      services: status,
      enabledChannels: this.getEnabledChannels()
    };
  }

  // Get list of enabled channels
  getEnabledChannels() {
    const channels = ['email', 'sms', 'whatsapp', 'trello'];
    return channels.filter(channel => this.isChannelEnabled(channel));
  }

  // Handle webhook callbacks for delivery status
  async handleDeliveryWebhook(channel, webhookData) {
    try {
      const service = this.services[channel];
      if (service && service.handleStatusWebhook) {
        await service.handleStatusWebhook(webhookData);
      }
    } catch (error) {
      console.error(`Failed to handle ${channel} webhook:`, error);
    }
  }

  // Test notification sending
  async testNotification(channel, testData) {
    try {
      if (!this.isChannelEnabled(channel)) {
        throw new Error(`${channel} notifications are disabled`);
      }

      const service = this.services[channel];
      if (!service) {
        throw new Error(`Service not available for channel: ${channel}`);
      }

      // Prepare test data based on channel
      let result;
      switch (channel) {
        case 'email':
          result = await service.sendEmail({
            to: testData.recipient,
            subject: 'AutoReminder Test Email',
            text: 'This is a test email from AutoReminder system.',
            html: '<p>This is a test email from AutoReminder system.</p>'
          });
          break;
        case 'sms':
          result = await service.sendSms({
            to: testData.recipient,
            text: 'This is a test SMS from AutoReminder system.'
          });
          break;
        case 'whatsapp':
          result = await service.sendWhatsApp({
            to: testData.recipient,
            text: 'This is a test WhatsApp message from AutoReminder system.'
          });
          break;
        case 'trello':
          result = await service.postComment(
            testData.cardId,
            'This is a test comment from AutoReminder system.',
            testData.memberIds || []
          );
          break;
        default:
          throw new Error(`Test not implemented for channel: ${channel}`);
      }

      return { success: true, result };
    } catch (error) {
      console.error(`Test notification failed for ${channel}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();

