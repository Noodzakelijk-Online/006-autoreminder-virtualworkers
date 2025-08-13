import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Logs from '../pages/Logs';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('Logs Component', () => {
  const mockLogs = {
    logs: [
      {
        _id: 'log1',
        timestamp: '2025-04-18T15:30:00.000Z',
        type: 'reminder',
        channel: 'email',
        message: 'Reminder sent to john.doe@example.com',
        status: 'success',
        userId: 'user1',
        cardId: 'card1'
      },
      {
        _id: 'log2',
        timestamp: '2025-04-18T14:45:00.000Z',
        type: 'notification',
        channel: 'trello',
        message: 'Comment posted on card "Website Redesign"',
        status: 'success',
        cardId: 'card2'
      },
      {
        _id: 'log3',
        timestamp: '2025-04-18T12:15:00.000Z',
        type: 'system',
        message: 'Failed to connect to Trello API',
        status: 'error'
      }
    ],
    pagination: {
      total: 25,
      page: 1,
      limit: 20,
      pages: 2
    }
  };

  const mockStats = {
    dateRange: {
      startDate: '2025-04-11T00:00:00.000Z',
      endDate: '2025-04-18T23:59:59.000Z'
    },
    byType: [
      { _id: 'reminder', count: 15 },
      { _id: 'notification', count: 8 },
      { _id: 'system', count: 2 }
    ],
    byChannel: [
      { _id: 'email', count: 10 },
      { _id: 'trello', count: 8 },
      { _id: 'sms', count: 5 }
    ],
    byStatus: [
      { _id: 'success', count: 20 },
      { _id: 'error', count: 5 }
    ],
    byDay: [
      { date: '2025-04-11', count: 3 },
      { date: '2025-04-12', count: 2 },
      { date: '2025-04-13', count: 4 },
      { date: '2025-04-14', count: 5 },
      { date: '2025-04-15', count: 3 },
      { date: '2025-04-16', count: 2 },
      { date: '2025-04-17', count: 4 },
      { date: '2025-04-18', count: 2 }
    ]
  };

  beforeEach(() => {
    // Mock the API responses
    axios.get.mockImplementation((url) => {
      if (url === '/api/logs') {
        return Promise.resolve({ data: mockLogs });
      } else if (url === '/api/logs/stats') {
        return Promise.resolve({ data: mockStats });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders logs with loading state initially', () => {
    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders logs after loading', async () => {
    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if log sections are displayed
    expect(screen.getByText('Activity Logs')).toBeInTheDocument();
    expect(screen.getByText('Activity Over Time')).toBeInTheDocument();
    
    // Check if logs are listed
    expect(screen.getByText('Reminder sent to john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('Comment posted on card "Website Redesign"')).toBeInTheDocument();
    expect(screen.getByText('Failed to connect to Trello API')).toBeInTheDocument();
  });

  test('toggles filters when filter button is clicked', async () => {
    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Initially filters should be hidden
    expect(screen.queryByText('Type')).not.toBeInTheDocument();
    
    // Click show filters button
    userEvent.click(screen.getByRole('button', { name: /Show Filters/i }));
    
    // Check if filters are displayed
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Channel')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    
    // Click hide filters button
    userEvent.click(screen.getByRole('button', { name: /Hide Filters/i }));
    
    // Check if filters are hidden again
    await waitFor(() => {
      expect(screen.queryByText('Type')).not.toBeInTheDocument();
    });
  });

  test('applies filters when filter values are changed', async () => {
    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Click show filters button
    userEvent.click(screen.getByRole('button', { name: /Show Filters/i }));
    
    // Select a type filter
    const typeSelect = screen.getByLabelText('Type');
    userEvent.click(typeSelect);
    const reminderOption = screen.getByText('Reminder');
    userEvent.click(reminderOption);
    
    // Check if API was called with filter
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/logs', {
        params: expect.objectContaining({
          type: 'reminder'
        })
      });
    });
  });

  test('navigates between pages', async () => {
    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if pagination is displayed
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    
    // Click next page button
    userEvent.click(screen.getByRole('button', { name: /Next/i }));
    
    // Check if API was called with page 2
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/logs', {
        params: expect.objectContaining({
          page: 2
        })
      });
    });
  });

  test('displays error message when API call fails', async () => {
    // Override the mock to simulate an error
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch logs'));
    
    render(
      <BrowserRouter>
        <Logs />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Error fetching logs')).toBeInTheDocument();
    });
  });
});
