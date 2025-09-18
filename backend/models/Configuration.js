const mongoose = require('mongoose');

const configurationSchema = new mongoose.Schema({
  // Weekend configuration (0 = Sunday, 6 = Saturday)
  weekendDays: {
    type: [Number],
    default: [0, 6], // Sunday and Saturday
    validate: {
      validator: function(days) {
        return days.every(day => day >= 0 && day <= 6);
      },
      message: 'Weekend days must be between 0 (Sunday) and 6 (Saturday)'
    }
  },
  
  // Reminder timing configuration
  reminderTimes: {
    day0: {
      type: String,
      default: '30 18 * * 1-5', // 18:30 on weekdays
      validate: {
        validator: function(cronExpression) {
          // Enhanced cron validation (5 fields) - supports ranges, lists, and steps
          const cronPattern = /^(\*|[0-5]?\d([-,/][0-5]?\d)*|\*\/[0-5]?\d)\s+(\*|[01]?\d|2[0-3]|(([01]?\d|2[0-3])[-,/]([01]?\d|2[0-3]))*|\*\/([01]?\d|2[0-3]))\s+(\*|[0-2]?\d|3[01]|(([0-2]?\d|3[01])[-,/]([0-2]?\d|3[01]))*|\*\/([0-2]?\d|3[01]))\s+(\*|[0-1]?\d|(([0-1]?\d)[-,/]([0-1]?\d))*|\*\/[0-1]?\d)\s+(\*|[0-6]|(([0-6])[-,/]([0-6]))*|\*\/[0-6])$/;
          return cronPattern.test(cronExpression);
        },
        message: 'Invalid cron expression for day0 reminder'
      }
    },
    day1: {
      type: String,
      default: '0 18 * * 1-5', // 18:00 on weekdays
      validate: {
        validator: function(cronExpression) {
          // Enhanced cron validation (5 fields) - supports ranges, lists, and steps
          const cronPattern = /^(\*|[0-5]?\d([-,/][0-5]?\d)*|\*\/[0-5]?\d)\s+(\*|[01]?\d|2[0-3]|(([01]?\d|2[0-3])[-,/]([01]?\d|2[0-3]))*|\*\/([01]?\d|2[0-3]))\s+(\*|[0-2]?\d|3[01]|(([0-2]?\d|3[01])[-,/]([0-2]?\d|3[01]))*|\*\/([0-2]?\d|3[01]))\s+(\*|[0-1]?\d|(([0-1]?\d)[-,/]([0-1]?\d))*|\*\/[0-1]?\d)\s+(\*|[0-6]|(([0-6])[-,/]([0-6]))*|\*\/[0-6])$/;
          return cronPattern.test(cronExpression);
        },
        message: 'Invalid cron expression for day1 reminder'
      }
    },
    day2: {
      type: String,
      default: '0 12 * * 1-5', // 12:00 on weekdays
      validate: {
        validator: function(cronExpression) {
          // Enhanced cron validation (5 fields) - supports ranges, lists, and steps
          const cronPattern = /^(\*|[0-5]?\d([-,/][0-5]?\d)*|\*\/[0-5]?\d)\s+(\*|[01]?\d|2[0-3]|(([01]?\d|2[0-3])[-,/]([01]?\d|2[0-3]))*|\*\/([01]?\d|2[0-3]))\s+(\*|[0-2]?\d|3[01]|(([0-2]?\d|3[01])[-,/]([0-2]?\d|3[01]))*|\*\/([0-2]?\d|3[01]))\s+(\*|[0-1]?\d|(([0-1]?\d)[-,/]([0-1]?\d))*|\*\/[0-1]?\d)\s+(\*|[0-6]|(([0-6])[-,/]([0-6]))*|\*\/[0-6])$/;
          return cronPattern.test(cronExpression);
        },
        message: 'Invalid cron expression for day2 reminder'
      }
    }
  },
  
  // Maximum number of reminder days before stopping
  maxReminderDays: {
    type: Number,
    default: 7,
    min: 1,
    max: 30
  },
  
  // Timezone for scheduling
  timezone: {
    type: String,
    default: 'Europe/Amsterdam',
    validate: {
      validator: function(tz) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch (e) {
          return false;
        }
      },
      message: 'Invalid timezone'
    }
  },
  
  // Allow urgent override on weekends
  allowUrgentOverride: {
    type: Boolean,
    default: true
  },
  
  // Trello configuration
  trello: {
    apiKey: {
      type: String,
      required: true
    },
    token: {
      type: String,
      required: true
    },
    organizationId: {
      type: String
    },
    boardIds: [{
      type: String
    }],
    excludedMemberId: {
      type: String,
      default: '59b3208fbd9a6b2be8b0a436' // Default excluded member
    }
  },
  
  // Notification service configuration
  notifications: {
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      provider: {
        type: String,
        enum: ['sendgrid'],
        default: 'sendgrid'
      },
      fromEmail: {
        type: String,
        default: 'noreply@autoreminder.com'
      },
      fromName: {
        type: String,
        default: 'AutoReminder'
      }
    },
    sms: {
      enabled: {
        type: Boolean,
        default: true
      },
      provider: {
        type: String,
        enum: ['twilio'],
        default: 'twilio'
      }
    },
    whatsapp: {
      enabled: {
        type: Boolean,
        default: false
      },
      provider: {
        type: String,
        enum: ['twilio'],
        default: 'twilio'
      }
    }
  },
  
  // Reporting configuration
  reporting: {
    dailyReportTime: {
      type: String,
      default: '0 0 * * *', // Midnight daily
    },
    weeklyReportTime: {
      type: String,
      default: '0 0 * * 1', // Midnight on Monday
    },
    emailReports: {
      type: Boolean,
      default: true
    },
    reportRecipients: [{
      type: String,
      validate: {
        validator: function(email) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: 'Invalid email address'
      }
    }]
  },
  
  // System settings
  system: {
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    debugMode: {
      type: Boolean,
      default: false
    },
    logLevel: {
      type: String,
      enum: ['error', 'warn', 'info', 'debug'],
      default: 'info'
    }
  },
  
  // Last updated information
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one configuration document exists
configurationSchema.index({}, { unique: true });

