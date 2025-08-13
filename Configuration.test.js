import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Configuration from '../pages/Configuration';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('Configuration Component', () => {
  const mockConfig = {
    weekendDays: [0, 6],
    reminderTimes: {
      day0: '30 18 * * *',
      day1: '0 18 * * *',
      day2: '0 12 * * *'
    },
    maxReminderDays: 7,
    timezone: 'Europe/Amsterdam',
    allowUrgentOverride: true
  };

  beforeEach(() => {
    // Mock the API responses
    axios.get.mockResolvedValue({ data: mockConfig });
    axios.put.mockResolvedValue({ data: mockConfig });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders configuration with loading state initially', () => {
    render(
      <BrowserRouter>
        <Configuration />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders configuration after loading', async () => {
    render(
      <BrowserRouter>
        <Configuration />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if configuration sections are displayed
    expect(screen.getByText('System Configuration')).toBeInTheDocument();
    expect(screen.getByText('General Settings')).toBeInTheDocument();
    expect(screen.getByText('Reminder Schedule')).toBeInTheDocument();
    
    // Check if form fields have correct values
    expect(screen.getByLabelText('Timezone')).toHaveValue('Europe/Amsterdam');
    expect(screen.getByLabelText('Maximum Reminder Days')).toHaveValue(7);
    expect(screen.getByLabelText('Allow Urgent Override (Send reminders on weekends for urgent tasks)')).toBeChecked();
  });

  test('updates configuration when save button is clicked', async () => {
    render(
      <BrowserRouter>
        <Configuration />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Change a field value
    const maxDaysInput = screen.getByLabelText('Maximum Reminder Days');
    userEvent.clear(maxDaysInput);
    userEvent.type(maxDaysInput, '10');
    
    // Click save button
    userEvent.click(screen.getByRole('button', { name: /Save Configuration/i }));
    
    // Check if API was called with updated data
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith('/api/config', {
        ...mockConfig,
        maxReminderDays: 10
      });
    });
    
    // Check if success message is displayed
    expect(screen.getByText('Configuration saved successfully!')).toBeInTheDocument();
  });

  test('displays error message when API call fails', async () => {
    // Override the mock to simulate an error
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch configuration'));
    
    render(
      <BrowserRouter>
        <Configuration />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Error fetching configuration')).toBeInTheDocument();
    });
  });
});
