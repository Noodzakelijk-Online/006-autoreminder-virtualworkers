const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Auth methods
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  
  // Trello methods
  getTrelloCredentials: () => ipcRenderer.invoke('getTrelloCredentials'),
  trelloAuth: () => ipcRenderer.invoke('trelloAuth'),
  getTrelloBoards: () => ipcRenderer.invoke('getTrelloBoards'),
  getTrelloCards: (boardId, listNames) => ipcRenderer.invoke('getTrelloCards', boardId, listNames),
  syncTrelloCards: () => ipcRenderer.invoke('syncTrelloCards'),
  
  // Template methods
  getTemplates: () => ipcRenderer.invoke('getTemplates'),
  createTemplate: (template) => ipcRenderer.invoke('createTemplate', template),
  updateTemplate: (id, template) => ipcRenderer.invoke('updateTemplate', id, template),
  deleteTemplate: (id) => ipcRenderer.invoke('deleteTemplate', id),
  
  // Configuration methods
  getConfig: () => ipcRenderer.invoke('getConfig'),
  updateConfig: (config) => ipcRenderer.invoke('updateConfig', config),
  resetConfig: () => ipcRenderer.invoke('resetConfig'),
  
  // Email configuration methods
  getEmailConfig: () => ipcRenderer.invoke('getEmailConfig'),
  saveEmailConfig: (config) => ipcRenderer.invoke('saveEmailConfig', config),
  testEmailConfig: () => ipcRenderer.invoke('testEmailConfig'),
  
  // Twilio configuration methods
  getTwilioConfig: () => ipcRenderer.invoke('getTwilioConfig'),
  saveTwilioConfig: (config) => ipcRenderer.invoke('saveTwilioConfig', config),
  testTwilioConfig: () => ipcRenderer.invoke('testTwilioConfig'),
  
  // Notification methods
  getNotificationStatus: () => ipcRenderer.invoke('getNotificationStatus'),
  sendNotification: (cardId, channels, message) => ipcRenderer.invoke('sendNotification', cardId, channels, message),
  
  // Report methods
  getReports: () => ipcRenderer.invoke('getReports'),
  getReportMetrics: (startDate, endDate) => ipcRenderer.invoke('getReportMetrics', startDate, endDate),
  generateReport: (options) => ipcRenderer.invoke('generateReport', options),
  downloadReport: (reportId) => ipcRenderer.invoke('downloadReport', reportId),
  emailReport: (reportId) => ipcRenderer.invoke('emailReport', reportId),
  deleteReport: (reportId) => ipcRenderer.invoke('deleteReport', reportId),
  
  // Log methods
  getLogs: (options) => ipcRenderer.invoke('getLogs', options),
  clearLogs: (options) => ipcRenderer.invoke('clearLogs', options),
  exportLogs: (options) => ipcRenderer.invoke('exportLogs', options),
  
  // Database methods
  syncDatabase: () => ipcRenderer.invoke('syncDatabase'),
  
  // System methods
  openExternalLink: (url) => ipcRenderer.invoke('openExternalLink', url),
  showSaveDialog: (options) => ipcRenderer.invoke('showSaveDialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('showOpenDialog', options),
  getAppVersion: () => ipcRenderer.invoke('getAppVersion'),
  
  // Event listeners
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', () => callback());
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', () => callback());
  },
  onSystemError: (callback) => {
    ipcRenderer.on('system-error', (_, error) => callback(error));
  }
});
