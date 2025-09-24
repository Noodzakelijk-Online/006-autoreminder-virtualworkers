const mongoose = require('mongoose');

const ConfigurationSchema = new mongoose.Schema({
  weekendDays: {
    type: [Number],
    default: [0, 6], // Sunday and Saturday by default (0-6, where 0 is Sunday)
    validate: {
      validator: function(arr) {
        return arr.every(day => day >= 0 && day <= 6);
      },
      message: 'Weekend days must be between 0 and 6'
    }
  },
  reminderTimes: {
    day0: {
      type: String,
      default: '30 18 * * *', // 18:30 every day
      required: true
    },
    day1: {
      type: String,
      default: '0 18 * * *', // 18:00 every day
      required: true
    },
    day2: {
      type: String,
      default: '0 12 * * *', // 12:00 every day
      required: true
    }
  },
  maxReminderDays: {
    type: Number,
    default: 7,
    min: 1,
    max: 30
  },
  timezone: {
    type: String,
    default: 'Europe/Amsterdam',
    required: true
  },
  allowUrgentOverride: {
    type: Boolean,
    default: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update the updatedAt field
ConfigurationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Configuration', ConfigurationSchema);