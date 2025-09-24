const mongoose = require('mongoose');

const assignedUserSchema = new mongoose.Schema({
  trelloId: {
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
  phone: {
    type: String,
    maxlength: 20
  },
  fullName: {
    type: String,
    maxlength: 200
  }
}, { _id: false });

const reminderStatusSchema = new mongoose.Schema({
  lastReminderDate: {
    type: Date
  },
  lastReminderType: {
    type: String,
    enum: ['trello', 'email', 'sms', 'whatsapp']
  },
  reminderCount: {
    type: Number,
    default: 0
  },
  hasResponse: {
    type: Boolean,
    default: false
  },
  responseDate: {
    type: Date
  },
  lastCommentDate: {
    type: Date
  },
  lastCommentId: {
    type: String
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  urgentReason: {
    type: String,
    maxlength: 500
  },
  pausedUntil: {
    type: Date
  },
  pauseReason: {
    type: String,
    maxlength: 500
  }
}, { _id: false });

const cardSchema = new mongoose.Schema({
  trelloId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 500
  },
  url: {
    type: String,
    required: true
  },
  shortUrl: {
    type: String
  },
  description: {
    type: String,
    maxlength: 2000
  },
  
  // Board and list information
  boardId: {
    type: String,
    required: true,
    index: true
  },
  boardName: {
    type: String,
    maxlength: 200
  },
  listId: {
    type: String,
    required: true,
    index: true
  },
  listName: {
    type: String,
    maxlength: 200
  },
  
  // Card dates
  dueDate: {
    type: Date,
    index: true
  },
  dateLastActivity: {
    type: Date,
    index: true
  },
  
  // Assigned users
  assignedUsers: [assignedUserSchema],
  
  // Reminder status
  reminderStatus: {
    type: reminderStatusSchema,
    default: () => ({})
  },
  
  // Card status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isClosed: {
    type: Boolean,
    default: false,
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Labels and other metadata
  labels: [{
    id: String,
    name: String,
    color: String
  }],
  
  // Tracking information
  lastSyncDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  syncErrors: [{
    date: Date,
    error: String
  }],
  
  // Statistics
  stats: {
    totalReminders: {
      type: Number,
      default: 0
    },
    totalResponses: {
      type: Number,
      default: 0
    },
    avgResponseTime: {
      type: Number, // in hours
      default: 0
    },
    lastResponseTime: {
      type: Number // in hours
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
cardSchema.index({ trelloId: 1 });
cardSchema.index({ boardId: 1, isActive: 1 });
cardSchema.index({ 'assignedUsers.trelloId': 1 });
cardSchema.index({ 'assignedUsers.email': 1 });
cardSchema.index({ dueDate: 1, isActive: 1 });
cardSchema.index({ 'reminderStatus.lastReminderDate': 1 });
cardSchema.index({ 'reminderStatus.hasResponse': 1, isActive: 1 });
cardSchema.index({ dateLastActivity: 1, isActive: 1 });
cardSchema.index({ lastSyncDate: 1 });

// Compound indexes for common queries
cardSchema.index({ 
  isActive: 1, 
  isClosed: 1, 
  'reminderStatus.hasResponse': 1,
  'reminderStatus.lastReminderDate': 1 
});

// Text search index
cardSchema.index({ 
  name: 'text', 
  description: 'text',
  'assignedUsers.username': 'text',
  'assignedUsers.email': 'text'
});

// Virtual for days since last reminder
cardSchema.virtual('daysSinceLastReminder').get(function() {
  if (!this.reminderStatus.lastReminderDate) return null;
  
  const now = new Date();
  const lastReminder = new Date(this.reminderStatus.lastReminderDate);
  const diffTime = Math.abs(now - lastReminder);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days since last activity
cardSchema.virtual('daysSinceLastActivity').get(function() {
  if (!this.dateLastActivity) return null;
  
  const now = new Date();
  const lastActivity = new Date(this.dateLastActivity);
  const diffTime = Math.abs(now - lastActivity);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for overdue status
cardSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return new Date() > new Date(this.dueDate);
});

// Method to check if card needs reminder
cardSchema.methods.needsReminder = function(config) {
  // Skip if card is not active or has response
  if (!this.isActive || this.isClosed || this.reminderStatus.hasResponse) {
    return false;
  }
  
  // Skip if paused
  if (this.reminderStatus.pausedUntil && new Date() < this.reminderStatus.pausedUntil) {
    return false;
  }
  
  // Skip if weekend and not urgent
  if (config.isWeekend() && !this.reminderStatus.isUrgent && !config.allowUrgentOverride) {
    return false;
  }
  
  // Skip if max reminder days reached
  if (this.reminderStatus.reminderCount >= config.maxReminderDays) {
    return false;
  }
  
  // Check if enough time has passed since last reminder
  if (this.reminderStatus.lastReminderDate) {
    const hoursSinceLastReminder = (new Date() - this.reminderStatus.lastReminderDate) / (1000 * 60 * 60);
    if (hoursSinceLastReminder < 12) { // Minimum 12 hours between reminders
      return false;
    }
  }
  
  return true;
};

// Method to get next reminder type
cardSchema.methods.getNextReminderType = function() {
  const count = this.reminderStatus.reminderCount;
  
  if (count === 0) return 'trello';
  if (count === 1) return 'email';
  if (count >= 2) return 'sms'; // Can also include WhatsApp
  
  return 'email'; // Default fallback
};

// Method to record reminder sent
cardSchema.methods.recordReminderSent = function(type, templateId) {
  this.reminderStatus.lastReminderDate = new Date();
  this.reminderStatus.lastReminderType = type;
  this.reminderStatus.reminderCount += 1;
  this.stats.totalReminders += 1;
  
  return this.save();
};

// Method to record response received
cardSchema.methods.recordResponse = function(responseDate = new Date()) {
  const wasWaitingForResponse = !this.reminderStatus.hasResponse;
  
  this.reminderStatus.hasResponse = true;
  this.reminderStatus.responseDate = responseDate;
  this.stats.totalResponses += 1;
  
  // Calculate response time if there was a previous reminder
  if (wasWaitingForResponse && this.reminderStatus.lastReminderDate) {
    const responseTime = (responseDate - this.reminderStatus.lastReminderDate) / (1000 * 60 * 60); // hours
    this.stats.lastResponseTime = responseTime;
    
    // Update average response time
    const totalResponseTime = (this.stats.avgResponseTime * (this.stats.totalResponses - 1)) + responseTime;
    this.stats.avgResponseTime = totalResponseTime / this.stats.totalResponses;
  }
  
  return this.save();
};

// Method to reset reminder status (when new activity detected)
cardSchema.methods.resetReminderStatus = function() {
  this.reminderStatus.hasResponse = true;
  this.reminderStatus.responseDate = new Date();
  this.reminderStatus.lastCommentDate = new Date();
  
  return this.save();
};

// Method to mark as urgent
cardSchema.methods.markAsUrgent = function(reason) {
  this.reminderStatus.isUrgent = true;
  this.reminderStatus.urgentReason = reason;
  
  return this.save();
};

// Method to pause reminders
cardSchema.methods.pauseReminders = function(until, reason) {
  this.reminderStatus.pausedUntil = until;
  this.reminderStatus.pauseReason = reason;
  
  return this.save();
};

// Static method to find cards needing reminders
cardSchema.statics.findCardsNeedingReminders = function(config) {
  const query = {
    isActive: true,
    isClosed: false,
    'reminderStatus.hasResponse': false,
    $or: [
      { 'reminderStatus.pausedUntil': { $exists: false } },
      { 'reminderStatus.pausedUntil': { $lt: new Date() } }
    ]
  };
  
  // Add weekend check if not allowing urgent override
  if (config.isWeekend() && !config.allowUrgentOverride) {
    query['reminderStatus.isUrgent'] = true;
  }
  
  return this.find(query)
    .populate('assignedUsers')
    .sort({ 'reminderStatus.lastReminderDate': 1 });
};

// Static method to get card statistics
cardSchema.statics.getStats = function(filters = {}) {
  const matchStage = { isActive: true };
  
  if (filters.boardId) matchStage.boardId = filters.boardId;
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
        totalCards: { $sum: 1 },
        cardsWithResponse: {
          $sum: { $cond: ['$reminderStatus.hasResponse', 1, 0] }
        },
        totalReminders: { $sum: '$stats.totalReminders' },
        totalResponses: { $sum: '$stats.totalResponses' },
        avgResponseTime: { $avg: '$stats.avgResponseTime' },
        overdueCards: {
          $sum: {
            $cond: [
              { $and: [
                { $ne: ['$dueDate', null] },
                { $lt: ['$dueDate', new Date()] }
              ]},
              1, 0
            ]
          }
        }
      }
    },
    {
      $addFields: {
        responseRate: {
          $cond: [
            { $eq: ['$totalCards', 0] },
            0,
            { $multiply: [{ $divide: ['$cardsWithResponse', '$totalCards'] }, 100] }
          ]
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Card', cardSchema);

