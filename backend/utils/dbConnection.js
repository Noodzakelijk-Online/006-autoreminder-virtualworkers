const mongoose = require('mongoose');

// Global variable to cache the database connection
let cachedConnection = null;

/**
 * Connect to MongoDB with serverless-optimized settings
 * This function handles connection caching for serverless environments
 */
const connectToDatabase = async () => {
  // If we have a cached connection and it's ready, use it
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('Using cached MongoDB connection');
    return cachedConnection;
  }

  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    console.log('Creating new MongoDB connection...');

    // Serverless-optimized connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      
      // Connection pool settings for serverless
      maxPoolSize: 5, // Smaller pool for serverless
      minPoolSize: 0, // Allow pool to scale down to 0
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      
      // Timeout settings optimized for serverless cold starts
      serverSelectionTimeoutMS: 30000, // 30 seconds for server selection
      socketTimeoutMS: 45000, // 45 seconds for socket operations
      connectTimeoutMS: 30000, // 30 seconds for initial connection
      
      // Buffering settings
      bufferCommands: true, // Enable buffering for more reliable operation
      
      // Heartbeat settings
      heartbeatFrequencyMS: 10000, // Check connection every 10 seconds
      
      // Retry settings
      retryWrites: true,
      retryReads: true,
    };

    // Connect to MongoDB
    const connection = await mongoose.connect(mongoURI, options);
    
    // Cache the connection
    cachedConnection = connection;
    
    console.log('MongoDB connected successfully');
    
    // Set up connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connection established');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      cachedConnection = null; // Clear cache on error
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      cachedConnection = null; // Clear cache on disconnect
    });

    return connection;
    
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    cachedConnection = null; // Clear cache on error
    throw error;
  }
};

/**
 * Ensure database connection is established
 * This is the main function to use in your API routes
 */
const ensureConnection = async () => {
  try {
    // Check if connection exists and is ready
    if (mongoose.connection.readyState === 1) {
      return;
    }
    
    // If connection is connecting, wait for it
    if (mongoose.connection.readyState === 2) {
      await new Promise((resolve, reject) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', reject);
        
        // Timeout after 30 seconds
        setTimeout(() => reject(new Error('Connection timeout')), 30000);
      });
      return;
    }
    
    // Otherwise, establish new connection
    await connectToDatabase();
    
  } catch (error) {
    console.error('Error ensuring database connection:', error);
    throw error;
  }
};

/**
 * Close database connection (for cleanup)
 */
const closeConnection = async () => {
  try {
    if (cachedConnection) {
      await mongoose.connection.close();
      cachedConnection = null;
      console.log('MongoDB connection closed');
    }
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
};

module.exports = {
  connectToDatabase,
  ensureConnection,
  closeConnection
};
