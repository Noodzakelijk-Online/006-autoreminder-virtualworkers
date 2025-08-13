const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const trelloService = require('./src/services/trello');
const emailService = require('./src/services/email');
const smsService = require('./src/services/sms');
const schedulerService = require('./src/services/scheduler');
const databaseService = require('./src/services/database');
const templatesService = require('./src/services/templates');
const notificationsService = require('./src/services/notifications');
const reportsService = require('./src/services/reports');
const logsService = require('./src/services/logs');
const configService = require('./src/services/config');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Initialize services
let mainWindow;

const initialize = (window) => {
  mainWindow = window;
  
  // Initialize database
  databaseService.initialize();
  
  // Initialize other services
  configService.initialize();
  templatesService.initialize();
  trelloService.initialize();
  emailService.initialize();
  smsService.initialize();
  schedulerService.initialize();
  notificationsService.initialize();
  reportsService.initialize();
  logsService.initialize();
  
  // Register IPC handlers
  registerIpcHandlers();
  
  log.info('IPC handlers initialized');
};

const registerIpcHandlers = () => {
  // Auth handlers
  ipcMain.handle('login', async (event, credentials) => {
    try {
      // Implement login logic
      return { success: true, user: { id: 1, name: 'Test User', email: 'test@example.com' } };
    } catch (error) {
      log.error('Login error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Trello handlers
  ipcMain.handle('getTrelloCredentials', async () => {
    try {
      const credentials = await trelloService.getCredentials();
      return { success: true, credentials };
    } catch (error) {
      log.error('Get Trello credentials error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('trelloAuth', async () => {
    try {
      const result = await trelloService.authenticate();
      return { success: true, result };
    } catch (error) {
      log.error('Trello auth error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('getTrelloBoards', async () => {
    try {
      const boards = await trelloService.getBoards();
      return { success: true, boards };
    } catch (error) {
      log.error('Get Trello boards error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('getTrelloCards', async (event, boardId, listNames) => {
    try {
      const cards = await trelloService.getCards(boardId, listNames);
      return { success: true, cards };
    } catch (error) {
      log.error('Get Trello cards error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('syncTrelloCards', async () => {
    try {
      const result = await trelloService.syncCards();
      return { success: true, cards: result.cards };
    } catch (error) {
      log.error('Sync Trello cards error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Template handlers
  ipcMain.handle('getTemplates', async () => {
    try {
      const templates = await templatesService.getTemplates();
      return { success: true, templates };
    } catch (error) {
      log.error('Get templates error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('createTemplate', async (event, template) => {
    try {
      const result = await templatesService.createTemplate(template);
      return { success: true, template: result };
    } catch (error) {
      log.error('Create template error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('updateTemplate', async (event, id, template) => {
    try {
      const result = await templatesService.updateTemplate(id, template);
      return { success: true, template: result };
    } catch (error) {
      log.error('Update template error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('deleteTemplate', async (event, id) => {
    try {
      await templatesService.deleteTemplate(id);
      return { success: true };
    } catch (error) {
      log.error('Delete template error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Configuration handlers
  ipcMain.handle('getConfig', async () => {
    try {
      const config = await configService.getConfig();
      return { success: true, config };
    } catch (error) {
      log.error('Get config error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('updateConfig', async (event, config) => {
    try {
      const result = await configService.updateConfig(config);
      return { success: true, config: result };
    } catch (error) {
      log.error('Update config error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('resetConfig', async () => {
    try {
      const config = await configService.resetConfig();
      return { success: true, config };
    } catch (error) {
      log.error('Reset config error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Email configuration handlers
  ipcMain.handle('getEmailConfig', async () => {
    try {
      const config = await emailService.getConfig();
      return { success: true, config };
    } catch (error) {
      log.error('Get email config error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('saveEmailConfig', async (event, config) => {
    try {
      const result = await emailService.saveConfig(config);
      return { success: true, config: result };
    } catch (error) {
      log.error('Save email config error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('testEmailConfig', async () => {
    try {
      const result = await emailService.testConnection();
      return { success: true, result };
    } catch (error) {
      log.error('Test email config error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Twilio configuration handlers
  ipcMain.handle('getTwilioConfig', async () => {
    try {
      const config = await smsService.getConfig();
      return { success: true, config };
    } catch (error) {
      log.error('Get Twilio config error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('saveTwilioConfig', async (event, config) => {
    try {
      const result = await smsService.saveConfig(config);
      return { success: true, config: result };
    } catch (error) {
      log.error('Save Twilio config error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('testTwilioConfig', async () => {
    try {
      const result = await smsService.testConnection();
      return { success: true, result };
    } catch (error) {
      log.error('Test Twilio config error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Notification handlers
  ipcMain.handle('getNotificationStatus', async () => {
    try {
      const status = await notificationsService.getStatus();
      return { success: true, status };
    } catch (error) {
      log.error('Get notification status error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('sendNotification', async (event, cardId, channels, message) => {
    try {
      const result = await notificationsService.sendNotification(cardId, channels, message);
      return { success: true, result };
    } catch (error) {
      log.error('Send notification error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Report handlers
  ipcMain.handle('getReports', async () => {
    try {
      const reports = await reportsService.getReports();
      return { success: true, reports };
    } catch (error) {
      log.error('Get reports error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('getReportMetrics', async (event, startDate, endDate) => {
    try {
      const metrics = await reportsService.getMetrics(startDate, endDate);
      return { success: true, metrics };
    } catch (error) {
      log.error('Get report metrics error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('generateReport', async (event, options) => {
    try {
      const report = await reportsService.generateReport(options);
      return { success: true, report };
    } catch (error) {
      log.error('Generate report error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('downloadReport', async (event, reportId) => {
    try {
      const filePath = await reportsService.getReportFilePath(reportId);
      
      if (filePath) {
        shell.openPath(filePath);
        return { success: true };
      } else {
        throw new Error('Report file not found');
      }
    } catch (error) {
      log.error('Download report error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('emailReport', async (event, reportId) => {
    try {
      const result = await reportsService.emailReport(reportId);
      return { success: true, result };
    } catch (error) {
      log.error('Email report error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('deleteReport', async (event, reportId) => {
    try {
      await reportsService.deleteReport(reportId);
      return { success: true };
    } catch (error) {
      log.error('Delete report error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Log handlers
  ipcMain.handle('getLogs', async (event, options) => {
    try {
      const result = await logsService.getLogs(options);
      return { 
        success: true, 
        logs: result.logs,
        totalCount: result.totalCount
      };
    } catch (error) {
      log.error('Get logs error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('clearLogs', async (event, options) => {
    try {
      await logsService.clearLogs(options);
      return { success: true };
    } catch (error) {
      log.error('Clear logs error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('exportLogs', async (event, options) => {
    try {
      const filePath = await logsService.exportLogs(options);
      
      if (filePath) {
        shell.openPath(filePath);
        return { success: true, filePath };
      } else {
        throw new Error('Failed to export logs');
      }
    } catch (error) {
      log.error('Export logs error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Database handlers
  ipcMain.handle('syncDatabase', async () => {
    try {
      const result = await databaseService.sync();
      return { success: true, result };
    } catch (error) {
      log.error('Sync database error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // System handlers
  ipcMain.handle('openExternalLink', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      log.error('Open external link error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('showSaveDialog', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, options);
      return { success: true, filePath: result.filePath, canceled: result.canceled };
    } catch (error) {
      log.error('Show save dialog error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('showOpenDialog', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, options);
      return { success: true, filePaths: result.filePaths, canceled: result.canceled };
    } catch (error) {
      log.error('Show open dialog error:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('getAppVersion', () => {
    return { success: true, version: app.getVersion() };
  });
};

module.exports = {
  initialize
};
