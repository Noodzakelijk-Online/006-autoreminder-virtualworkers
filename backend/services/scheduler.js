const cron = require('node-cron');
const { CRON_TIMES, TIMEZONE } = require('../config/env');
const Configuration = require('../models/Configuration');
const Card = require('../models/Card');
const trelloService = require('./trello');
const notificationService = require('./notifications');
const logger = require('../utils/logger');
const Log = require('../models/Log');
const Report = require('../models/Report');

/**
 * Scheduler Service - Manages all scheduled jobs for reminders
 */
class SchedulerService {
  constructor() {
    this.jobs = {};
    this.botMemberId = "59b3208fbd9a6b2be8b0a436"; // Bot's Trello member ID
  }

  /**
   * Initialize all scheduled jobs
   */
  async initialize() {
    try {
      // Get configuration from database or create default
      let config = await Configuration.findOne({});
      if (!config) {
        config = await Configuration.create({});
        logger.log('info', 'Created default configuration');
      }

      // Initialize jobs
      this.initializeDay0CommentJob(config);
      this.initializeDay1EmailJob(config);
      this.initializeDay2SmsJob(config);
      this.initializeDailyReportJob();
      this.initializeWeeklyReportJob();

      logger.log('info', 'All scheduled jobs initialized');
    } catch (error) {
      logger.log('error', `Error initializing scheduler: ${error.message}`);
    }
  }

  /**
   * Check if today is a weekend day
   * @param {Array<Number>} weekendDays - Array of weekend day numbers (0-6, where 0 is Sunday)
   * @returns {Boolean} - True if today is a weekend day
   */
  isWeekend(weekendDays) {
    const today = new Date().getDay();
    return weekendDays.includes(today);
  }

