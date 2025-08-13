const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/env');
const logger = require('../utils/logger');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.log('MongoDB connected successfully');
  } catch (error) {
    logger.log(`MongoDB connection error: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
