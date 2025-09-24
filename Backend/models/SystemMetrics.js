const mongoose = require('mongoose');

const systemMetricsSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  cpu: {
    user: Number,
    system: Number,
    total: Number
  },
  memory: {
    used: Number,
    free: Number,
    total: Number
  },
  disk: {
    used: Number,
    free: Number,
    total: Number
  }
});

const SystemMetrics = mongoose.model('SystemMetrics', systemMetricsSchema);
module.exports = SystemMetrics;
