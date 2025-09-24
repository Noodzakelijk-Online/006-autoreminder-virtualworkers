const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['notification', 'activity', 'error', 'system', 'auth'],
    index: true
  },
  
  level: {
    type: String,
    enum: ['debug', 'info', 'warn', 'error', 'critical'],
    default: 'info',
    index: true
  },
  
  // Trello card information
  cardId: {
    type: String,
    index: true
  },
  cardName: {
    type: String,
    maxlength: 500
  },
  cardUrl: {
    type: String
  },
  
  // User information
  userId: {
    type: String,
    index: true
  },
  username: {
    type: String,
    maxlength: 100
  },
  userEmail: {
    type: String,
    maxlength: 255
  },
  
  // Action details
  action: {
    type: String,
    required: true,
    maxlength: 100,
    index: true
  },
  
  // Notification channel (for notification logs)
  channel: {
    type: String,
    enum: ['trello', 'email', 'sms', 'whatsapp'],
    index: true
  },
  
  // Status of the action
  status: {
    type: String,
    enum: ['success', 'failure', 'pending', 'retry'],
    default: 'success',
    index: true
  },
  
  // Detailed message
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Error details (for error logs)
  error: {
    stack: String,
    code: String,
    details: mongoose.Schema.Types.Mixed
  },
  
  // Request information (for API logs)
  request: {
    method: String,
    url: String,
    ip: String,
    userAgent: String,
    headers: mongoose.Schema.Types.Mixed
  },
  
  // Response information
  response: {
    statusCode: Number,
    duration: Number, // in milliseconds
    size: Number // in bytes
  },
  
  // Notification specific fields
  notification: {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template'
    },
    templateName: String,
    recipient: String,
    subject: String,
    deliveryId: String, // External service delivery ID
    retryCount: {
      type: Number,
      default: 0
    },
    scheduledAt: Date,
    deliveredAt: Date
  },
  
  // System metrics
  system: {
    cpu: {
      type: mongoose.Schema.Types.Mixed,
      get: v => typeof v === 'object' ? v.user + v.system : v
    },
    memory: {
      used: Number,
      total: Number,
      free: Number
    },
    disk: {
      used: Number,
      total: Number,
      free: Number
    }
  },
}, {
  timestamps: true
});

// Indexes for efficient querying
logSchema.index({ createdAt: -1 });
logSchema.index({ type: 1, createdAt: -1 });
logSchema.index({ level: 1, createdAt: -1 });
logSchema.index({ cardId: 1, createdAt: -1 });
logSchema.index({ userId: 1, createdAt: -1 });
logSchema.index({ action: 1, createdAt: -1 });
logSchema.index({ status: 1, createdAt: -1 });
logSchema.index({ channel: 1, createdAt: -1 });

// Compound indexes for common queries
logSchema.index({ type: 1, status: 1, createdAt: -1 });
logSchema.index({ cardId: 1, type: 1, createdAt: -1 });
logSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Text index for searching
logSchema.index({ 
  message: 'text', 
  cardName: 'text', 
  username: 'text',
  action: 'text'
});

// Static methods for creating different types of logs
logSchema.statics.logNotification = function(data) {
  return this.create({
    type: 'notification',
    level: data.status === 'success' ? 'info' : 'error',
    cardId: data.cardId,
    cardName: data.cardName,
    cardUrl: data.cardUrl,
    userId: data.userId,
    username: data.username,
    userEmail: data.userEmail,
    action: `send_${data.channel}_notification`,
    channel: data.channel,
    status: data.status,
    message: data.message,
    metadata: data.metadata || {},
    notification: {
      templateId: data.templateId,
      templateName: data.templateName,
      recipient: data.recipient,
      subject: data.subject,
      deliveryId: data.deliveryId,
      retryCount: data.retryCount || 0,
      scheduledAt: data.scheduledAt,
      deliveredAt: data.status === 'success' ? new Date() : null
    }
  });
};

logSchema.statics.logActivity = function(data) {
  return this.create({
    type: 'activity',
    level: 'info',
    cardId: data.cardId,
    cardName: data.cardName,
    cardUrl: data.cardUrl,
    userId: data.userId,
    username: data.username,
    action: data.action,
    status: data.status || 'success',
    message: data.message,
    metadata: data.metadata || {}
  });
};

logSchema.statics.logError = function(error, context = {}) {
  return this.create({
    type: 'error',
    level: 'error',
    action: context.action || 'unknown_error',
    status: 'failure',
    message: error.message || 'Unknown error occurred',
    error: {
      stack: error.stack,
      code: error.code,
      details: error.details || {}
    },
    metadata: context.metadata || {},
    cardId: context.cardId,
    cardName: context.cardName,
    userId: context.userId,
    username: context.username,
    request: context.request
  });
};

logSchema.statics.logSystem = function(data) {
  return this.create({
    type: 'system',
    level: data.level || 'info',
    action: data.action,
    status: data.status || 'success',
    message: data.message,
    metadata: data.metadata || {},
    system: {
      hostname: require('os').hostname(),
      pid: process.pid,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  });
};

logSchema.statics.logAuth = function(data) {
  return this.create({
    type: 'auth',
    level: data.status === 'success' ? 'info' : 'warn',
    action: data.action,
    status: data.status,
    message: data.message,
    userId: data.userId,
    username: data.username,
    userEmail: data.userEmail,
    request: data.request,
    metadata: data.metadata || {}
  });
};

// Method to get logs with pagination and filtering
logSchema.statics.getFilteredLogs = function(filters = {}, options = {}) {
  const {
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  const query = {};
  
  // Apply filters
  if (filters.type) query.type = filters.type;
  if (filters.level) query.level = filters.level;
  if (filters.status) query.status = filters.status;
  if (filters.channel) query.channel = filters.channel;
  if (filters.action) query.action = new RegExp(filters.action, 'i');
  if (filters.cardId) query.cardId = filters.cardId;
  if (filters.userId) query.userId = filters.userId;
  if (filters.search) {
    query.$text = { $search: filters.search };
  }
  
  // Date range filter
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder };
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('notification.templateId', 'name type');
};

// Method to get log statistics
logSchema.statics.getStats = function(filters = {}) {
  const matchStage = {};
  
  // Apply date filter
  if (filters.startDate || filters.endDate) {
    matchStage.createdAt = {};
    if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalLogs: { $sum: 1 },
        errorCount: {
          $sum: { $cond: [{ $eq: ['$level', 'error'] }, 1, 0] }
        },
        notificationCount: {
          $sum: { $cond: [{ $eq: ['$type', 'notification'] }, 1, 0] }
        },
        successfulNotifications: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ['$type', 'notification'] },
                { $eq: ['$status', 'success'] }
              ]},
              1, 0
            ]
          }
        },
        channelStats: {
          $push: {
            $cond: [
              { $eq: ['$type', 'notification'] },
              { channel: '$channel', status: '$status' },
              null
            ]
          }
        }
      }
    }
  ]);
};

// TTL index to automatically delete old logs (optional)
// Uncomment the following line to auto-delete logs older than 90 days
// logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Log', logSchema);

