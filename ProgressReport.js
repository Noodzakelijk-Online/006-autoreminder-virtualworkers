const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Progress Report Schema
 * Stores structured data extracted from VA comments on Trello cards
 */
const ProgressReportSchema = new Schema({
  virtualAssistantId: {
    type: String,
    required: true,
    index: true
  },
  virtualAssistantName: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  cardId: {
    type: String,
    required: true,
    index: true
  },
  cardName: {
    type: String,
    required: true
  },
  boardId: {
    type: String,
    required: true,
    index: true
  },
  boardName: {
    type: String,
    required: true
  },
  taskStatus: {
    type: String,
    enum: ['Completed', 'In Progress', 'Blocked', 'Not Started', 'Waiting For Review'],
    required: true
  },
  completedItems: [{
    type: String
  }],
  blockers: [{
    type: String
  }],
  additionalNotes: {
    type: String
  },
  commentIds: [{
    type: String
  }],
  commentTexts: [{
    type: String
  }],
  commentTimestamps: [{
    type: Date
  }],
  reportStatus: {
    type: String,
    enum: ['Draft', 'Generated', 'Delivered', 'Failed'],
    default: 'Draft'
  },
  generatedAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  recipients: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update the updatedAt field
ProgressReportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for formatted date
ProgressReportSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Method to mark report as generated
ProgressReportSchema.methods.markAsGenerated = function() {
  this.reportStatus = 'Generated';
  this.generatedAt = Date.now();
  return this.save();
};

// Method to mark report as delivered
ProgressReportSchema.methods.markAsDelivered = function() {
  this.reportStatus = 'Delivered';
  this.deliveredAt = Date.now();
  return this.save();
};

// Method to mark report as failed
ProgressReportSchema.methods.markAsFailed = function() {
  this.reportStatus = 'Failed';
  return this.save();
};

// Static method to find reports by date range
ProgressReportSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

// Static method to find reports by VA
ProgressReportSchema.statics.findByVirtualAssistant = function(vaId) {
  return this.find({ virtualAssistantId: vaId }).sort({ date: -1 });
};

// Static method to find reports by board
ProgressReportSchema.statics.findByBoard = function(boardId) {
  return this.find({ boardId: boardId }).sort({ date: -1 });
};

// Static method to find reports by status
ProgressReportSchema.statics.findByStatus = function(status) {
  return this.find({ reportStatus: status }).sort({ date: -1 });
};

// Static method to get daily summary
ProgressReportSchema.statics.getDailySummary = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  }).sort({ virtualAssistantName: 1 });
};

module.exports = mongoose.model('ProgressReport', ProgressReportSchema);
