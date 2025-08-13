const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    enum: ['daily', 'weekly'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  metrics: {
    totalCards: {
      type: Number,
      required: true
    },
    responseRate: {
      type: Number,
      required: true
    },
    avgResponseTime: {
      type: Number,
      required: true
    },
    notificationsSent: {
      trello: {
        type: Number,
        default: 0
      },
      email: {
        type: Number,
        default: 0
      },
      sms: {
        type: Number,
        default: 0
      },
      whatsapp: {
        type: Number,
        default: 0
      }
    }
  },
  userMetrics: [{
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    notificationsReceived: {
      type: Number,
      required: true
    },
    responseRate: {
      type: Number,
      required: true
    }
  }],
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
ReportSchema.index({ reportType: 1, generatedAt: -1 });

module.exports = mongoose.model('Report', ReportSchema);
