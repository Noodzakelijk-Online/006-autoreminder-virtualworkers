const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  trelloId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  dueDate: {
    type: Date
  },
  assignedUsers: [{
    trelloId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    email: {
      type: String
    },
    phone: {
      type: String
    }
  }],
  reminderStatus: {
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
    }
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update the updatedAt field
CardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
CardSchema.index({ 'reminderStatus.hasResponse': 1 });
CardSchema.index({ 'reminderStatus.lastReminderDate': 1 });

module.exports = mongoose.model('Card', CardSchema);
