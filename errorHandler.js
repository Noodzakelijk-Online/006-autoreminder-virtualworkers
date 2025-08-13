// Frontend Error Handling Utility for AutoReminder

// Error types that match backend error types
export const ERROR_TYPES = {
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

// User-friendly error messages for different scenarios
const ERROR_MESSAGES = {
  [ERROR_TYPES.VALIDATION]: {
    title: 'Input Error',
    message: 'Please check your input and try again.',
    icon: '⚠️',
    color: 'warning'
  },
  [ERROR_TYPES.AUTHENTICATION]: {
    title: 'Authentication Required',
    message: 'Please log in to continue.',
    icon: '🔐',
    color: 'info',
    action: 'login'
  },
  [ERROR_TYPES.AUTHORIZATION]: {
    title: 'Access Denied',
    message: 'You do not have permission to perform this action.',
    icon: '🚫',
    color: 'error'
  },
  [ERROR_TYPES.NOT_FOUND]: {
    title: 'Not Found',
    message: 'The requested resource was not found.',
    icon: '🔍',
    color: 'warning'
  },
  [ERROR_TYPES.RATE_LIMIT]: {
    title: 'Too Many Requests',
    message: 'Please wait a moment and try again.',
    icon: '⏱️',
    color: 'warning',
    retryable: true
  },
  [ERROR_TYPES.EXTERNAL_SERVICE]: {
    title: 'Service Unavailable',
    message: 'External service is temporarily unavailable. Please try again later.',
    icon: '🔧',
    color: 'error',
    retryable: true
  },
  [ERROR_TYPES.DATABASE]: {
    title: 'Database Error',
    message: 'Database operation failed. Please try again.',
    icon: '💾',
    color: 'error',
    retryable: true
  },
  [ERROR_TYPES.NETWORK]: {
    title: 'Connection Error',
    message: 'Network connection issue. Please check your connection and try again.',
    icon: '🌐',
    color: 'error',
    retryable: true
  },
  [ERROR_TYPES.INTERNAL]: {
    title: 'System Error',
    message: 'An unexpected error occurred. Our team has been notified.',
    icon: '⚡',
    color: 'error'
  }
};

// Default error configuration
const DEFAULT_ERROR = {
  title: 'Error',
  message: 'Something went wrong. Please try again.',
  icon: '❌',
  color: 'error'
};

/**
 * Enhanced error handler class for frontend
 */
export class ErrorHandler {
  constructor() {
    this.errorQueue = [];
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.listeners = [];
  }

  /**
   * Process and format error for display
   * @param {Error|Object} error - Error object or API error response
   * @param {Object} context - Additional context information
   * @returns {Object} Formatted error object
   */
  processError(error, context = {}) {
    let processedError = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      context,
      originalError: error
    };

    // Handle different error sources
    if (error?.response) {
      // Axios/API error
      processedError = this.processApiError(error, processedError);
    } else if (error?.name === 'NetworkError' || error?.code === 'NETWORK_ERROR') {
      // Network error
      processedError = this.processNetworkError(error, processedError);
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      // Fetch API error
      processedError = this.processFetchError(error, processedError);
    } else if (error?.name === 'ValidationError') {
      // Client-side validation error
      processedError = this.processValidationError(error, processedError);
    } else {
      // Generic JavaScript error
      processedError = this.processGenericError(error, processedError);
    }

    // Add to error queue for analytics
    this.addToErrorQueue(processedError);

    // Notify listeners
    this.notifyListeners(processedError);

    return processedError;
  }

  /**
   * Process API response errors
   */
  processApiError(error, processedError) {
    const response = error.response;
    const data = response?.data;

    processedError.statusCode = response?.status;
    processedError.type = data?.error?.type || this.inferErrorType(response?.status);
    processedError.isUserActionable = data?.error?.isUserActionable ?? true;
    processedError.retryable = data?.error?.retryable ?? false;
    processedError.retryAfter = data?.error?.retryAfter;

    // Get user-friendly message
    const errorConfig = ERROR_MESSAGES[processedError.type] || DEFAULT_ERROR;
    processedError.title = errorConfig.title;
    processedError.message = data?.error?.message || errorConfig.message;
    processedError.icon = errorConfig.icon;
    processedError.color = errorConfig.color;
    processedError.action = errorConfig.action;

    // Handle specific status codes
    if (response?.status === 401) {
      processedError.action = 'login';
    } else if (response?.status === 403) {
      processedError.action = 'contact_admin';
    }

    return processedError;
  }

  /**
   * Process network errors
   */
  processNetworkError(error, processedError) {
    processedError.type = ERROR_TYPES.NETWORK;
    processedError.isUserActionable = true;
    processedError.retryable = true;

    const errorConfig = ERROR_MESSAGES[ERROR_TYPES.NETWORK];
    processedError.title = errorConfig.title;
    processedError.message = errorConfig.message;
    processedError.icon = errorConfig.icon;
    processedError.color = errorConfig.color;

    return processedError;
  }

  /**
   * Process fetch API errors
   */
  processFetchError(error, processedError) {
    processedError.type = ERROR_TYPES.NETWORK;
    processedError.isUserActionable = true;
    processedError.retryable = true;

    const errorConfig = ERROR_MESSAGES[ERROR_TYPES.NETWORK];
    processedError.title = errorConfig.title;
    processedError.message = 'Failed to connect to server. Please check your internet connection.';
    processedError.icon = errorConfig.icon;
    processedError.color = errorConfig.color;

    return processedError;
  }

  /**
   * Process validation errors
   */
  processValidationError(error, processedError) {
    processedError.type = ERROR_TYPES.VALIDATION;
    processedError.isUserActionable = true;
    processedError.retryable = false;

    const errorConfig = ERROR_MESSAGES[ERROR_TYPES.VALIDATION];
    processedError.title = errorConfig.title;
    processedError.message = error.message || errorConfig.message;
    processedError.icon = errorConfig.icon;
    processedError.color = errorConfig.color;
    processedError.field = error.field;

    return processedError;
  }

  /**
   * Process generic JavaScript errors
   */
  processGenericError(error, processedError) {
    processedError.type = ERROR_TYPES.INTERNAL;
    processedError.isUserActionable = false;
    processedError.retryable = false;

    const errorConfig = ERROR_MESSAGES[ERROR_TYPES.INTERNAL];
    processedError.title = errorConfig.title;
    processedError.message = errorConfig.message;
    processedError.icon = errorConfig.icon;
    processedError.color = errorConfig.color;

    // In development, show actual error message
    if (process.env.NODE_ENV === 'development') {
      processedError.message = error.message || errorConfig.message;
      processedError.stack = error.stack;
    }

    return processedError;
  }

  /**
   * Infer error type from HTTP status code
   */
  inferErrorType(statusCode) {
    if (statusCode >= 400 && statusCode < 500) {
      switch (statusCode) {
        case 400: return ERROR_TYPES.VALIDATION;
        case 401: return ERROR_TYPES.AUTHENTICATION;
        case 403: return ERROR_TYPES.AUTHORIZATION;
        case 404: return ERROR_TYPES.NOT_FOUND;
        case 429: return ERROR_TYPES.RATE_LIMIT;
        default: return ERROR_TYPES.VALIDATION;
      }
    } else if (statusCode >= 500) {
      return ERROR_TYPES.INTERNAL;
    }
    return ERROR_TYPES.INTERNAL;
  }

  /**
   * Retry failed operation with exponential backoff
   */
  async retryOperation(operation, maxRetries = this.maxRetries, delay = this.retryDelay) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        const processedError = this.processError(error, { attempt, maxRetries });
        
        // Don't retry if error is not retryable
        if (!processedError.retryable) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retrying with exponential backoff
        const retryDelay = processedError.retryAfter ? 
          processedError.retryAfter * 1000 : 
          delay * Math.pow(2, attempt - 1);
          
        await this.delay(retryDelay);
      }
    }
    
    throw lastError;
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(error) {
    const processedError = this.processError(error);
    
    // Clear stored authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Redirect to login page
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
    }
    
    return processedError;
  }

  /**
   * Show user-friendly error notification
   */
  showErrorNotification(error, options = {}) {
    const processedError = this.processError(error);
    
    // Use your preferred notification library here
    // This is a generic implementation
    if (typeof window !== 'undefined' && window.showNotification) {
      window.showNotification({
        type: processedError.color,
        title: processedError.title,
        message: processedError.message,
        icon: processedError.icon,
        duration: options.duration || (processedError.retryable ? 5000 : 3000),
        actions: this.getErrorActions(processedError)
      });
    } else {
      // Fallback to console or alert
      console.error(`${processedError.title}: ${processedError.message}`, processedError);
      
      if (options.showAlert) {
        alert(`${processedError.title}: ${processedError.message}`);
      }
    }
    
    return processedError;
  }

  /**
   * Get available actions for error
   */
  getErrorActions(processedError) {
    const actions = [];
    
    if (processedError.retryable) {
      actions.push({
        label: 'Retry',
        action: 'retry',
        primary: true
      });
    }
    
    if (processedError.action === 'login') {
      actions.push({
        label: 'Login',
        action: 'login',
        primary: true
      });
    }
    
    if (processedError.action === 'contact_admin') {
      actions.push({
        label: 'Contact Support',
        action: 'contact_support',
        primary: false
      });
    }
    
    return actions;
  }

  /**
   * Add error listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove error listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners of error
   */
  notifyListeners(error) {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  /**
   * Add error to queue for analytics
   */
  addToErrorQueue(error) {
    this.errorQueue.push(error);
    
    // Keep only last 100 errors
    if (this.errorQueue.length > 100) {
      this.errorQueue.shift();
    }
    
    // Send to analytics service if available
    this.sendToAnalytics(error);
  }

  /**
   * Send error to analytics service
   */
  sendToAnalytics(error) {
    // Implement analytics reporting here
    if (typeof window !== 'undefined' && window.analytics) {
      window.analytics.track('Error Occurred', {
        errorId: error.id,
        errorType: error.type,
        statusCode: error.statusCode,
        isUserActionable: error.isUserActionable,
        retryable: error.retryable,
        context: error.context,
        timestamp: error.timestamp
      });
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorQueue.length,
      byType: {},
      byStatusCode: {},
      retryable: 0,
      userActionable: 0
    };
    
    this.errorQueue.forEach(error => {
      // Count by type
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      
      // Count by status code
      if (error.statusCode) {
        stats.byStatusCode[error.statusCode] = (stats.byStatusCode[error.statusCode] || 0) + 1;
      }
      
      // Count retryable and user actionable
      if (error.retryable) stats.retryable++;
      if (error.isUserActionable) stats.userActionable++;
    });
    
    return stats;
  }

  /**
   * Clear error queue
   */
  clearErrorQueue() {
    this.errorQueue = [];
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility for retries
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Convenience functions
export const processError = (error, context) => errorHandler.processError(error, context);
export const showError = (error, options) => errorHandler.showErrorNotification(error, options);
export const retryOperation = (operation, maxRetries, delay) => errorHandler.retryOperation(operation, maxRetries, delay);
export const handleAuthError = (error) => errorHandler.handleAuthError(error);

// Global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    errorHandler.processError(event.reason, { type: 'unhandled_rejection' });
  });
  
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    errorHandler.processError(event.error, { type: 'global_error' });
  });
}

export default errorHandler;

