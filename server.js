const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const templateRoutes = require('./routes/templates');
const reportRoutes = require('./routes/reports');
const logRoutes = require('./routes/logs');
const trelloRoutes = require('./routes/trello');
const notificationRoutes = require('./routes/notifications');

// Import middleware
const { errorHandler, AppError, ValidationError } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

// Import services
const SchedulerService = require('./services/scheduler');
const MonitoringService = require('./services/monitoringService');
const NotificationService = require('./services/notificationService');

const app = express();
const PORT = process.env.PORT || 3001;

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Enhanced logging middleware
const createMorganFormat = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'combined';
  }
  return ':method :url :status :res[content-length] - :response-time ms :req[x-request-id]';
};

app.use(morgan(createMorganFormat(), {
  skip: (req, res) => {
    // Skip logging for health checks and static assets
    return req.url === '/health' || req.url.startsWith('/static');
  },
  stream: {
    write: (message) => {
      // In production, you might want to send this to a logging service
      console.log(message.trim());
    }
  }
}));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.trello.com", "https://api.sendgrid.com"],
    },
  },
}));

// Enhanced rate limiting with different limits for different endpoints
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: {
    success: false,
    error: {
      type: 'RATE_LIMIT_ERROR',
      message,
      isUserActionable: true,
      retryable: true,
      retryAfter: Math.ceil(windowMs / 1000)
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        type: 'RATE_LIMIT_ERROR',
        message: 'Too many requests. Please wait a moment and try again.',
        isUserActionable: true,
        retryable: true,
        retryAfter: Math.ceil(windowMs / 1000)
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
      requestId: req.id
    });
  }
});

// Different rate limits for different endpoints
app.use('/api/auth/login', createRateLimit(15 * 60 * 1000, 5, 'Too many login attempts. Please try again in 15 minutes.'));
app.use('/api/auth/register', createRateLimit(60 * 60 * 1000, 3, 'Too many registration attempts. Please try again in 1 hour.'));
app.use('/api/notifications', createRateLimit(5 * 60 * 1000, 10, 'Too many notification requests. Please try again in 5 minutes.'));
app.use('/api/', createRateLimit(15 * 60 * 1000, 100, 'Too many requests. Please try again in 15 minutes.'));

// CORS configuration with enhanced error handling
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL].filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new ValidationError(`CORS policy violation: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID']
}));

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      throw new ValidationError('Invalid JSON format in request body');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Compression middleware
app.use(compression());

// Request validation middleware
app.use((req, res, next) => {
  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (contentType && !contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded')) {
      return next(new ValidationError('Unsupported Content-Type. Please use application/json or application/x-www-form-urlencoded.'));
    }
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      monitoring: MonitoringService.getStatus(),
      notifications: NotificationService.getServicesStatus()
    }
  };

  // Check if any critical services are down
  const isHealthy = mongoose.connection.readyState === 1;
  
  res.status(isHealthy ? 200 : 503).json(healthStatus);
});

// API routes with enhanced error handling
app.use('/api/auth', authRoutes);
app.use('/api/config', authenticateToken, configRoutes);
app.use('/api/templates', authenticateToken, templateRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);
app.use('/api/logs', authenticateToken, logRoutes);
app.use('/api/trello', authenticateToken, trelloRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);

// Catch-all route for undefined API endpoints
app.all('/api/*', (req, res, next) => {
  next(new AppError(`API endpoint ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND_ERROR', true, 'The requested API endpoint was not found.'));
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Global error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new requests
    server.close(async () => {
      console.log('HTTP server closed.');
      
      try {
        // Stop services
        await MonitoringService.stopMonitoring();
        await SchedulerService.stop();
        
        // Close database connection
        await mongoose.connection.close();
        console.log('Database connection closed.');
        
        console.log('Graceful shutdown completed.');
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
    
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log to external service in production
  if (process.env.NODE_ENV === 'production') {
    // Send to logging service
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log to external service in production
  if (process.env.NODE_ENV === 'production') {
    // Send to logging service
  }
  process.exit(1);
});

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Database connection with enhanced error handling
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/autoreminder';
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
    };

    await mongoose.connect(mongoURI, options);
    console.log('MongoDB connected successfully');
    
    // Initialize services after database connection
    await initializeServices();
    
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Initialize application services
const initializeServices = async () => {
  try {
    console.log('Initializing application services...');
    
    // Initialize notification service
    await NotificationService.initialize();
    console.log('Notification service initialized');
    
    // Initialize monitoring service
    await MonitoringService.initialize();
    console.log('Monitoring service initialized');
    
    // Start monitoring if enabled
    if (process.env.AUTO_START_MONITORING === 'true') {
      const intervalMinutes = parseInt(process.env.MONITORING_INTERVAL_MINUTES) || 30;
      await MonitoringService.startMonitoring(intervalMinutes);
      console.log(`Monitoring started with ${intervalMinutes} minute intervals`);
    }
    
    console.log('All services initialized successfully');
    
  } catch (error) {
    console.error('Service initialization error:', error);
    // Don't exit here - let the app start even if some services fail
  }
};

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`AutoReminder server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
    
    // Store server reference for graceful shutdown
    global.server = server;
    
    return server;
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
if (require.main === module) {
  startServer();
}

module.exports = app;