// Static method to get current configuration
configurationSchema.statics.getCurrent = async function() {
  let config = await this.findOne();
  
  if (!config) {
    // Create default configuration if none exists with environment variables
    const defaultConfig = {
      trello: {
        apiKey: process.env.TRELLO_API_KEY || 'dummy-api-key',
        token: process.env.TRELLO_TOKEN || 'dummy-token'
      }
    };
    
    config = new this(defaultConfig);
    await config.save();
  }
  
  return config;
};

// Method to update configuration
configurationSchema.statics.updateConfig = async function(updates, userId) {
  let config = await this.getCurrent();
  
  Object.keys(updates).forEach(key => {
    if (key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
      config[key] = updates[key];
    }
  });
  
  config.lastUpdatedBy = userId;
  return config.save();
};

// Method to validate Trello configuration
configurationSchema.methods.validateTrelloConfig = async function() {
  if (!this.trello.apiKey || !this.trello.token) {
    throw new Error('Trello API key and token are required');
  }
  
  // Additional validation can be added here to test the API connection
  return true;
};

// Method to get active notification channels
configurationSchema.methods.getActiveChannels = function() {
  const channels = [];
  
  if (this.notifications.email.enabled) channels.push('email');
  if (this.notifications.sms.enabled) channels.push('sms');
  if (this.notifications.whatsapp.enabled) channels.push('whatsapp');
  
  return channels;
};

// Method to check if current time is weekend
configurationSchema.methods.isWeekend = function(date = new Date()) {
  const day = date.getDay();
  return this.weekendDays.includes(day);
};

module.exports = mongoose.model('Configuration', configurationSchema);

