import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { AuthContext } from '../context/AuthContext';

// Mock the AuthContext
const mockLogin = jest.fn();
const mockClearError = jest.fn();

const renderWithContext = (ui, contextValues) => {
  return render(
    <AuthContext.Provider value={contextValues}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    mockLogin.mockClear();
    mockClearError.mockClear();
  });

  test('renders login form', () => {
    renderWithContext(<Login />, {
      login: mockLogin,
      isAuthenticated: false,
      error: null,
      loading: false,
      clearError: mockClearError
    });
    
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  test('shows validation errors for empty fields', async () => {
    renderWithContext(<Login />, {
      login: mockLogin,
      isAuthenticated: false,
      error: null,
      loading: false,
      clearError: mockClearError
    });
    
    const signInButton = screen.getByRole('button', { name: /Sign In/i });
    userEvent.click(signInButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('shows validation error for invalid email', async () => {
    renderWithContext(<Login />, {
      login: mockLogin,
      isAuthenticated: false,
      error: null,
      loading: false,
      clearError: mockClearError
    });
    
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const signInButton = screen.getByRole('button', { name: /Sign In/i });
    
    userEvent.type(emailInput, 'invalid-email');
    userEvent.type(passwordInput, 'password123');
    userEvent.click(signInButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Email is invalid/i)).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('shows validation error for short password', async () => {
    renderWithContext(<Login />, {
      login: mockLogin,
      isAuthenticated: false,
      error: null,
      loading: false,
      clearError: mockClearError
    });
    
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const signInButton = screen.getByRole('button', { name: /Sign In/i });
    
    userEvent.type(emailInput, 'test@example.com');
    userEvent.type(passwordInput, '12345');
    userEvent.click(signInButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Password must be at least 6 characters/i)).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('calls login function with valid inputs', async () => {
    renderWithContext(<Login />, {
      login: mockLogin,
      isAuthenticated: false,
      error: null,
      loading: false,
      clearError: mockClearError
    });
    
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const signInButton = screen.getByRole('button', { name: /Sign In/i });
    
    userEvent.type(emailInput, 'test@example.com');
    userEvent.type(passwordInput, 'password123');
    userEvent.click(signInButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  test('displays error message from context', () => {
    renderWithContext(<Login />, {
      login: mockLogin,
      isAuthenticated: false,
      error: 'Invalid credentials',
      loading: false,
      clearError: mockClearError
    });
    
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  test('shows loading spinner when loading', () => {
    renderWithContext(<Login />, {
      login: mockLogin,
      isAuthenticated: false,
      error: null,
      loading: true,
      clearError: mockClearError
    });
    
    const signInButton = screen.getByRole('button', { name: '' });
    expect(signInButton).toBeDisabled();
    expect(signInButton.querySelector('svg')).toBeInTheDocument(); // CircularProgress
  });
});
