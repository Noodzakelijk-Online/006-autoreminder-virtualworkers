import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set auth token in axios headers
  const setAuthToken = (token) => {
    if (token) {
      axios.defaults.headers.common['x-auth-token'] = token;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['x-auth-token'];
      localStorage.removeItem('token');
    }
  };

  // Load user from token
  const loadUser = async () => {
    if (token) {
      setAuthToken(token);
      try {
        const res = await axios.get('/api/auth/profile');
        setUser(res.data);
        setIsAuthenticated(true);
      } catch (err) {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setAuthToken(null);
        setError(err.response?.data?.message || 'Authentication error');
      }
    }
    setLoading(false);
  };

  // Login user
  const login = async (email, password) => {
    const config = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    try {
      setLoading(true);
      const res = await axios.post('/api/auth/login', { email, password }, config);
      setToken(res.data.token);
      setUser(res.data.user);
      setIsAuthenticated(true);
      setAuthToken(res.data.token);
      setError(null);
      return true;
    } catch (err) {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setAuthToken(null);
      setError(err.response?.data?.message || 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Register user
  const register = async (username, email, password) => {
    const config = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    try {
      setLoading(true);
      const res = await axios.post('/api/auth/register', { username, email, password }, config);
      setToken(res.data.token);
      setIsAuthenticated(true);
      setAuthToken(res.data.token);
      await loadUser();
      setError(null);
      return true;
    } catch (err) {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setAuthToken(null);
      setError(err.response?.data?.message || 'Registration failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout user
  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setAuthToken(null);
    setError(null);
  };

  // Clear errors
  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated,
        loading,
        user,
        error,
        login,
        register,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
