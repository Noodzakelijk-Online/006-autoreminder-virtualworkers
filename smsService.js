const twilio = require('twilio');
const Log = require('../models/Log');
const Template = require('../models/Template');
const Configuration = require('../models/Configuration');

class SmsService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.config = null;
    this.retryAttempts = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  // Initialize SMS service
  async initialize() {
    try {
      this.config = await Configuration.getCurrent();
      
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required');
      }

      if (!process.env.TWILIO_PHONE_NUMBER) {
        throw new Error('TWILIO_PHONE_NUMBER environment variable is required');
      }

      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
      this.isInitialized = true;
      
      console.log('SMS service initialized with Twilio');
      
      await Log.logSystem({
        action: 'sms_service_initialized',
        message: 'SMS service has been initialized with Twilio'
      });
    } catch (error) {
      console.error('Failed to initialize SMS service:', error);
      throw error;
    }
  }

  // Validate SMS configuration
  async validateConfiguration() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Test by getting account information
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      
      // Validate phone number format
      const phoneNumber = await this.client.lookups.v1
        .phoneNumbers(this.fromNumber)
        .fetch();

      return {
        valid: true,
        message: 'SMS configuration is valid',
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

  // Send SMS with retry logic
  async sendSms(smsData, retryCount = 0) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.config.notifications.sms.enabled) {
        throw new Error('SMS notifications are disabled');
      }

      // Validate phone number format
      const formattedNumber = this.formatPhoneNumber(smsData.to);
      if (!formattedNumber) {
        throw new Error(`Invalid phone number format: ${smsData.to}`);
      }

      // Prepare SMS message
      const messageData = {
        body: smsData.text,
        from: this.fromNumber,
        to: formattedNumber
      };

      // Add status callback if provided
      if (smsData.statusCallback) {
        messageData.statusCallback = smsData.statusCallback;
      }

      // Send SMS
      const message = await this.client.messages.create(messageData);
      
      // Log successful send
      await Log.logNotification({
        cardId: smsData.cardId,
        cardName: smsData.cardName,
        cardUrl: smsData.cardUrl,
        userId: smsData.userId,
        username: smsData.username,
        userEmail: smsData.userEmail,
        channel: 'sms',
        status: 'success',
        message: `SMS sent successfully to ${formattedNumber}`,
        templateId: smsData.templateId,
        templateName: smsData.templateName,
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
      console.error(`SMS send error (attempt ${retryCount + 1}):`, error);

      // Retry logic
      if (retryCount < this.retryAttempts && this.shouldRetry(error)) {
        console.log(`Retrying SMS send in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return this.sendSms(smsData, retryCount + 1);
      }

      // Log failed send
      await Log.logNotification({
        cardId: smsData.cardId,
        cardName: smsData.cardName,
        cardUrl: smsData.cardUrl,
        userId: smsData.userId,
        username: smsData.username,
        userEmail: smsData.userEmail,
        channel: 'sms',
        status: 'failure',
        message: `Failed to send SMS to ${smsData.to}: ${error.message}`,
        templateId: smsData.templateId,
        templateName: smsData.templateName,
        recipient: smsData.to,
        retryCount
      });

      throw error;
    }
  }

  // Send reminder SMS for a card
  async sendCardReminder(card, user, template = null) {
    try {
      // Get or create default template
      if (!template) {
        template = await Template.findOne({
          type: 'sms',
          isActive: true,
          isDefault: true
        });
      }

      if (!template) {
        throw new Error('No SMS template found');
      }

      // Render template with card and user data
      const templateData = {
        username: user.username || user.fullName,
        cardName: card.name,
        cardUrl: card.shortUrl || card.url, // Use short URL for SMS
        dueDate: card.dueDate ? card.dueDate.toLocaleDateString() : 'No due date',
        currentDate: new Date().toLocaleDateString(),
        daysSinceLastUpdate: card.daysSinceLastActivity || 0
      };

      const rendered = template.render(templateData);

      // Prepare SMS data
      const smsData = {
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
        statusCallback: `${process.env.API_BASE_URL}/api/notifications/sms/status`
      };

      // Send SMS
      const result = await this.sendSms(smsData);

      // Update template usage
      await template.incrementUsage();

      // Record reminder sent
      await card.recordReminderSent('sms', template._id);

      return result;
    } catch (error) {
      console.error(`Failed to send card reminder SMS:`, error);
      throw error;
    }
  }

  // Send bulk SMS messages
  async sendBulkSms(smsList) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const results = [];
      const batchSize = 5; // Smaller batch size for SMS to avoid rate limiting

      for (let i = 0; i < smsList.length; i += batchSize) {
        const batch = smsList.slice(i, i + batchSize);
        const batchPromises = batch.map(smsData => 
          this.sendSms(smsData).catch(error => ({
            success: false,
            error: error.message,
            recipient: smsData.to
          }))
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Delay between batches to respect rate limits
        if (i + batchSize < smsList.length) {
          await this.delay(1000); // 1 second delay
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk SMS send error:', error);
      throw error;
    }
  }

  // Send system notification SMS
  async sendSystemNotification(to, message, priority = 'normal') {
    try {
      const smsData = {
        to: to,
        text: `[AutoReminder] ${message}`,
        statusCallback: `${process.env.API_BASE_URL}/api/notifications/sms/status`
      };

      return await this.sendSms(smsData);
    } catch (error) {
      console.error('Failed to send system notification SMS:', error);
      throw error;
    }
  }

  // Format phone number to E.164 format
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;

    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Handle different formats
    if (cleaned.length === 10) {
      // US number without country code
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      // US number with country code
      return `+${cleaned}`;
    } else if (cleaned.length > 11) {
      // International number
      return `+${cleaned}`;
    }

    return null;
  }

  // Validate phone number
  async validatePhoneNumber(phoneNumber) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      if (!formattedNumber) {
        return { valid: false, error: 'Invalid phone number format' };
      }

      const lookup = await this.client.lookups.v1
        .phoneNumbers(formattedNumber)
        .fetch();

      return {
        valid: true,
        phoneNumber: lookup.phoneNumber,
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
      console.error('Error getting message status:', error);
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

      console.log(`SMS status updated: ${MessageSid} - ${MessageStatus}`);
    } catch (error) {
      console.error('Error handling SMS status webhook:', error);
    }
  }

  // Check if error should trigger a retry
  shouldRetry(error) {
    // Don't retry on permanent failures
    const permanentErrors = [
      21211, // Invalid 'To' Phone Number
      21612, // The 'To' phone number is not currently reachable
      21614, // 'To' number is not a valid mobile number
      30007, // Message delivery - Carrier violation
      30008, // Message delivery - Unknown error
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

  // Get SMS statistics
  async getSmsStats(startDate, endDate) {
    try {
      const stats = await Log.aggregate([
        {
          $match: {
            type: 'notification',
            channel: 'sms',
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
      console.error('Error getting SMS stats:', error);
      throw error;
    }
  }

  // Get service status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      enabled: this.config?.notifications?.sms?.enabled || false,
      provider: 'twilio',
      retryAttempts: this.retryAttempts,
      fromNumber: this.fromNumber
    };
  }
}

module.exports = new SmsService();

