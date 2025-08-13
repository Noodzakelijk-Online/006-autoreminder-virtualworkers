import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Reports from '../pages/Reports';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('Reports Component', () => {
  const mockReports = [
    {
      _id: 'report1',
      reportType: 'weekly',
      startDate: '2025-04-10T00:00:00.000Z',
      endDate: '2025-04-17T00:00:00.000Z',
      generatedAt: '2025-04-17T12:00:00.000Z',
      metrics: {
        totalCards: 15,
        responseRate: 0.6,
        avgResponseTime: 86400000, // 24 hours in milliseconds
        notificationsSent: {
          trello: 10,
          email: 8,
          sms: 3,
          whatsapp: 2
        }
      },
      userMetrics: [
        { username: 'john.doe', notificationsReceived: 5, responseRate: 0.8 },
        { username: 'jane.smith', notificationsReceived: 4, responseRate: 0.5 }
      ]
    },
    {
      _id: 'report2',
      reportType: 'daily',
      startDate: '2025-04-18T00:00:00.000Z',
      endDate: '2025-04-18T23:59:59.000Z',
      generatedAt: '2025-04-19T00:05:00.000Z',
      metrics: {
        totalCards: 8,
        responseRate: 0.5,
        avgResponseTime: 43200000, // 12 hours in milliseconds
        notificationsSent: {
          trello: 5,
          email: 4,
          sms: 1,
          whatsapp: 0
        }
      },
      userMetrics: [
        { username: 'john.doe', notificationsReceived: 2, responseRate: 1.0 },
        { username: 'jane.smith', notificationsReceived: 2, responseRate: 0.5 }
      ]
    }
  ];

  beforeEach(() => {
    // Mock the API responses
    axios.get.mockImplementation((url) => {
      if (url === '/api/reports') {
        return Promise.resolve({ data: { reports: mockReports } });
      } else if (url.includes('/api/reports/')) {
        return Promise.resolve({ data: mockReports[0] });
      }
      return Promise.reject(new Error('Not found'));
    });
    
    axios.post.mockResolvedValue({ data: mockReports[0] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders reports with loading state initially', () => {
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders reports after loading', async () => {
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if report sections are displayed
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Generate New Report')).toBeInTheDocument();
    expect(screen.getByText('Report History')).toBeInTheDocument();
    
    // Check if reports are listed
    expect(screen.getByText('weekly')).toBeInTheDocument();
    expect(screen.getByText('daily')).toBeInTheDocument();
  });

  test('generates report when generate button is clicked', async () => {
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Click generate button
    userEvent.click(screen.getByRole('button', { name: /Generate Report/i }));
    
    // Check if API was called
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/reports/generate', {
        reportType: 'weekly',
        startDate: expect.any(String),
        endDate: expect.any(String)
      });
    });
    
    // Check if success message is displayed
    expect(screen.getByText('Report generated successfully!')).toBeInTheDocument();
  });

  test('views report details when view button is clicked', async () => {
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Find and click the first view button
    const viewButtons = screen.getAllByRole('button', { name: '' });
    const viewButton = viewButtons.find(button => button.querySelector('svg[data-testid="VisibilityIcon"]'));
    userEvent.click(viewButton);
    
    // Check if API was called
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/reports/report1');
    });
    
    // Check if report details are displayed
    await waitFor(() => {
      expect(screen.getByText('Weekly Report')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Total Cards: 15')).toBeInTheDocument();
      expect(screen.getByText('Response Rate: 60%')).toBeInTheDocument();
    });
  });

  test('displays error message when API call fails', async () => {
    // Override the mock to simulate an error
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch reports'));
    
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Error fetching reports')).toBeInTheDocument();
    });
  });
});
