// Enhanced API utility with comprehensive error handling for AutoReminder

import { errorHandler, handleAuthError, retryOperation } from './errorHandler';

// API configuration
const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000
};

/**
 * Enhanced API client with error handling and retry logic
 */
class ApiClient {
  constructor(config = {}) {
    this.config = { ...API_CONFIG, ...config };
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.setupDefaultInterceptors();
  }

  /**
   * Setup default request and response interceptors
   */
  setupDefaultInterceptors() {
    // Request interceptor for authentication
    this.addRequestInterceptor((config) => {
      const token = localStorage.getItem('token');
      console.log('Token from localStorage:', token ? 'exists' : 'not found');
      
      if (token) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        };
        console.log('Added Authorization header:', `Bearer ${token.substring(0, 10)}...`);
      } else {
        console.warn('No token found in localStorage');
      }
      
      // Add request ID for tracking
      config.headers['X-Request-ID'] = this.generateRequestId();
      
      return config;
    });

    // Response interceptor for token refresh
    this.addResponseInterceptor(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Handle token expiration
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.refreshToken();
            return this.request(originalRequest);
          } catch (refreshError) {
            return handleAuthError(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(onFulfilled, onRejected) {
    this.requestInterceptors.push({ onFulfilled, onRejected });
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(onFulfilled, onRejected) {
    this.responseInterceptors.push({ onFulfilled, onRejected });
  }

  /**
   * Apply request interceptors
   */
  async applyRequestInterceptors(config) {
    let processedConfig = config;
    
    for (const interceptor of this.requestInterceptors) {
      try {
        if (interceptor.onFulfilled) {
          processedConfig = await interceptor.onFulfilled(processedConfig);
        }
      } catch (error) {
        if (interceptor.onRejected) {
          processedConfig = await interceptor.onRejected(error);
        } else {
          throw error;
        }
      }
    }
    
    return processedConfig;
  }

  /**
   * Apply response interceptors
   */
  async applyResponseInterceptors(response, error = null) {
    let processedResponse = response;
    let processedError = error;
    
    for (const interceptor of this.responseInterceptors) {
      try {
        if (processedError && interceptor.onRejected) {
          processedResponse = await interceptor.onRejected(processedError);
          processedError = null;
        } else if (processedResponse && interceptor.onFulfilled) {
          processedResponse = await interceptor.onFulfilled(processedResponse);
        }
      } catch (err) {
        processedError = err;
        processedResponse = null;
      }
    }
    
    if (processedError) {
      throw processedError;
    }
    
    return processedResponse;
  }

  /**
   * Make HTTP request with enhanced error handling
   */
  async request(config) {
    try {
      // Apply request interceptors
      const processedConfig = await this.applyRequestInterceptors({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        ...config,
        url: this.buildUrl(config.url)
      });

      // Make the actual request
      const response = await this.makeRequest(processedConfig);
      
      // Apply response interceptors
      return await this.applyResponseInterceptors(response);
      
    } catch (error) {
      // Apply response interceptors for errors
      try {
        return await this.applyResponseInterceptors(null, error);
      } catch (interceptorError) {
        // Process and throw the error
        const processedError = errorHandler.processError(interceptorError, {
          url: config.url,
          method: config.method,
          requestId: config.headers?.['X-Request-ID']
        });
        
        throw processedError;
      }
    }
  }

  /**
   * Make the actual HTTP request using fetch API
   */
  async makeRequest(config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.data ? JSON.stringify(config.data) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Parse response
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Create response object
      const responseObj = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config
      };

      // Check if response is successful
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.response = responseObj;
        throw error;
      }

      return responseObj;

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle different types of errors
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout');
        timeoutError.code = 'TIMEOUT';
        timeoutError.config = config;
        throw timeoutError;
      }
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = new Error('Network error');
        networkError.code = 'NETWORK_ERROR';
        networkError.config = config;
        throw networkError;
      }
      
      throw error;
    }
  }

  /**
   * Build full URL from relative path
   */
  buildUrl(url) {
    if (url.startsWith('http')) {
      return url;
    }
    return `${this.config.baseURL}${url.startsWith('/') ? url : '/' + url}`;
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.makeRequest({
        url: this.buildUrl('/auth/refresh'),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { refreshToken }
      });

      const { token, refreshToken: newRefreshToken } = response.data.data;
      
      // Update stored tokens
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', newRefreshToken);
      
      return token;
      
    } catch (error) {
      // Clear invalid tokens
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      throw error;
    }
  }

  // HTTP method shortcuts with retry logic
  async get(url, config = {}) {
    return retryOperation(() => this.request({ ...config, method: 'GET', url }));
  }

  async post(url, data, config = {}) {
    return retryOperation(() => this.request({ ...config, method: 'POST', url, data }));
  }

  async put(url, data, config = {}) {
    return retryOperation(() => this.request({ ...config, method: 'PUT', url, data }));
  }

  async patch(url, data, config = {}) {
    return retryOperation(() => this.request({ ...config, method: 'PATCH', url, data }));
  }

  async delete(url, config = {}) {
    return retryOperation(() => this.request({ ...config, method: 'DELETE', url }));
  }

  // Non-retryable methods for operations that shouldn't be retried
  async postOnce(url, data, config = {}) {
    return this.request({ ...config, method: 'POST', url, data });
  }

  async putOnce(url, data, config = {}) {
    return this.request({ ...config, method: 'PUT', url, data });
  }

  async deleteOnce(url, config = {}) {
    return this.request({ ...config, method: 'DELETE', url });
  }
}

