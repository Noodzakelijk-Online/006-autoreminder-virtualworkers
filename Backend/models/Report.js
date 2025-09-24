const mongoose = require('mongoose');

const userMetricSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    maxlength: 100
  },
  email: {
    type: String,
    maxlength: 255
  },
  cardsAssigned: {
    type: Number,
    default: 0
  },
  notificationsReceived: {
    type: Number,
    default: 0
  },
  responsesProvided: {
    type: Number,
    default: 0
  },
  responseRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  avgResponseTime: {
    type: Number, // in hours
    default: 0
  },
  overdueCards: {
    type: Number,
    default: 0
  }
}, { _id: false });

const channelMetricSchema = new mongoose.Schema({
  channel: {
    type: String,
    enum: ['trello', 'email', 'sms', 'whatsapp'],
    required: true
  },
  sent: {
    type: Number,
    default: 0
  },
  delivered: {
    type: Number,
    default: 0
  },
  failed: {
    type: Number,
    default: 0
  },
  responses: {
    type: Number,
    default: 0
  },
  deliveryRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  responseRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, { _id: false });

const boardMetricSchema = new mongoose.Schema({
  boardId: {
    type: String,
    required: true
  },
  boardName: {
    type: String,
    required: true,
    maxlength: 200
  },
  totalCards: {
    type: Number,
    default: 0
  },
  activeCards: {
    type: Number,
    default: 0
  },
  cardsWithResponse: {
    type: Number,
    default: 0
  },
  overdueCards: {
    type: Number,
    default: 0
  },
  totalReminders: {
    type: Number,
    default: 0
  },
  responseRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  avgResponseTime: {
    type: Number, // in hours
    default: 0
  }
}, { _id: false });

const reportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    index: true
  },
  
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    maxlength: 1000
  },
  
  // Report period
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  
  // Overall metrics
  metrics: {
    totalCards: {
      type: Number,
      default: 0
    },
    activeCards: {
      type: Number,
      default: 0
    },
    cardsWithResponse: {
      type: Number,
      default: 0
    },
    responseRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    avgResponseTime: {
      type: Number, // in hours
      default: 0
    },
    overdueCards: {
      type: Number,
      default: 0
    },
    totalUsers: {
      type: Number,
      default: 0
    },
    activeUsers: {
      type: Number,
      default: 0
    },
    notificationsSent: {
      trello: { type: Number, default: 0 },
      email: { type: Number, default: 0 },
      sms: { type: Number, default: 0 },
      whatsapp: { type: Number, default: 0 }
    },
    notificationsDelivered: {
      trello: { type: Number, default: 0 },
      email: { type: Number, default: 0 },
      sms: { type: Number, default: 0 },
      whatsapp: { type: Number, default: 0 }
    },
    notificationsFailed: {
      trello: { type: Number, default: 0 },
      email: { type: Number, default: 0 },
      sms: { type: Number, default: 0 },
      whatsapp: { type: Number, default: 0 }
    },
    systemErrors: {
      type: Number,
      default: 0
    },
    systemUptime: {
      type: Number, // percentage
      default: 100
    }
  },
  
  // Detailed metrics by user
  userMetrics: [userMetricSchema],
  
  // Metrics by notification channel
  channelMetrics: [channelMetricSchema],
  
  // Metrics by board
  boardMetrics: [boardMetricSchema],
  
  // Time-series data for charts
  timeSeriesData: {
    daily: [{
      date: Date,
      cardsCreated: Number,
      cardsCompleted: Number,
      notificationsSent: Number,
      responsesReceived: Number
    }],
    hourly: [{
      hour: Number,
      notificationsSent: Number,
      responsesReceived: Number
    }]
  },
  
  // Report generation info
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  generationDuration: {
    type: Number, // in milliseconds
    default: 0
  },
  
  // Report status
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'generating',
    index: true
  },
  
  // Export information
  exports: [{
    format: {
      type: String,
      enum: ['pdf', 'csv', 'excel', 'json']
    },
    filePath: String,
    fileSize: Number,
    exportedAt: Date,
    exportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Email delivery info (for automated reports)
  emailDelivery: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    recipients: [String],
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed']
    },
    errorMessage: String
  },
  
  // Filters used to generate the report
  filters: {
    boardIds: [String],
    userIds: [String],
    includeInactive: {
      type: Boolean,
      default: false
    },
    notificationTypes: [String]
  },
  
  // Report configuration
  config: {
    includeCharts: {
      type: Boolean,
      default: true
    },
    includeUserDetails: {
      type: Boolean,
      default: true
    },
    includeBoardBreakdown: {
      type: Boolean,
      default: true
    },
    includeTimeSeriesData: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
reportSchema.index({ reportType: 1, generatedAt: -1 });
reportSchema.index({ startDate: 1, endDate: 1 });
reportSchema.index({ status: 1, generatedAt: -1 });
reportSchema.index({ generatedBy: 1, generatedAt: -1 });
reportSchema.index({ 'emailDelivery.sent': 1, reportType: 1 });

// Virtual for report period duration
reportSchema.virtual('periodDuration').get(function() {
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for overall delivery rate
reportSchema.virtual('overallDeliveryRate').get(function() {
  const totalSent = Object.values(this.metrics.notificationsSent).reduce((sum, count) => sum + count, 0);
  const totalDelivered = Object.values(this.metrics.notificationsDelivered).reduce((sum, count) => sum + count, 0);
  
  return totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
});

// Method to calculate summary statistics
reportSchema.methods.calculateSummary = function() {
  const summary = {
    totalNotifications: Object.values(this.metrics.notificationsSent).reduce((sum, count) => sum + count, 0),
    totalDelivered: Object.values(this.metrics.notificationsDelivered).reduce((sum, count) => sum + count, 0),
    totalFailed: Object.values(this.metrics.notificationsFailed).reduce((sum, count) => sum + count, 0),
    mostActiveUser: null,
    leastResponsiveUser: null,
    bestPerformingBoard: null,
    worstPerformingBoard: null
  };
  
  // Find most active user
  if (this.userMetrics.length > 0) {
    summary.mostActiveUser = this.userMetrics.reduce((prev, current) => 
      (prev.responsesProvided > current.responsesProvided) ? prev : current
    );
    
    summary.leastResponsiveUser = this.userMetrics.reduce((prev, current) => 
      (prev.responseRate < current.responseRate) ? prev : current
    );
  }
  
  // Find best/worst performing boards
  if (this.boardMetrics.length > 0) {
    summary.bestPerformingBoard = this.boardMetrics.reduce((prev, current) => 
      (prev.responseRate > current.responseRate) ? prev : current
    );
    
    summary.worstPerformingBoard = this.boardMetrics.reduce((prev, current) => 
      (prev.responseRate < current.responseRate) ? prev : current
    );
  }
  
  return summary;
};

// Method to export report data
reportSchema.methods.exportData = function(format = 'json') {
  const data = {
    reportInfo: {
      type: this.reportType,
      title: this.title,
      period: {
        start: this.startDate,
        end: this.endDate,
        duration: this.periodDuration
      },
      generatedAt: this.generatedAt
    },
    metrics: this.metrics,
    userMetrics: this.userMetrics,
    channelMetrics: this.channelMetrics,
    boardMetrics: this.boardMetrics,
    summary: this.calculateSummary()
  };
  
  if (format === 'csv') {
    // Convert to CSV format (simplified)
    return this.convertToCSV(data);
  }
  
  return data;
};

// Helper method to convert data to CSV format
reportSchema.methods.convertToCSV = function(data) {
  const csvSections = [];
  
  // User metrics CSV
  if (data.userMetrics.length > 0) {
    const userHeaders = Object.keys(data.userMetrics[0]).join(',');
    const userRows = data.userMetrics.map(user => Object.values(user).join(','));
    csvSections.push('User Metrics\n' + userHeaders + '\n' + userRows.join('\n'));
  }
  
  // Board metrics CSV
  if (data.boardMetrics.length > 0) {
    const boardHeaders = Object.keys(data.boardMetrics[0]).join(',');
    const boardRows = data.boardMetrics.map(board => Object.values(board).join(','));
    csvSections.push('Board Metrics\n' + boardHeaders + '\n' + boardRows.join('\n'));
  }
  
  return csvSections.join('\n\n');
};

// Static method to generate report
reportSchema.statics.generateReport = async function(type, startDate, endDate, options = {}) {
  const report = new this({
    reportType: type,
    title: options.title || `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
    description: options.description,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    generatedBy: options.userId,
    filters: options.filters || {},
    config: options.config || {}
  });
  
  const startTime = Date.now();
  
  try {
    // Generate metrics (this would be implemented with actual data aggregation)
    await report.generateMetrics();
    
    report.status = 'completed';
    report.generationDuration = Date.now() - startTime;
    
    await report.save();
    return report;
  } catch (error) {
    report.status = 'failed';
    report.generationDuration = Date.now() - startTime;
    await report.save();
    throw error;
  }
};

// Method to generate metrics (placeholder - would be implemented with actual aggregation)
reportSchema.methods.generateMetrics = async function() {
  // This would contain the actual logic to aggregate data from Cards, Logs, etc.
  // For now, this is a placeholder
  
  const Card = mongoose.model('Card');
  const Log = mongoose.model('Log');
  
  // Get card statistics
  const cardStats = await Card.getStats({
    startDate: this.startDate,
    endDate: this.endDate
  });
  
  // Get log statistics
  const logStats = await Log.getStats({
    startDate: this.startDate,
    endDate: this.endDate
  });
  
  // Populate metrics based on aggregated data
  if (cardStats.length > 0) {
    const stats = cardStats[0];
    this.metrics.totalCards = stats.totalCards || 0;
    this.metrics.cardsWithResponse = stats.cardsWithResponse || 0;
    this.metrics.responseRate = stats.responseRate || 0;
    this.metrics.avgResponseTime = stats.avgResponseTime || 0;
    this.metrics.overdueCards = stats.overdueCards || 0;
  }
  
  // Additional metric generation would go here
};

// Static method to get recent reports
reportSchema.statics.getRecentReports = function(limit = 10) {
  return this.find({ status: 'completed' })
    .sort({ generatedAt: -1 })
    .limit(limit)
    .populate('generatedBy', 'username email');
};

// Static method to cleanup old reports
reportSchema.statics.cleanupOldReports = function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  return this.deleteMany({
    generatedAt: { $lt: cutoffDate },
    reportType: { $in: ['daily', 'weekly'] } // Only cleanup automated reports
  });
};

module.exports = mongoose.model('Report', reportSchema);

