const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { connectToDatabase } = require('./utils/dbConnection');
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
const { ensureDbConnection } = require('./middleware/dbMiddleware');

// Import middleware
const { errorHandler, AppError, ValidationError } = require('./middleware/errorHandler');
const { authenticateToken, optionalAuth } = require('./middleware/auth');

// Import services
const SchedulerService = require('./services/scheduler');
const MonitoringService = require('./services/monitoringService');
const NotificationService = require('./services/notificationService');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Vercel deployment (required for rate limiting)
app.set('trust proxy', 1);

// CORS will be configured later with specific origin validation

// CORS debugging middleware
app.use((req, res, next) => {
  console.log('Incoming request:', {
    origin: req.headers.origin,
    method: req.method,
    path: req.path,
    headers: req.headers
  });
  next();
});

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
  contentSecurityPolicy: false, // Disable CSP temporarily
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
    // Always allow these origins
    const alwaysAllowed = [
      'http://localhost:3000', 
      'http://localhost:3001',
      'https://frontend-auto-rem.vercel.app',
      'https://frontend-auto-9ru8u63b3-talalahmad786s-projects.vercel.app',
      'https://frontend-auto-reminder.vercel.app',
      'https://frontend-auto-reminder-git-57c658-noodzakelijk-onlines-projects.vercel.app'
    ];
    
    // Add environment variable if set
    const envFrontendUrl = process.env.FRONTEND_URL;
    if (envFrontendUrl) {
      alwaysAllowed.push(envFrontendUrl);
    }
    
    // Log for debugging
    console.log('CORS check - Origin:', origin);
    console.log('CORS check - Allowed origins:', alwaysAllowed);
    console.log('CORS check - NODE_ENV:', process.env.NODE_ENV);
    console.log('CORS check - FRONTEND_URL:', process.env.FRONTEND_URL);
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (alwaysAllowed.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS REJECTED - Origin not in allowed list:', origin);
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

// Debug authentication endpoint
app.get('/api/debug/auth', optionalAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      authenticated: !!req.user,
      user: req.user ? {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      } : null,
      headers: {
        authorization: req.headers.authorization ? 'present' : 'missing',
        contentType: req.headers['content-type'],
        userAgent: req.headers['user-agent']
      },
      timestamp: new Date().toISOString()
    },
    message: req.user ? 'Authentication successful' : 'No authentication provided'
  });
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

// Database connection middleware for all API routes
app.use('/api', ensureDbConnection);

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

    // Check if already connected (important for serverless)
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: process.env.NODE_ENV === 'production' ? 5 : 10, // Smaller pool for serverless
      serverSelectionTimeoutMS: 30000, // Increased for serverless cold starts
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000, // Added connection timeout
      bufferCommands: false, // Disable buffering for serverless to avoid hanging
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    };

    await mongoose.connect(mongoURI, options);
    console.log('MongoDB connected successfully');

    // Initialize services after database connection (only if not in serverless)
    if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
      await initializeServices();
    }

  } catch (error) {
    console.error('Database connection error:', error);
    // Don't exit in serverless environment, let it retry
    if (process.env.VERCEL) {
      throw error;
    }
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
    // Use the new connection utility
    await connectToDatabase();

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
    // Don't exit in serverless environment
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};

// Start the application
if (require.main === module) {
  startServer();
} else if (process.env.VERCEL) {
  // For Vercel serverless, just ensure connection without starting server
  connectToDatabase().catch(console.error);
}

module.exports = app;

