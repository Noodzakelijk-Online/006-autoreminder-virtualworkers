const twilio = require('twilio');
const Log = require('../models/Log');
const Template = require('../models/Template');
const Configuration = require('../models/Configuration');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.config = null;
    this.retryAttempts = 3;
    this.retryDelay = 3000; // 3 seconds
  }

  // Initialize WhatsApp service
  async initialize() {
    try {
      this.config = await Configuration.getCurrent();
      
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required');
      }

      if (!process.env.TWILIO_WHATSAPP_NUMBER) {
        throw new Error('TWILIO_WHATSAPP_NUMBER environment variable is required');
      }

      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
      this.isInitialized = true;
      
      console.log('WhatsApp service initialized with Twilio');
      
      await Log.logSystem({
        action: 'whatsapp_service_initialized',
        message: 'WhatsApp service has been initialized with Twilio'
      });
    } catch (error) {
      console.error('Failed to initialize WhatsApp service:', error);
      throw error;
    }
  }

  // Validate WhatsApp configuration
  async validateConfiguration() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Test by getting account information
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      
      // Validate WhatsApp number format
      const phoneNumber = await this.client.lookups.v1
        .phoneNumbers(this.fromNumber)
        .fetch();

      return {
        valid: true,
        message: 'WhatsApp configuration is valid',
        account: {
          sid: account.sid,
          friendlyName: account.friendlyName,
          status: account.status
        },
        phoneNumber: {
          number: phoneNumber.phoneNumber,
          countryCode: phoneNumber.countryCode,
          nationalFormat: phoneNumber.nationalFormat
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Send WhatsApp message with retry logic
  async sendWhatsApp(whatsappData, retryCount = 0) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.config.notifications.whatsapp.enabled) {
        throw new Error('WhatsApp notifications are disabled');
      }

      // Validate phone number format
      const formattedNumber = this.formatWhatsAppNumber(whatsappData.to);
      if (!formattedNumber) {
        throw new Error(`Invalid WhatsApp number format: ${whatsappData.to}`);
      }

      // Prepare WhatsApp message
      const messageData = {
        body: whatsappData.text,
        from: this.fromNumber,
        to: formattedNumber
      };

      // Add media if provided
      if (whatsappData.mediaUrl) {
        messageData.mediaUrl = whatsappData.mediaUrl;
      }

      // Add status callback if provided
      if (whatsappData.statusCallback) {
        messageData.statusCallback = whatsappData.statusCallback;
      }

      // Send WhatsApp message
      const message = await this.client.messages.create(messageData);
      
      // Log successful send
      await Log.logNotification({
        cardId: whatsappData.cardId,
        cardName: whatsappData.cardName,
        cardUrl: whatsappData.cardUrl,
        userId: whatsappData.userId,
        username: whatsappData.username,
        userEmail: whatsappData.userEmail,
        channel: 'whatsapp',
        status: 'success',
        message: `WhatsApp message sent successfully to ${formattedNumber}`,
        templateId: whatsappData.templateId,
        templateName: whatsappData.templateName,
        recipient: formattedNumber,
        deliveryId: message.sid,
        retryCount
      });

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from
      };
    } catch (error) {
      console.error(`WhatsApp send error (attempt ${retryCount + 1}):`, error);

      // Retry logic
      if (retryCount < this.retryAttempts && this.shouldRetry(error)) {
        console.log(`Retrying WhatsApp send in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return this.sendWhatsApp(whatsappData, retryCount + 1);
      }

      // Log failed send
      await Log.logNotification({
        cardId: whatsappData.cardId,
        cardName: whatsappData.cardName,
        cardUrl: whatsappData.cardUrl,
        userId: whatsappData.userId,
        username: whatsappData.username,
        userEmail: whatsappData.userEmail,
        channel: 'whatsapp',
        status: 'failure',
        message: `Failed to send WhatsApp message to ${whatsappData.to}: ${error.message}`,
        templateId: whatsappData.templateId,
        templateName: whatsappData.templateName,
        recipient: whatsappData.to,
        retryCount
      });

      throw error;
    }
  }

  // Send reminder WhatsApp message for a card
  async sendCardReminder(card, user, template = null) {
    try {
      // Get or create default template
      if (!template) {
        template = await Template.findOne({
          type: 'whatsapp',
          isActive: true,
          isDefault: true
        });
      }

      if (!template) {
        throw new Error('No WhatsApp template found');
      }

      // Render template with card and user data
      const templateData = {
        username: user.username || user.fullName,
        cardName: card.name,
        cardUrl: card.shortUrl || card.url, // Use short URL for WhatsApp
        dueDate: card.dueDate ? card.dueDate.toLocaleDateString() : 'No due date',
        currentDate: new Date().toLocaleDateString(),
        daysSinceLastUpdate: card.daysSinceLastActivity || 0,
        companyName: this.config.notifications.email.fromName
      };

      const rendered = template.render(templateData);

      // Prepare WhatsApp data
      const whatsappData = {
        to: user.phone,
        text: rendered.content,
        cardId: card.trelloId,
        cardName: card.name,
        cardUrl: card.url,
        userId: user.trelloId,
        username: user.username,
        userEmail: user.email,
        templateId: template._id,
        templateName: template.name,
        statusCallback: `${process.env.API_BASE_URL}/api/notifications/whatsapp/status`
      };

      // Send WhatsApp message
      const result = await this.sendWhatsApp(whatsappData);

      // Update template usage
      await template.incrementUsage();

      // Record reminder sent
      await card.recordReminderSent('whatsapp', template._id);

      return result;
    } catch (error) {
      console.error(`Failed to send card reminder WhatsApp:`, error);
      throw error;
    }
  }

  // Send bulk WhatsApp messages
  async sendBulkWhatsApp(whatsappList) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const results = [];
      const batchSize = 3; // Very small batch size for WhatsApp to avoid rate limiting

      for (let i = 0; i < whatsappList.length; i += batchSize) {
        const batch = whatsappList.slice(i, i + batchSize);
        const batchPromises = batch.map(whatsappData => 
          this.sendWhatsApp(whatsappData).catch(error => ({
            success: false,
            error: error.message,
            recipient: whatsappData.to
          }))
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Longer delay between batches for WhatsApp
        if (i + batchSize < whatsappList.length) {
          await this.delay(2000); // 2 second delay
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk WhatsApp send error:', error);
      throw error;
    }
  }

  // Send system notification WhatsApp
  async sendSystemNotification(to, message, priority = 'normal') {
    try {
      const whatsappData = {
        to: to,
        text: `🤖 *AutoReminder System*\n\n${message}`,
        statusCallback: `${process.env.API_BASE_URL}/api/notifications/whatsapp/status`
      };

      return await this.sendWhatsApp(whatsappData);
    } catch (error) {
      console.error('Failed to send system notification WhatsApp:', error);
      throw error;
    }
  }

  // Format phone number for WhatsApp (must include whatsapp: prefix)
  formatWhatsAppNumber(phoneNumber) {
    if (!phoneNumber) return null;

    // Remove whatsapp: prefix if already present
    let cleaned = phoneNumber.replace(/^whatsapp:/, '');
    
    // Remove all non-digit characters
    cleaned = cleaned.replace(/\D/g, '');

    // Handle different formats
    let formatted;
    if (cleaned.length === 10) {
      // US number without country code
      formatted = `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      // US number with country code
      formatted = `+${cleaned}`;
    } else if (cleaned.length > 11) {
      // International number
      formatted = `+${cleaned}`;
    } else {
      return null;
    }

    return `whatsapp:${formatted}`;
  }

  // Validate WhatsApp number
  async validateWhatsAppNumber(phoneNumber) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const formattedNumber = this.formatWhatsAppNumber(phoneNumber);
      if (!formattedNumber) {
        return { valid: false, error: 'Invalid WhatsApp number format' };
      }

      // Remove whatsapp: prefix for lookup
      const lookupNumber = formattedNumber.replace(/^whatsapp:/, '');
      
      const lookup = await this.client.lookups.v1
        .phoneNumbers(lookupNumber)
        .fetch();

      return {
        valid: true,
        phoneNumber: formattedNumber,
        countryCode: lookup.countryCode,
        nationalFormat: lookup.nationalFormat
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Get message status
  async getMessageStatus(messageSid) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const message = await this.client.messages(messageSid).fetch();
      
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated
      };
    } catch (error) {
      console.error('Error getting WhatsApp message status:', error);
      throw error;
    }
  }

  // Handle status webhook
  async handleStatusWebhook(webhookData) {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = webhookData;

      // Update log entry with delivery status
      await Log.updateOne(
        { 'notification.deliveryId': MessageSid },
        {
          $set: {
            'notification.deliveryStatus': MessageStatus,
            'notification.deliveredAt': MessageStatus === 'delivered' ? new Date() : null,
            'notification.errorCode': ErrorCode,
            'notification.errorMessage': ErrorMessage
          }
        }
      );

      console.log(`WhatsApp status updated: ${MessageSid} - ${MessageStatus}`);
    } catch (error) {
      console.error('Error handling WhatsApp status webhook:', error);
    }
  }

  // Send WhatsApp template message (for approved templates)
  async sendTemplateMessage(to, templateSid, templateData = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const formattedNumber = this.formatWhatsAppNumber(to);
      if (!formattedNumber) {
        throw new Error(`Invalid WhatsApp number format: ${to}`);
      }

      const messageData = {
        from: this.fromNumber,
        to: formattedNumber,
        contentSid: templateSid,
        contentVariables: JSON.stringify(templateData)
      };

      const message = await this.client.messages.create(messageData);
      
      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from
      };
    } catch (error) {
      console.error('Failed to send WhatsApp template message:', error);
      throw error;
    }
  }

  // Check if error should trigger a retry
  shouldRetry(error) {
    // Don't retry on permanent failures
    const permanentErrors = [
      63016, // The destination phone number is not a WhatsApp number
      63017, // The destination phone number has not accepted the WhatsApp Terms of Service
      63018, // The destination phone number is not reachable
    ];

    if (error.code && permanentErrors.includes(error.code)) {
      return false;
    }

    // Retry on temporary failures
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNABORTED'
    ];

    // Check for Twilio specific retry conditions
    if (error.status) {
      // Rate limiting
      if (error.status === 429) return true;
      
      // Server errors
      if (error.status >= 500 && error.status < 600) return true;
    }

    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError)
    );
  }

  // Delay utility
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get WhatsApp statistics
  async getWhatsAppStats(startDate, endDate) {
    try {
      const stats = await Log.aggregate([
        {
          $match: {
            type: 'notification',
            channel: 'whatsapp',
            createdAt: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: null,
            totalSent: { $sum: 1 },
            successful: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] }
            },
            avgRetryCount: { $avg: '$notification.retryCount' }
          }
        }
      ]);

      return stats.length > 0 ? stats[0] : {
        totalSent: 0,
        successful: 0,
        failed: 0,
        avgRetryCount: 0
      };
    } catch (error) {
      console.error('Error getting WhatsApp stats:', error);
      throw error;
    }
  }

  // Get service status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      enabled: this.config?.notifications?.whatsapp?.enabled || false,
      provider: 'twilio',
      retryAttempts: this.retryAttempts,
      fromNumber: this.fromNumber
    };
  }
}

module.exports = new WhatsAppService();

