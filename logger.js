const logger = {
  log: function(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Log to console
    console.log(logMessage);
    
    // In a production environment, this could be extended to:
    // - Write to log files
    // - Send to a logging service
    // - Trigger alerts for errors
    
    return logMessage;
  }
};

module.exports = logger;