  /**
   * Initialize Day 0 comment job (18:30 Amsterdam Time)
   * @param {Object} config - Configuration object
   */
  initializeDay0CommentJob(config) {
    this.jobs.day0Comment = cron.schedule(
      CRON_TIMES.COMMENT_TIME,
      async () => {
        try {
          // Skip if weekend and no override
          if (this.isWeekend(config.weekendDays) && !config.allowUrgentOverride) {
            logger.log('info', 'Skipping Day 0 comment job due to weekend');
            return;
          }

          logger.log('info', 'Running Day 0 comment job');

          // Get all boards
          const boards = await trelloService.getBoards();
          
          // Sync cards from all boards
          const boardIds = boards.map(board => board.id);
          await trelloService.syncCards(boardIds);
          
          // Get cards that need reminders
          const cards = await Card.find({
            'reminderStatus.hasResponse': false,
            'reminderStatus.reminderCount': 0
          });
          
          logger.log('info', `Found ${cards.length} cards needing Day 0 comments`);
          
          // Process each card
          for (const card of cards) {
            try {
              // Skip cards with no assigned users
              if (!card.assignedUsers || card.assignedUsers.length === 0) {
                continue;
              }
              
              // Post comment on Trello
              await trelloService.postComment(card.trelloId, card.assignedUsers);
              
              // Update card reminder status
              card.reminderStatus.lastReminderDate = new Date();
              card.reminderStatus.lastReminderType = 'trello';
              card.reminderStatus.reminderCount = 1;
              await card.save();
              
              // Log the action
              await Log.create({
                type: 'notification',
                cardId: card.trelloId,
                cardName: card.name,
                action: 'comment_posted',
                channel: 'trello',
                status: 'success',
                message: `Day 0 comment posted for card ${card.name}`
              });
            } catch (error) {
              logger.log('error', `Error processing card ${card.name}: ${error.message}`);
              
              // Log the error
              await Log.create({
                type: 'error',
                cardId: card.trelloId,
                cardName: card.name,
                action: 'comment_posted',
                channel: 'trello',
                status: 'failure',
                message: `Error posting Day 0 comment: ${error.message}`
              });
            }
          }
          
          logger.log('info', 'Day 0 comment job completed');
        } catch (error) {
          logger.log('error', `Error in Day 0 comment job: ${error.message}`);
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE
      }
    );
    
    logger.log('info', 'Day 0 comment job scheduled');
  }

  /**
   * Initialize Day 1 email job (18:00 Amsterdam Time)
   * @param {Object} config - Configuration object
   */
  initializeDay1EmailJob(config) {
    this.jobs.day1Email = cron.schedule(
      CRON_TIMES.EMAIL_TIME,
      async () => {
        try {
          // Skip if weekend and no override
          if (this.isWeekend(config.weekendDays) && !config.allowUrgentOverride) {
            logger.log('info', 'Skipping Day 1 email job due to weekend');
            return;
          }

          logger.log('info', 'Running Day 1 email job');

          // Get cards that need email reminders (reminder count = 1, no response)
          const cards = await Card.find({
            'reminderStatus.hasResponse': false,
            'reminderStatus.reminderCount': 1
          });
          
          logger.log('info', `Found ${cards.length} cards needing Day 1 emails`);
          
          // Process each card
          for (const card of cards) {
            try {
              // Check if there's been activity on the card since last reminder
              const lastReminderDate = card.reminderStatus.lastReminderDate;
              const hasActivity = await trelloService.hasCardActivity(
                card.trelloId, 
                lastReminderDate, 
                this.botMemberId
              );
              
              // If there's been activity, mark as responded
              if (hasActivity) {
                card.reminderStatus.hasResponse = true;
                card.reminderStatus.responseDate = new Date();
                await card.save();
                
                // Log the activity
                await Log.create({
                  type: 'activity',
                  cardId: card.trelloId,
                  cardName: card.name,
                  action: 'response_detected',
                  status: 'success',
                  message: `Response detected for card ${card.name}`
                });
                
                continue;
              }
              
              // Skip cards with no assigned users or no emails
              const usersWithEmail = card.assignedUsers.filter(user => user.email);
              if (usersWithEmail.length === 0) {
                continue;
              }
              
              // Send emails
              await notificationService.sendBulkEmails(usersWithEmail, card);
              
              // Update card reminder status
              card.reminderStatus.lastReminderDate = new Date();
              card.reminderStatus.lastReminderType = 'email';
              card.reminderStatus.reminderCount = 2;
              await card.save();
            } catch (error) {
              logger.log('error', `Error processing card ${card.name}: ${error.message}`);
              
              // Log the error
              await Log.create({
                type: 'error',
                cardId: card.trelloId,
                cardName: card.name,
                action: 'email_sent',
                channel: 'email',
                status: 'failure',
                message: `Error sending Day 1 emails: ${error.message}`
              });
            }
          }
          
          logger.log('info', 'Day 1 email job completed');
        } catch (error) {
          logger.log('error', `Error in Day 1 email job: ${error.message}`);
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE
      }
    );
    
    logger.log('info', 'Day 1 email job scheduled');
  }

  /**
   * Initialize Day 2 SMS job (12:00 Amsterdam Time)
   * @param {Object} config - Configuration object
   */
  initializeDay2SmsJob(config) {
    this.jobs.day2Sms = cron.schedule(
      CRON_TIMES.SMS_TIME,
      async () => {
        try {
          // Skip if weekend and no override
          if (this.isWeekend(config.weekendDays) && !config.allowUrgentOverride) {
            logger.log('info', 'Skipping Day 2 SMS job due to weekend');
            return;
          }

          logger.log('info', 'Running Day 2 SMS job');

          // Get cards that need SMS reminders (reminder count = 2, no response)
          const cards = await Card.find({
            'reminderStatus.hasResponse': false,
            'reminderStatus.reminderCount': 2
          });
          
          logger.log('info', `Found ${cards.length} cards needing Day 2 SMS`);
          
          // Process each card
          for (const card of cards) {
            try {
              // Check if there's been activity on the card since last reminder
              const lastReminderDate = card.reminderStatus.lastReminderDate;
              const hasActivity = await trelloService.hasCardActivity(
                card.trelloId, 
                lastReminderDate, 
                this.botMemberId
              );
              
              // If there's been activity, mark as responded
              if (hasActivity) {
                card.reminderStatus.hasResponse = true;
                card.reminderStatus.responseDate = new Date();
                await card.save();
                
                // Log the activity
                await Log.create({
                  type: 'activity',
                  cardId: card.trelloId,
                  cardName: card.name,
                  action: 'response_detected',
                  status: 'success',
                  message: `Response detected for card ${card.name}`
                });
                
                continue;
              }
              
              // Send emails and SMS to all users
              for (const user of card.assignedUsers) {
                // Send email regardless of phone availability
                if (user.email) {
                  await notificationService.sendEmail(user, card);
                }
                
                // Send SMS if phone is available
                if (user.phone) {
                  await notificationService.sendSMS(user, card);
                  
                  // Also try WhatsApp
                  try {
                    await notificationService.sendWhatsApp(user, card);
                  } catch (whatsappError) {
                    logger.log('warn', `WhatsApp failed, continuing: ${whatsappError.message}`);
                  }
                }
              }
              
              // Update card reminder status
              card.reminderStatus.lastReminderDate = new Date();
              card.reminderStatus.lastReminderType = 'sms';
              card.reminderStatus.reminderCount = 3;
              await card.save();
            } catch (error) {
              logger.log('error', `Error processing card ${card.name}: ${error.message}`);
              
              // Log the error
              await Log.create({
                type: 'error',
                cardId: card.trelloId,
                cardName: card.name,
                action: 'sms_sent',
                channel: 'sms',
                status: 'failure',
                message: `Error sending Day 2 SMS: ${error.message}`
              });
            }
          }
          
          logger.log('info', 'Day 2 SMS job completed');
        } catch (error) {
          logger.log('error', `Error in Day 2 SMS job: ${error.message}`);
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE
      }
    );
    
    logger.log('info', 'Day 2 SMS job scheduled');
  }

  /**
   * Initialize daily report job (00:00 Amsterdam Time)
   */
  initializeDailyReportJob() {
    this.jobs.dailyReport = cron.schedule(
      CRON_TIMES.DAILY_REPORT_TIME,
      async () => {
        try {
          logger.log('info', 'Running daily report job');
          
          // Calculate date range for the report
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 1);
          
          // Generate the report
          await this.generateReport('daily', startDate, endDate);
          
          logger.log('info', 'Daily report job completed');
        } catch (error) {
          logger.log('error', `Error in daily report job: ${error.message}`);
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE
      }
    );
    
    logger.log('info', 'Daily report job scheduled');
  }

  /**
   * Initialize weekly report job (00:00 Monday, Amsterdam Time)
   */
  initializeWeeklyReportJob() {
    this.jobs.weeklyReport = cron.schedule(
      CRON_TIMES.WEEKLY_REPORT_TIME,
      async () => {
        try {
          logger.log('info', 'Running weekly report job');
          
          // Calculate date range for the report
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          
          // Generate the report
          await this.generateReport('weekly', startDate, endDate);
          
          logger.log('info', 'Weekly report job completed');
        } catch (error) {
          logger.log('error', `Error in weekly report job: ${error.message}`);
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE
      }
    );
    
    logger.log('info', 'Weekly report job scheduled');
  }

  /**
   * Generate a report for the specified period
   * @param {string} reportType - Type of report ('daily' or 'weekly')
   * @param {Date} startDate - Start date for the report
   * @param {Date} endDate - End date for the report
   */
  async generateReport(reportType, startDate, endDate) {
    try {
      // Get all cards updated in the date range
      const cards = await Card.find({
        updatedAt: { $gte: startDate, $lte: endDate }
      });
      
      // Get all logs in the date range
      const logs = await Log.find({
        timestamp: { $gte: startDate, $lte: endDate }
      });
      
      // Calculate metrics
      const totalCards = cards.length;
      const cardsWithResponse = cards.filter(card => card.reminderStatus.hasResponse).length;
      const responseRate = totalCards > 0 ? cardsWithResponse / totalCards : 0;
      
      // Calculate average response time
      let totalResponseTime = 0;
      let cardsWithResponseTime = 0;
      
      for (const card of cards) {
        if (card.reminderStatus.hasResponse && card.reminderStatus.responseDate) {
          const firstReminderDate = new Date(card.updatedAt);
          firstReminderDate.setHours(firstReminderDate.getHours() - (card.reminderStatus.reminderCount * 24));
          
          const responseTime = card.reminderStatus.responseDate - firstReminderDate;
          totalResponseTime += responseTime;
          cardsWithResponseTime++;
        }
      }
      
      const avgResponseTime = cardsWithResponseTime > 0 ? totalResponseTime / cardsWithResponseTime : 0;
      
      // Count notifications by type
      const notificationLogs = logs.filter(log => log.type === 'notification');
      const notificationsByChannel = {
        trello: notificationLogs.filter(log => log.channel === 'trello').length,
        email: notificationLogs.filter(log => log.channel === 'email').length,
        sms: notificationLogs.filter(log => log.channel === 'sms').length,
        whatsapp: notificationLogs.filter(log => log.channel === 'whatsapp').length
      };
      
      // Calculate user metrics
      const userMetrics = {
        totalUsers: await this.getUserCount(),
        activeUsers: await this.getActiveUserCount(startDate, endDate)
      };
      
      // Create report object
      const reportData = {
        type: reportType,
        period: { startDate, endDate },
        metrics: {
          cards: {
            total: totalCards,
            withResponse: cardsWithResponse,
            responseRate: Math.round(responseRate * 100) / 100
          },
          notifications: notificationsByChannel,
          performance: {
            averageResponseTime: Math.round(avgResponseTime / (1000 * 60 * 60 * 24) * 100) / 100 // Convert to days
          },
          users: userMetrics
        },
        generatedAt: new Date()
      };
      
      logger.log('info', `Generated ${reportType} report`, reportData);
      return reportData;
      
    } catch (error) {
      logger.log('error', `Error generating ${reportType} report: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get total user count
   */
  async getUserCount() {
    try {
      const User = require('../models/User');
      return await User.countDocuments({});
    } catch (error) {
      logger.log('error', `Error getting user count: ${error.message}`);
      return 0;
    }
  }
  
  /**
   * Get active user count for a period
   */
  async getActiveUserCount(startDate, endDate) {
    try {
      const Log = require('../models/Log');
      const activeUsers = await Log.distinct('userId', {
        timestamp: { $gte: startDate, $lte: endDate }
      });
      return activeUsers.length;
    } catch (error) {
      logger.log('error', `Error getting active user count: ${error.message}`);
      return 0;
    }
  }
}

module.exports = SchedulerService;
