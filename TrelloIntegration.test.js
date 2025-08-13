import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TrelloIntegration from '../pages/TrelloIntegration';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('TrelloIntegration Component', () => {
  const mockBoards = [
    { id: 'board1', name: 'Development Board' },
    { id: 'board2', name: 'Marketing Board' }
  ];

  const mockCards = [
    { 
      id: 'card1', 
      name: 'Website Redesign', 
      due: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      members: [{ fullName: 'John Doe' }],
      url: 'https://trello.com/c/abc123'
    },
    { 
      id: 'card2', 
      name: 'Content Creation', 
      due: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      members: [{ fullName: 'Jane Smith' }],
      url: 'https://trello.com/c/def456'
    }
  ];

  beforeEach(() => {
    // Mock the API responses
    axios.get.mockImplementation((url) => {
      if (url === '/api/trello/boards') {
        return Promise.resolve({ data: mockBoards });
      } else if (url.includes('/api/trello/cards')) {
        return Promise.resolve({ data: mockCards });
      }
      return Promise.reject(new Error('Not found'));
    });
    
    axios.post.mockImplementation((url) => {
      if (url === '/api/trello/sync') {
        return Promise.resolve({ data: { cards: mockCards, message: 'Synced 2 cards from Trello' } });
      } else if (url.includes('/api/trello/comment/')) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders trello integration with loading state initially', () => {
    render(
      <BrowserRouter>
        <TrelloIntegration />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders trello integration after loading', async () => {
    render(
      <BrowserRouter>
        <TrelloIntegration />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if boards and cards are displayed
    expect(screen.getByText('Trello Integration')).toBeInTheDocument();
    expect(screen.getByText('Development Board')).toBeInTheDocument();
    expect(screen.getByText('Website Redesign')).toBeInTheDocument();
    expect(screen.getByText('Content Creation')).toBeInTheDocument();
    
    // Check if sync button is present
    expect(screen.getByRole('button', { name: /Sync Cards/i })).toBeInTheDocument();
  });

  test('syncs cards when sync button is clicked', async () => {
    render(
      <BrowserRouter>
        <TrelloIntegration />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Click sync button
    userEvent.click(screen.getByRole('button', { name: /Sync Cards/i }));
    
    // Check if API was called
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/trello/sync');
    });
    
    // Check if success message is displayed
    expect(screen.getByText('Successfully synced 2 cards from Trello')).toBeInTheDocument();
  });

  test('opens card dialog when comment button is clicked', async () => {
    render(
      <BrowserRouter>
        <TrelloIntegration />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Click comment button on first card
    const commentButtons = screen.getAllByRole('button', { name: /Comment/i });
    userEvent.click(commentButtons[0]);
    
    // Check if dialog is displayed
    expect(screen.getByText('Website Redesign')).toBeInTheDocument();
    expect(screen.getByText('Post a Comment')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your comment here...')).toBeInTheDocument();
  });

  test('sends comment when send button is clicked', async () => {
    render(
      <BrowserRouter>
        <TrelloIntegration />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Click comment button on first card
    const commentButtons = screen.getAllByRole('button', { name: /Comment/i });
    userEvent.click(commentButtons[0]);
    
    // Enter comment text
    const commentInput = screen.getByPlaceholderText('Enter your comment here...');
    userEvent.type(commentInput, 'Please provide an update');
    
    // Click send button
    userEvent.click(screen.getByRole('button', { name: /Send Comment/i }));
    
    // Check if API was called
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/trello/comment/card1', {
        message: 'Please provide an update'
      });
    });
  });

  test('displays error message when API call fails', async () => {
    // Override the mock to simulate an error
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch boards'));
    
    render(
      <BrowserRouter>
        <TrelloIntegration />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Error fetching Trello boards')).toBeInTheDocument();
    });
  });
});
