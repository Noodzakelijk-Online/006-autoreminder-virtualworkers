const sgMail = require('@sendgrid/mail');
const Log = require('../models/Log');
const Template = require('../models/Template');
const Configuration = require('../models/Configuration');

class EmailService {
  constructor() {
    this.isInitialized = false;
    this.config = null;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Initialize email service
  async initialize() {
    try {
      this.config = await Configuration.getCurrent();
      
      if (!process.env.SENDGRID_API_KEY) {
        throw new Error('SENDGRID_API_KEY environment variable is required');
      }

      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.isInitialized = true;
      
      console.log('Email service initialized with SendGrid');
      
      await Log.logSystem({
        action: 'email_service_initialized',
        message: 'Email service has been initialized with SendGrid'
      });
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  // Validate email configuration
  async validateConfiguration() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Test email sending capability
      const testEmail = {
        to: 'test@example.com',
        from: this.config.notifications.email.fromEmail,
        subject: 'Test Email Configuration',
        text: 'This is a test email to validate configuration.',
        mail_settings: {
          sandbox_mode: {
            enable: true
          }
        }
      };

      await sgMail.send(testEmail);
      
      return {
        valid: true,
        message: 'Email configuration is valid'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Send email with retry logic
  async sendEmail(emailData, retryCount = 0) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.config.notifications.email.enabled) {
        throw new Error('Email notifications are disabled');
      }

      // Prepare email message
      const msg = {
        to: emailData.to,
        from: {
          email: this.config.notifications.email.fromEmail,
          name: this.config.notifications.email.fromName
        },
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        ...emailData.customArgs && { custom_args: emailData.customArgs }
      };

      // Add tracking if enabled
      if (emailData.enableTracking !== false) {
        msg.tracking_settings = {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
          subscription_tracking: { enable: false }
        };
      }

      // Send email
      const response = await sgMail.send(msg);
      
      // Log successful send
      await Log.logNotification({
        cardId: emailData.cardId,
        cardName: emailData.cardName,
        cardUrl: emailData.cardUrl,
        userId: emailData.userId,
        username: emailData.username,
        userEmail: emailData.to,
        channel: 'email',
        status: 'success',
        message: `Email sent successfully to ${emailData.to}`,
        templateId: emailData.templateId,
        templateName: emailData.templateName,
        recipient: emailData.to,
        subject: emailData.subject,
        deliveryId: response[0].headers['x-message-id'],
        retryCount
      });

      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        response: response[0]
      };
    } catch (error) {
      console.error(`Email send error (attempt ${retryCount + 1}):`, error);

      // Retry logic
      if (retryCount < this.retryAttempts && this.shouldRetry(error)) {
        console.log(`Retrying email send in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return this.sendEmail(emailData, retryCount + 1);
      }

      // Log failed send
      await Log.logNotification({
        cardId: emailData.cardId,
        cardName: emailData.cardName,
        cardUrl: emailData.cardUrl,
        userId: emailData.userId,
        username: emailData.username,
        userEmail: emailData.to,
        channel: 'email',
        status: 'failure',
        message: `Failed to send email to ${emailData.to}: ${error.message}`,
        templateId: emailData.templateId,
        templateName: emailData.templateName,
        recipient: emailData.to,
        subject: emailData.subject,
        retryCount
      });

      throw error;
    }
  }

  // Send reminder email for a card
  async sendCardReminder(card, user, template = null) {
    try {
      // Get or create default template
      if (!template) {
        template = await Template.findOne({
          type: 'email',
          isActive: true,
          isDefault: true
        });
      }

      if (!template) {
        throw new Error('No email template found');
      }

      // Render template with card and user data
      const templateData = {
        username: user.username || user.fullName,
        cardName: card.name,
        cardUrl: card.url,
        dueDate: card.dueDate ? card.dueDate.toLocaleDateString() : 'No due date',
        currentDate: new Date().toLocaleDateString(),
        daysSinceLastUpdate: card.daysSinceLastActivity || 0,
        companyName: this.config.notifications.email.fromName,
        unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(user.email)}`
      };

      const rendered = template.render(templateData);

      // Prepare email data
      const emailData = {
        to: user.email,
        subject: rendered.subject,
        text: rendered.content,
        html: this.convertTextToHtml(rendered.content),
        cardId: card.trelloId,
        cardName: card.name,
        cardUrl: card.url,
        userId: user.trelloId,
        username: user.username,
        templateId: template._id,
        templateName: template.name,
        customArgs: {
          cardId: card.trelloId,
          userId: user.trelloId,
          reminderType: 'card_reminder'
        }
      };

      // Send email
      const result = await this.sendEmail(emailData);

      // Update template usage
      await template.incrementUsage();

      // Record reminder sent
      await card.recordReminderSent('email', template._id);

      return result;
    } catch (error) {
      console.error(`Failed to send card reminder email:`, error);
      throw error;
    }
  }

  // Send bulk emails
  async sendBulkEmails(emailList) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const results = [];
      const batchSize = 10; // SendGrid recommends batching

      for (let i = 0; i < emailList.length; i += batchSize) {
        const batch = emailList.slice(i, i + batchSize);
        const batchPromises = batch.map(emailData => 
          this.sendEmail(emailData).catch(error => ({
            success: false,
            error: error.message,
            recipient: emailData.to
          }))
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < emailList.length) {
          await this.delay(100);
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk email send error:', error);
      throw error;
    }
  }

  // Send system notification email
  async sendSystemNotification(to, subject, message, priority = 'normal') {
    try {
      const emailData = {
        to: Array.isArray(to) ? to : [to],
        subject: `[AutoReminder] ${subject}`,
        text: message,
        html: this.convertTextToHtml(message),
        customArgs: {
          type: 'system_notification',
          priority
        }
      };

      return await this.sendEmail(emailData);
    } catch (error) {
      console.error('Failed to send system notification:', error);
      throw error;
    }
  }

  // Send report email
  async sendReportEmail(recipients, report, attachments = []) {
    try {
      const subject = `AutoReminder ${report.reportType} Report - ${report.title}`;
      
      const message = `
Dear Administrator,

Please find attached the ${report.reportType} report for the period ${report.startDate.toLocaleDateString()} to ${report.endDate.toLocaleDateString()}.

Report Summary:
- Total Cards: ${report.metrics.totalCards}
- Response Rate: ${report.metrics.responseRate.toFixed(1)}%
- Average Response Time: ${report.metrics.avgResponseTime.toFixed(1)} hours
- Notifications Sent: ${Object.values(report.metrics.notificationsSent).reduce((sum, count) => sum + count, 0)}

You can view the full report in the AutoReminder dashboard.

Best regards,
AutoReminder System
      `;

      const emailData = {
        to: recipients,
        subject,
        text: message,
        html: this.convertTextToHtml(message),
        attachments,
        customArgs: {
          type: 'report',
          reportId: report._id.toString(),
          reportType: report.reportType
        }
      };

      return await this.sendEmail(emailData);
    } catch (error) {
      console.error('Failed to send report email:', error);
      throw error;
    }
  }

  // Convert plain text to basic HTML
  convertTextToHtml(text) {
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/<p><\/p>/g, '');
  }

  // Check if error should trigger a retry
  shouldRetry(error) {
    // Retry on temporary failures
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNABORTED'
    ];

    // Check for SendGrid specific retry conditions
    if (error.code) {
      // Rate limiting
      if (error.code === 429) return true;
      
      // Server errors
      if (error.code >= 500 && error.code < 600) return true;
    }

    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError) || error.code === retryableError
    );
  }

  // Delay utility
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get email statistics
  async getEmailStats(startDate, endDate) {
    try {
      const stats = await Log.aggregate([
        {
          $match: {
            type: 'notification',
            channel: 'email',
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
      console.error('Error getting email stats:', error);
      throw error;
    }
  }

  // Validate email address
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Get service status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      enabled: this.config?.notifications?.email?.enabled || false,
      provider: 'sendgrid',
      retryAttempts: this.retryAttempts
    };
  }
}

module.exports = new EmailService();

