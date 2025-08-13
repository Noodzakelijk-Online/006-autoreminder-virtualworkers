const TrelloService = require('./trelloService');
const Configuration = require('../models/Configuration');
const Card = require('../models/Card');
const Template = require('../models/Template');
const Log = require('../models/Log');

class MonitoringService {
  constructor() {
    this.isRunning = false;
    this.monitoringInterval = null;
    this.config = null;
  }

  // Initialize monitoring service
  async initialize() {
    try {
      this.config = await Configuration.getCurrent();
      console.log('Monitoring service initialized');
      
      await Log.logSystem({
        action: 'monitoring_service_initialized',
        message: 'Card monitoring service has been initialized'
      });
    } catch (error) {
      console.error('Failed to initialize monitoring service:', error);
      throw error;
    }
  }

  // Start continuous monitoring
  async startMonitoring(intervalMinutes = 30) {
    if (this.isRunning) {
      console.log('Monitoring service is already running');
      return;
    }

    try {
      this.isRunning = true;
      
      // Run initial check
      await this.performMonitoringCheck();
      
      // Set up interval for continuous monitoring
      this.monitoringInterval = setInterval(async () => {
        try {
          await this.performMonitoringCheck();
        } catch (error) {
          console.error('Error during monitoring check:', error);
          await Log.logError(error, {
            action: 'monitoring_check_failed',
            metadata: { intervalMinutes }
          });
        }
      }, intervalMinutes * 60 * 1000);

      console.log(`Monitoring service started with ${intervalMinutes} minute intervals`);
      
      await Log.logSystem({
        action: 'monitoring_service_started',
        message: `Card monitoring started with ${intervalMinutes} minute intervals`
      });
    } catch (error) {
      this.isRunning = false;
      console.error('Failed to start monitoring service:', error);
      throw error;
    }
  }