// Create singleton API client
export const apiClient = new ApiClient();

// API service functions with enhanced error handling
export const api = {
  // Authentication
  auth: {
    login: async (credentials) => {
      try {
        const response = await apiClient.postOnce('/auth/login', credentials);
        
        // Store authentication data
        const { token, refreshToken, user } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
        
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'login' });
      }
    },

    register: async (userData) => {
      try {
        const response = await apiClient.postOnce('/auth/register', userData);
        
        // Store authentication data
        const { token, refreshToken, user } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
        
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'register' });
      }
    },

    logout: async () => {
      try {
        await apiClient.postOnce('/auth/logout');
      } catch (error) {
        // Log error but don't throw - logout should always succeed locally
        console.warn('Logout API call failed:', error);
      } finally {
        // Always clear local storage
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    },

    getCurrentUser: async () => {
      try {
        const response = await apiClient.get('/auth/me');
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_current_user' });
      }
    },

    changePassword: async (passwordData) => {
      try {
        const response = await apiClient.putOnce('/auth/change-password', passwordData);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'change_password' });
      }
    }
  },

  // Trello integration
  trello: {
    validateCredentials: async () => {
      try {
        const response = await apiClient.get('/trello/validate');
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'validate_trello_credentials' });
      }
    },

    getBoards: async (organizationId) => {
      try {
        const url = organizationId ? `/trello/boards?organizationId=${organizationId}` : '/trello/boards';
        const response = await apiClient.get(url);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_trello_boards' });
      }
    },

    getBoardDetails: async (boardId) => {
      try {
        const response = await apiClient.get(`/trello/boards/${boardId}`);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_board_details', boardId });
      }
    },

    syncCards: async (boardIds = []) => {
      try {
        const response = await apiClient.post('/trello/sync', { boardIds });
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'sync_trello_cards' });
      }
    },

    getCards: async (filters = {}) => {
      try {
        const queryParams = new URLSearchParams(filters).toString();
        const url = `/trello/cards${queryParams ? '?' + queryParams : ''}`;
        const response = await apiClient.get(url);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_cards', filters });
      }
    },

    sendReminder: async (cardId, reminderData) => {
      try {
        const response = await apiClient.postOnce(`/trello/cards/${cardId}/reminder`, reminderData);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'send_reminder', cardId });
      }
    },

    pauseReminders: async (cardId, pauseData) => {
      try {
        const response = await apiClient.putOnce(`/trello/cards/${cardId}/pause`, pauseData);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'pause_reminders', cardId });
      }
    },

    getStats: async () => {
      try {
        const response = await apiClient.get('/trello/stats');
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_trello_stats' });
      }
    },

    triggerMonitoring: async () => {
      try {
        const response = await apiClient.postOnce('/trello/monitoring/trigger');
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'trigger_monitoring' });
      }
    },



    postComment: async (cardId, commentData) => {
      try {
        const response = await apiClient.postOnce(`/trello/cards/${cardId}/comments`, commentData);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'post_comment', cardId });
      }
    },

    getMonitoringStatus: async () => {
      try {
        const response = await apiClient.get('/trello/monitoring/status');
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_monitoring_status' });
      }
    }
  },

  // Configuration
  config: {
    get: async () => {
      try {
        const response = await apiClient.get('/config');
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_config' });
      }
    },

    update: async (configData) => {
      try {
        const response = await apiClient.putOnce('/config', configData);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'update_config' });
      }
    },

    validate: async () => {
      try {
        const response = await apiClient.get('/config/validate');
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'validate_config' });
      }
    }
  },

  // Templates
  templates: {
    getAll: async () => {
      try {
        const response = await apiClient.get('/templates');
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_templates' });
      }
    },

    create: async (templateData) => {
      try {
        const response = await apiClient.postOnce('/templates', templateData);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'create_template' });
      }
    },

    update: async (templateId, templateData) => {
      try {
        const response = await apiClient.putOnce(`/templates/${templateId}`, templateData);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'update_template', templateId });
      }
    },

    delete: async (templateId) => {
      try {
        const response = await apiClient.deleteOnce(`/templates/${templateId}`);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'delete_template', templateId });
      }
    }
  },

  // Reports
  reports: {
    getAll: async (filters = {}) => {
      try {
        const queryParams = new URLSearchParams(filters).toString();
        const url = `/reports${queryParams ? '?' + queryParams : ''}`;
        const response = await apiClient.get(url);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_reports', filters });
      }
    },

    generate: async (reportData) => {
      try {
        const response = await apiClient.postOnce('/reports', reportData);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'generate_report' });
      }
    },

    getById: async (reportId) => {
      try {
        const response = await apiClient.get(`/reports/${reportId}`);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_report', reportId });
      }
    },

    download: async (reportId) => {
      try {
        const response = await apiClient.get(`/reports/${reportId}/download`);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'download_report', reportId });
      }
    }
  },

  // Logs
  logs: {
    getAll: async (filters = {}) => {
      try {
        const queryParams = new URLSearchParams(filters).toString();
        const url = `/logs${queryParams ? '?' + queryParams : ''}`;
        const response = await apiClient.get(url);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_logs', filters });
      }
    },

    getStats: async (filters = {}) => {
      try {
        const queryParams = new URLSearchParams(filters).toString();
        const url = `/logs/stats${queryParams ? '?' + queryParams : ''}`;
        const response = await apiClient.get(url);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_log_stats', filters });
      }
    }
  },

  // Notifications
  notifications: {
    test: async (channel, testData) => {
      try {
        const response = await apiClient.postOnce('/notifications/test', { channel, ...testData });
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'test_notification', channel });
      }
    },

    getStats: async (startDate, endDate) => {
      try {
        const params = new URLSearchParams({ startDate, endDate }).toString();
        const response = await apiClient.get(`/notifications/stats?${params}`);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_notification_stats' });
      }
    },

    getStatus: async () => {
      try {
        // Use stats endpoint since status doesn't exist
        const response = await apiClient.get('/notifications/stats');
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'get_notification_status' });
      }
    },

    sendNotification: async (notificationData) => {
      try {
        const response = await apiClient.postOnce('/notifications/send', notificationData);
        return response.data;
      } catch (error) {
        throw errorHandler.processError(error, { action: 'send_notification', notificationData });
      }
    }
  }
};

export default api;

