import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Notifications from '../pages/Notifications';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('Notifications Component', () => {
  const mockStats = {
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
  };

  const mockCards = [
    { id: 'card1', name: 'Website Redesign', assignedUsers: [{ username: 'john.doe', email: 'john@example.com' }] },
    { id: 'card2', name: 'Content Creation', assignedUsers: [{ username: 'jane.smith', email: 'jane@example.com' }] }
  ];

  beforeEach(() => {
    // Mock the API responses
    axios.get.mockImplementation((url) => {
      if (url === '/api/notifications/status') {
        return Promise.resolve({ data: mockStats });
      }
      return Promise.reject(new Error('Not found'));
    });
    
    axios.post.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders notifications with loading state initially', () => {
    render(
      <BrowserRouter>
        <Notifications />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders notifications after loading', async () => {
    render(
      <BrowserRouter>
        <Notifications />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if notification sections are displayed
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Send Manual Notification')).toBeInTheDocument();
    expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    expect(screen.getByText('Notification Status')).toBeInTheDocument();
    
    // Check if stats are displayed
    expect(screen.getByText('10')).toBeInTheDocument(); // Total Cards
    expect(screen.getByText('5')).toBeInTheDocument(); // With Reminders
    expect(screen.getByText('4')).toBeInTheDocument(); // With Responses
    expect(screen.getByText('40%')).toBeInTheDocument(); // Response Rate
  });

  test('opens notification dialog when compose button is clicked', async () => {
    render(
      <BrowserRouter>
        <Notifications />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Select a card
    const cardSelect = screen.getByLabelText('Select Card');
    userEvent.click(cardSelect);
    const options = screen.getAllByRole('option');
    userEvent.click(options[1]); // Select the first card option
    
    // Click compose button
    userEvent.click(screen.getByRole('button', { name: /Compose Notification/i }));
    
    // Check if dialog is displayed
    expect(screen.getByText('Compose Notification')).toBeInTheDocument();
    expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  test('sends notification when send button is clicked', async () => {
    render(
      <BrowserRouter>
        <Notifications />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Select a card
    const cardSelect = screen.getByLabelText('Select Card');
    userEvent.click(cardSelect);
    const options = screen.getAllByRole('option');
    userEvent.click(options[1]); // Select the first card option
    
    // Click compose button
    userEvent.click(screen.getByRole('button', { name: /Compose Notification/i }));
    
    // Enter message text
    const messageInput = screen.getByPlaceholderText('Enter your notification message here...');
    userEvent.type(messageInput, 'Please provide an update on your task');
    
    // Click send button
    userEvent.click(screen.getByRole('button', { name: /Send Notification/i }));
    
    // Check if API was called
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/notifications/send', {
        cardId: expect.any(String),
        channels: ['email'],
        message: 'Please provide an update on your task'
      });
    });
    
    // Check if success message is displayed
    expect(screen.getByText('Notification sent successfully')).toBeInTheDocument();
  });

  test('displays error message when API call fails', async () => {
    // Override the mock to simulate an error
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch notification status'));
    
    render(
      <BrowserRouter>
        <Notifications />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Error fetching cards')).toBeInTheDocument();
    });
  });
});
