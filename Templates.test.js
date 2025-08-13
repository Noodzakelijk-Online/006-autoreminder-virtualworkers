import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Templates from '../pages/Templates';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('Templates Component', () => {
  const mockTemplates = [
    {
      _id: '1',
      name: 'Email Reminder',
      type: 'email',
      subject: 'Task Reminder',
      content: 'Hello {{username}}, please update your card {{cardName}}.',
      variables: ['username', 'cardName']
    },
    {
      _id: '2',
      name: 'Trello Comment',
      type: 'trello',
      content: '@{{username}} Please provide an update on this card.',
      variables: ['username']
    }
  ];

  beforeEach(() => {
    // Mock the API responses
    axios.get.mockResolvedValue({ data: mockTemplates });
    axios.post.mockResolvedValue({ data: { ...mockTemplates[0], _id: '3' } });
    axios.put.mockResolvedValue({ data: mockTemplates[0] });
    axios.delete.mockResolvedValue({ data: { message: 'Template deleted' } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders templates with loading state initially', () => {
    render(
      <BrowserRouter>
        <Templates />
      </BrowserRouter>
    );
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders templates after loading', async () => {
    render(
      <BrowserRouter>
        <Templates />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if templates are displayed
    expect(screen.getByText('Notification Templates')).toBeInTheDocument();
    expect(screen.getByText('Email Reminder')).toBeInTheDocument();
    expect(screen.getByText('Trello Comment')).toBeInTheDocument();
    
    // Check if add button is present
    expect(screen.getByRole('button', { name: /Add Template/i })).toBeInTheDocument();
  });

  test('opens dialog when add button is clicked', async () => {
    render(
      <BrowserRouter>
        <Templates />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Click add button
    userEvent.click(screen.getByRole('button', { name: /Add Template/i }));
    
    // Check if dialog is displayed
    expect(screen.getByText('Create Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Content')).toBeInTheDocument();
  });

  test('opens edit dialog when edit button is clicked', async () => {
    render(
      <BrowserRouter>
        <Templates />
      </BrowserRouter>
    );
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Find and click the first edit button
    const editButtons = screen.getAllByRole('button', { name: '' });
    const editButton = editButtons.find(button => button.querySelector('svg[data-testid="EditIcon"]'));
    userEvent.click(editButton);
    
    // Check if dialog is displayed with template data
    expect(screen.getByText('Edit Template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Email Reminder')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Task Reminder')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hello {{username}}, please update your card {{cardName}}.')).toBeInTheDocument();
  });

  test('displays error message when API call fails', async () => {
    // Override the mock to simulate an error
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch templates'));
    
    render(
      <BrowserRouter>
        <Templates />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Error fetching templates')).toBeInTheDocument();
    });
  });
});