  // Stop monitoring
  async stopMonitoring() {
    if (!this.isRunning) {
      console.log('Monitoring service is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Monitoring service stopped');
    
    await Log.logSystem({
      action: 'monitoring_service_stopped',
      message: 'Card monitoring service has been stopped'
    });
  }

  // Perform a monitoring check
  async performMonitoringCheck() {
    try {
      console.log('Starting monitoring check...');
      
      // Refresh configuration
      this.config = await Configuration.getCurrent();
      
      // Sync cards from Trello
      const syncResults = await TrelloService.syncAllCards();
      console.log('Sync results:', syncResults);
      
      // Check for cards needing reminders
      await this.checkCardsForReminders();
      
      // Check for responses to previous reminders
      await this.checkForResponses();
      
      // Clean up old data if needed
      await this.performMaintenance();
      
      console.log('Monitoring check completed');
      
      await Log.logSystem({
        action: 'monitoring_check_completed',
        message: 'Monitoring check completed successfully',
        metadata: {
          syncResults,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error during monitoring check:', error);
      await Log.logError(error, {
        action: 'monitoring_check_error'
      });
      throw error;
    }
  }

  // Check cards for reminder needs
  async checkCardsForReminders() {
    try {
      const cardsNeedingReminders = await TrelloService.getCardsNeedingReminders(this.config);
      console.log(`Found ${cardsNeedingReminders.length} cards needing reminders`);
      
      for (const card of cardsNeedingReminders) {
        try {
          await this.processCardReminder(card);
        } catch (error) {
          console.error(`Error processing reminder for card ${card.trelloId}:`, error);
          await Log.logError(error, {
            action: 'process_card_reminder_failed',
            cardId: card.trelloId,
            cardName: card.name
          });
        }
      }
    } catch (error) {
      console.error('Error checking cards for reminders:', error);
      throw error;
    }
  }

  // Process reminder for a specific card
  async processCardReminder(card) {
    try {
      const reminderType = card.getNextReminderType();
      console.log(`Processing ${reminderType} reminder for card: ${card.name}`);
      
      // Get appropriate template
      const template = await Template.findOne({
        type: reminderType,
        isActive: true,
        isDefault: true
      });

      switch (reminderType) {
        case 'trello':
          await this.sendTrelloReminder(card, template);
          break;
        case 'email':
          await this.sendEmailReminder(card, template);
          break;
        case 'sms':
          await this.sendSmsReminder(card, template);
          break;
        case 'whatsapp':
          await this.sendWhatsAppReminder(card, template);
          break;
        default:
          console.warn(`Unknown reminder type: ${reminderType}`);
      }
    } catch (error) {
      console.error(`Error processing reminder for card ${card.trelloId}:`, error);
      throw error;
    }
  }

  // Send Trello comment reminder
  async sendTrelloReminder(card, template) {
    try {
      await TrelloService.sendReminderComment(card, template);
      console.log(`Trello reminder sent for card: ${card.name}`);
    } catch (error) {
      console.error(`Failed to send Trello reminder for card ${card.trelloId}:`, error);
      throw error;
    }
  }

  // Send email reminder (placeholder - will be implemented in notification service)
  async sendEmailReminder(card, template) {
    try {
      // This will be implemented when we create the notification service
      console.log(`Email reminder needed for card: ${card.name}`);
      
      // For now, just record that we need to send an email
      await Log.logActivity({
        cardId: card.trelloId,
        cardName: card.name,
        action: 'email_reminder_queued',
        message: `Email reminder queued for card: ${card.name}`
      });
    } catch (error) {
      console.error(`Failed to queue email reminder for card ${card.trelloId}:`, error);
      throw error;
    }
  }

  // Send SMS reminder (placeholder - will be implemented in notification service)
  async sendSmsReminder(card, template) {
    try {
      // This will be implemented when we create the notification service
      console.log(`SMS reminder needed for card: ${card.name}`);
      
      // For now, just record that we need to send an SMS
      await Log.logActivity({
        cardId: card.trelloId,
        cardName: card.name,
        action: 'sms_reminder_queued',
        message: `SMS reminder queued for card: ${card.name}`
      });
    } catch (error) {
      console.error(`Failed to queue SMS reminder for card ${card.trelloId}:`, error);
      throw error;
    }
  }

  // Send WhatsApp reminder (placeholder - will be implemented in notification service)
  async sendWhatsAppReminder(card, template) {
    try {
      // This will be implemented when we create the notification service
      console.log(`WhatsApp reminder needed for card: ${card.name}`);
      
      // For now, just record that we need to send a WhatsApp message
      await Log.logActivity({
        cardId: card.trelloId,
        cardName: card.name,
        action: 'whatsapp_reminder_queued',
        message: `WhatsApp reminder queued for card: ${card.name}`
      });
    } catch (error) {
      console.error(`Failed to queue WhatsApp reminder for card ${card.trelloId}:`, error);
      throw error;
    }
  }

  // Check for responses to previous reminders
  async checkForResponses() {
    try {
      // Get cards that are waiting for responses
      const cardsWaitingForResponse = await Card.find({
        isActive: true,
        'reminderStatus.hasResponse': false,
        'reminderStatus.lastReminderDate': { $exists: true }
      });

      console.log(`Checking ${cardsWaitingForResponse.length} cards for responses`);

      for (const card of cardsWaitingForResponse) {
        try {
          await this.checkCardForResponse(card);
        } catch (error) {
          console.error(`Error checking response for card ${card.trelloId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking for responses:', error);
      throw error;
    }
  }

  // Check if a specific card has received a response
  async checkCardForResponse(card) {
    try {
      // Check for activity since last reminder
      if (card.reminderStatus.lastReminderDate) {
        const activity = await TrelloService.getCardActivitySince(
          card.trelloId,
          card.reminderStatus.lastReminderDate
        );

        // Filter out activity from excluded members
        const relevantActivity = activity.filter(action => 
          action.idMemberCreator !== TrelloService.excludedMemberId
        );

        if (relevantActivity.length > 0) {
          // Found response - update card status
          await card.recordResponse(new Date(relevantActivity[0].date));
          
          console.log(`Response detected for card: ${card.name}`);
          
          await Log.logActivity({
            cardId: card.trelloId,
            cardName: card.name,
            action: 'response_detected',
            message: `Response detected for card: ${card.name}`,
            metadata: {
              activityCount: relevantActivity.length,
              latestActivity: relevantActivity[0]
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error checking response for card ${card.trelloId}:`, error);
      throw error;
    }
  }

  // Perform maintenance tasks
  async performMaintenance() {
    try {
      // Clean up old logs (optional)
      // await this.cleanupOldLogs();
      
      // Update card statistics
      await this.updateCardStatistics();
      
      console.log('Maintenance tasks completed');
    } catch (error) {
      console.error('Error during maintenance:', error);
    }
  }

  // Update card statistics
  async updateCardStatistics() {
    try {
      // This could include updating response rates, average response times, etc.
      const stats = await Card.getStats();
      
      await Log.logSystem({
        action: 'card_statistics_updated',
        message: 'Card statistics have been updated',
        metadata: stats
      });
    } catch (error) {
      console.error('Error updating card statistics:', error);
    }
  }

  // Get monitoring status
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: !!this.monitoringInterval,
      configLoaded: !!this.config,
      lastCheck: this.lastCheckTime || null
    };
  }

  // Manual trigger for monitoring check
  async triggerManualCheck() {
    try {
      console.log('Manual monitoring check triggered');
      await this.performMonitoringCheck();
      return { success: true, message: 'Manual check completed successfully' };
    } catch (error) {
      console.error('Manual monitoring check failed:', error);
      return { success: false, message: error.message };
    }
  }

  // Get cards summary
  async getCardsSummary() {
    try {
      const totalCards = await Card.countDocuments({ isActive: true });
      const cardsWithResponse = await Card.countDocuments({ 
        isActive: true, 
        'reminderStatus.hasResponse': true 
      });
      const cardsNeedingReminders = await Card.countDocuments({
        isActive: true,
        'reminderStatus.hasResponse': false
      });
      const overdueCards = await Card.countDocuments({
        isActive: true,
        dueDate: { $lt: new Date() }
      });

      return {
        totalCards,
        cardsWithResponse,
        cardsNeedingReminders,
        overdueCards,
        responseRate: totalCards > 0 ? (cardsWithResponse / totalCards) * 100 : 0
      };
    } catch (error) {
      console.error('Error getting cards summary:', error);
      throw error;
    }
  }
}

module.exports = new MonitoringService();

