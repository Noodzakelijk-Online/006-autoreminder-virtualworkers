const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Log = require('../models/Log');
const { ensureConnection } = require('../utils/dbConnection');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

// Verify JWT token
const verifyToken = (token, secret = process.env.JWT_SECRET || 'your-secret-key') => {
  return jwt.verify(token, secret);
};

// Authentication middleware with better debugging
const authenticateToken = async (req, res, next) => {
  try {
    // Ensure database connection for serverless
    await ensureConnection();

    const authHeader = req.headers.authorization;
    console.log(`[AUTH DEBUG] ${req.method} ${req.originalUrl}:`);
    console.log(`[AUTH DEBUG] Auth Header:`, authHeader || 'MISSING');
    console.log(`[AUTH DEBUG] All Headers:`, JSON.stringify(req.headers, null, 2));

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[AUTH DEBUG] Failed: Invalid header format`);
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid Authorization header format. Expected: Bearer <token>',
          debug: {
            receivedHeader: authHeader,
            expectedFormat: 'Bearer <your-jwt-token>'
          }
        }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'Access token required' }
      });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-password').maxTimeMS(20000);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: { message: 'Account is deactivated' }
      });
    }

    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        error: { message: 'Account is locked due to too many failed login attempts' }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { message: 'Token expired' }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid token' }
      });
    }

    return res.status(500).json({
      success: false,
      error: { message: 'Authentication error' }
    });
  }
};

// Authorization middleware for specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions' }
      });
    }

    next();
  };
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    // Ensure database connection for serverless
    await ensureConnection();

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id).select('-password').maxTimeMS(20000);

      if (user && user.isActive && !user.isLocked) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Rate limiting by user
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    
    if (!userRequests.has(userId)) {
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userLimit = userRequests.get(userId);
    
    if (now > userLimit.resetTime) {
      userLimit.count = 1;
      userLimit.resetTime = now + windowMs;
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: { 
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
        }
      });
    }

    userLimit.count++;
    next();
  };
};

// Login attempt tracking middleware
const trackLoginAttempt = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log authentication attempt
    const logData = {
      action: 'login_attempt',
      status: res.statusCode === 200 ? 'success' : 'failure',
      message: res.statusCode === 200 ? 'Login successful' : 'Login failed',
      userEmail: req.body.email,
      request: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    };

    if (req.user) {
      logData.userId = req.user.id;
      logData.username = req.user.username;
    }

    Log.logAuth(logData).catch(err => {
      console.error('Failed to log authentication attempt:', err);
    });

    originalSend.call(this, data);
  };

  next();
};

// Middleware to check if user is admin
const requireAdmin = authorize('admin');

// Middleware to check if user can access resource
const checkResourceAccess = (resourceField = 'createdBy') => {
  return (req, res, next) => {
    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // For non-admin users, they can only access their own resources
    // This check would be done in the route handler with the actual resource
    req.checkResourceAccess = (resource) => {
      return resource[resourceField] && resource[resourceField].toString() === req.user.id;
    };

    next();
  };
};

// Middleware to validate API key (for external integrations)
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: { message: 'API key required' }
      });
    }

    // In a real implementation, you'd validate against stored API keys
    const validApiKey = process.env.API_KEY;
    
    if (apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid API key' }
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { message: 'API key validation error' }
    });
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  authenticateToken,
  authorize,
  optionalAuth,
  rateLimitByUser,
  trackLoginAttempt,
  requireAdmin,
  checkResourceAccess,
  validateApiKey
};

