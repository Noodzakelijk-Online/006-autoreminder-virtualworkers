const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['notification', 'activity', 'error'],
    required: true
  },
  cardId: {
    type: String,
    required: function() {
      return this.type === 'notification' || this.type === 'activity';
    }
  },
  cardName: {
    type: String,
    required: function() {
      return this.type === 'notification' || this.type === 'activity';
    }
  },
  userId: {
    type: String
  },
  username: {
    type: String
  },
  action: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    enum: ['trello', 'email', 'sms', 'whatsapp', 'system'],
    required: function() {
      return this.type === 'notification';
    }
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
LogSchema.index({ type: 1, timestamp: -1 });
LogSchema.index({ cardId: 1, timestamp: -1 });
LogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Log', LogSchema);
