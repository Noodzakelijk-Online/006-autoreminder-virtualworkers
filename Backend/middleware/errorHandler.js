const Log = require('../models/Log');

// Error types for better categorization
const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE_ERROR',
  DATABASE: 'DATABASE_ERROR',
  NETWORK: 'NETWORK_ERROR',
  INTERNAL: 'INTERNAL_SERVER_ERROR'
};

// User-friendly error messages
const USER_FRIENDLY_MESSAGES = {
  [ERROR_TYPES.VALIDATION]: 'Please check your input and try again.',
  [ERROR_TYPES.AUTHENTICATION]: 'Please log in to continue.',
  [ERROR_TYPES.AUTHORIZATION]: 'You do not have permission to perform this action.',
  [ERROR_TYPES.NOT_FOUND]: 'The requested resource was not found.',
  [ERROR_TYPES.RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
  [ERROR_TYPES.EXTERNAL_SERVICE]: 'External service is temporarily unavailable. Please try again later.',
  [ERROR_TYPES.DATABASE]: 'Database operation failed. Please try again.',
  [ERROR_TYPES.NETWORK]: 'Network connection issue. Please check your connection and try again.',
  [ERROR_TYPES.INTERNAL]: 'An unexpected error occurred. Our team has been notified.'
};

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  let errorType = ERROR_TYPES.INTERNAL;
  let userMessage = USER_FRIENDLY_MESSAGES[ERROR_TYPES.INTERNAL];
  let isUserActionable = false;
  let statusCode = 500;

  // Log error to database with enhanced context
  const logError = async () => {
    try {
      await Log.logError(err, {
        action: `${req.method} ${req.path}`,
        request: {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          headers: {
            'content-type': req.get('Content-Type'),
            'authorization': req.get('Authorization') ? '[REDACTED]' : undefined,
            'x-forwarded-for': req.get('X-Forwarded-For')
          },
          body: req.method !== 'GET' ? sanitizeRequestBody(req.body) : undefined,
          params: req.params,
          query: req.query
        },
        userId: req.user?.id,
        username: req.user?.username,
        metadata: {
          errorType,
          isUserActionable,
          userAgent: req.get('User-Agent'),
          referer: req.get('Referer')
        }
      });
    } catch (logErr) {
      console.error('Failed to log error to database:', logErr);
    }
  };

  // Sanitize request body for logging (remove sensitive data)
  const sanitizeRequestBody = (body) => {
    if (!body || typeof body !== 'object') return body;
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Details:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    errorType = ERROR_TYPES.VALIDATION;
    userMessage = 'Invalid ID format provided.';
    isUserActionable = true;
    statusCode = 400;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    errorType = ERROR_TYPES.VALIDATION;
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    userMessage = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists.`;
    isUserActionable = true;
    statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    errorType = ERROR_TYPES.VALIDATION;
    const messages = Object.values(err.errors).map(val => val.message);
    userMessage = messages.join('. ');
    isUserActionable = true;
    statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    errorType = ERROR_TYPES.AUTHENTICATION;
    userMessage = 'Invalid authentication token. Please log in again.';
    isUserActionable = true;
    statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    errorType = ERROR_TYPES.AUTHENTICATION;
    userMessage = 'Your session has expired. Please log in again.';
    isUserActionable = true;
    statusCode = 401;
  }

  // Rate limit error
  if (err.status === 429 || err.code === 'RATE_LIMIT_EXCEEDED') {
    errorType = ERROR_TYPES.RATE_LIMIT;
    userMessage = 'Too many requests. Please wait a moment and try again.';
    isUserActionable = true;
    statusCode = 429;
  }

  // Trello API errors
  if (err.response && err.response.status) {
    errorType = ERROR_TYPES.EXTERNAL_SERVICE;
    isUserActionable = false;
    
    if (err.response.status === 401) {
      userMessage = 'Trello authentication failed. Please check your API credentials.';
      isUserActionable = true;
      statusCode = 401;
    } else if (err.response.status === 404) {
      userMessage = 'Trello resource not found. The card or board may have been deleted.';
      isUserActionable = true;
      statusCode = 404;
    } else if (err.response.status === 429) {
      userMessage = 'Trello API rate limit exceeded. Please try again in a few minutes.';
      isUserActionable = true;
      statusCode = 429;
    } else if (err.response.status >= 500) {
      userMessage = 'Trello service is temporarily unavailable. Please try again later.';
      statusCode = 503;
    } else {
      userMessage = `Trello API error: ${err.response.data?.message || 'Unknown error'}`;
      statusCode = err.response.status;
    }
  }

  // SendGrid errors
  if (err.code && err.code.toString().startsWith('4')) {
    errorType = ERROR_TYPES.EXTERNAL_SERVICE;
    
    if (err.code === 401) {
      userMessage = 'Email service authentication failed. Please check your SendGrid API key.';
      isUserActionable = true;
      statusCode = 401;
    } else if (err.code === 403) {
      userMessage = 'Email service access denied. Please check your SendGrid permissions.';
      isUserActionable = true;
      statusCode = 403;
    } else if (err.code === 413) {
      userMessage = 'Email content is too large. Please reduce the message size.';
      isUserActionable = true;
      statusCode = 413;
    } else {
      userMessage = 'Email service error. Please try again later.';
      statusCode = 503;
    }
  }

  // Twilio errors
  if (err.code && typeof err.code === 'number' && err.code >= 20000) {
    errorType = ERROR_TYPES.EXTERNAL_SERVICE;
    
    // Specific Twilio error codes
    switch (err.code) {
      case 21211:
        userMessage = 'Invalid phone number format. Please check the phone number and try again.';
        isUserActionable = true;
        statusCode = 400;
        break;
      case 21612:
        userMessage = 'Phone number is not currently reachable. Please try again later.';
        isUserActionable = true;
        statusCode = 400;
        break;
      case 21614:
        userMessage = 'Invalid mobile number. Please provide a valid mobile phone number.';
        isUserActionable = true;
        statusCode = 400;
        break;
      case 30007:
        userMessage = 'Message delivery failed due to carrier restrictions.';
        isUserActionable = false;
        statusCode = 400;
        break;
      case 63016:
        userMessage = 'Phone number is not a WhatsApp number.';
        isUserActionable = true;
        statusCode = 400;
        break;
      case 63017:
        userMessage = 'WhatsApp user has not accepted Terms of Service.';
        isUserActionable = true;
        statusCode = 400;
        break;
      default:
        userMessage = 'SMS/WhatsApp service error. Please try again later.';
        statusCode = 503;
    }
  }

  // Database connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    errorType = ERROR_TYPES.DATABASE;
    userMessage = 'Database connection issue. Please try again in a moment.';
    isUserActionable = false;
    statusCode = 503;
  }

  // Network errors
  if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || 
      err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    errorType = ERROR_TYPES.NETWORK;
    userMessage = 'Network connection issue. Please check your connection and try again.';
    isUserActionable = true;
    statusCode = 503;
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    errorType = ERROR_TYPES.VALIDATION;
    userMessage = 'File size too large. Please upload a smaller file.';
    isUserActionable = true;
    statusCode = 413;
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    errorType = ERROR_TYPES.VALIDATION;
    userMessage = 'Unexpected file upload. Please check the file type and try again.';
    isUserActionable = true;
    statusCode = 400;
  }

  // Custom application errors
  if (err.isOperational) {
    errorType = err.type || ERROR_TYPES.VALIDATION;
    userMessage = err.userMessage || err.message;
    isUserActionable = err.isUserActionable !== undefined ? err.isUserActionable : true;
    statusCode = err.statusCode || 400;
  }

  // Log the error
  logError();

  // Prepare error response
  const errorResponse = {
    success: false,
    error: {
      type: errorType,
      message: userMessage,
      isUserActionable,
      ...(process.env.NODE_ENV === 'development' && { 
        originalMessage: err.message,
        stack: err.stack,
        details: error 
      }),
      ...(err.code && { code: err.code }),
      ...(err.field && { field: err.field })
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    requestId: req.id || req.headers['x-request-id']
  };

  // Add retry information for retryable errors
  if (isUserActionable && [ERROR_TYPES.RATE_LIMIT, ERROR_TYPES.NETWORK, ERROR_TYPES.EXTERNAL_SERVICE].includes(errorType)) {
    errorResponse.error.retryable = true;
    errorResponse.error.retryAfter = getRetryAfter(errorType);
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Helper function to determine retry delay
const getRetryAfter = (errorType) => {
  switch (errorType) {
    case ERROR_TYPES.RATE_LIMIT:
      return 60; // 1 minute
    case ERROR_TYPES.NETWORK:
      return 30; // 30 seconds
    case ERROR_TYPES.EXTERNAL_SERVICE:
      return 120; // 2 minutes
    default:
      return 60;
  }
};

// Custom error classes for application-specific errors
class AppError extends Error {
  constructor(message, statusCode = 500, type = ERROR_TYPES.INTERNAL, isUserActionable = false, userMessage = null) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.isUserActionable = isUserActionable;
    this.userMessage = userMessage || message;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, ERROR_TYPES.VALIDATION, true);
    this.field = field;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, ERROR_TYPES.AUTHENTICATION, true);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, ERROR_TYPES.AUTHORIZATION, true);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, ERROR_TYPES.NOT_FOUND, true);
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error', isUserActionable = false) {
    super(`${service}: ${message}`, 503, ERROR_TYPES.EXTERNAL_SERVICE, isUserActionable);
  }
}

module.exports = {
  errorHandler,
  ERROR_TYPES,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ExternalServiceError
};

