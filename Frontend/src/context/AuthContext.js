import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import { errorHandler } from '../utils/errorHandler';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (token && storedUser) {
          // Verify token is still valid
          try {
            const response = await api.auth.getCurrentUser();
            setUser(response.data.user);
          } catch (error) {
            // Token is invalid, clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setError(errorHandler.processError(error, { action: 'initialize_auth' }));
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.auth.login(credentials);
      const { user: userData } = response.data;
      
      setUser(userData);
      return { success: true, user: userData };
      
    } catch (error) {
      const processedError = errorHandler.processError(error, { action: 'login' });
      setError(processedError);
      return { success: false, error: processedError };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.auth.register(userData);
      const { user: newUser } = response.data;
      
      setUser(newUser);
      return { success: true, user: newUser };
      
    } catch (error) {
      const processedError = errorHandler.processError(error, { action: 'register' });
      setError(processedError);
      return { success: false, error: processedError };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await api.auth.logout();
    } catch (error) {
      // Log error but don't throw - logout should always succeed locally
      console.warn('Logout API call failed:', error);
    } finally {
      setUser(null);
      setError(null);
      setLoading(false);
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateUser,
    clearError,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
