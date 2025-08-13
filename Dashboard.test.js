import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Mock the API responses
    axios.get.mockImplementation((url) => {
      if (url === '/api/notifications/status') {
        return Promise.resolve({
          data: {
            totalCards: 10,
            cardsWithReminders: 5,
            cardsWithResponses: 4,
            responseRate: 0.4,
            reminderCounts: [
              { _id: 0, count: 5 },
              { _id: 1, count: 3 },
              { _id: 2, count: 2 }
            ],
            metrics: {
              notificationsSent: {
                trello: 8,
                email: 5,
                sms: 2,
                whatsapp: 1
              }
            }
          }
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders dashboard with loading state initially', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders dashboard with stats after loading', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if stats are displayed
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // Total Cards
    expect(screen.getByText('40%')).toBeInTheDocument(); // Response Rate
    expect(screen.getByText('5')).toBeInTheDocument(); // Active Reminders
    
    // Check if charts are rendered
    expect(screen.getByText('Response Status')).toBeInTheDocument();
    expect(screen.getByText('Reminder Distribution')).toBeInTheDocument();
    
    // Check if notification channels are displayed
    expect(screen.getByText('Trello Comments')).toBeInTheDocument();
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    expect(screen.getByText('SMS/WhatsApp Messages')).toBeInTheDocument();
  });

  test('displays error message when API call fails', async () => {
    // Override the mock to simulate an error
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch data'));
    
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Error fetching dashboard data')).toBeInTheDocument();
    });
  });
});
