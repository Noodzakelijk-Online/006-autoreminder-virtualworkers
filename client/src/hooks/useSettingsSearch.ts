import { useMemo } from 'react';
import { SearchResult } from '@/components/SettingsSearch';

// Define all searchable settings
const SEARCHABLE_SETTINGS: SearchResult[] = [
  // Integration & Automation Section
  {
    section: 'Integration & Automation',
    tab: 'Trello Chatbot',
    title: 'Trello Chatbot Configuration',
    description: 'Configure Trello chatbot settings and webhooks',
    category: 'tab',
  },
  {
    section: 'Integration & Automation',
    tab: 'Trello Chatbot',
    title: 'Webhook Setup',
    description: 'Set up and manage Trello webhook endpoints',
    category: 'setting',
  },
  {
    section: 'Integration & Automation',
    tab: 'Trello Chatbot',
    title: 'Test Webhook',
    description: 'Test webhook connectivity and response',
    category: 'setting',
  },
  {
    section: 'Integration & Automation',
    tab: 'Trello Chatbot',
    title: 'Analytics',
    description: 'View chatbot usage and performance analytics',
    category: 'setting',
  },
  {
    section: 'Integration & Automation',
    tab: 'Notifications',
    title: 'Notification Settings',
    description: 'Configure notification preferences',
    category: 'tab',
  },
  {
    section: 'Integration & Automation',
    tab: 'Notifications',
    title: 'Email Notifications',
    description: 'Enable or disable email notifications',
    category: 'setting',
  },
  {
    section: 'Integration & Automation',
    tab: 'Notifications',
    title: 'Task Alerts',
    description: 'Configure task-related alerts',
    category: 'setting',
  },
  {
    section: 'Integration & Automation',
    tab: 'AI & Models',
    title: 'AI Provider Settings',
    description: 'Select and configure AI models',
    category: 'tab',
  },
  {
    section: 'Integration & Automation',
    tab: 'AI & Models',
    title: 'Model Selection',
    description: 'Choose between different AI providers (Groq, Together, OpenRouter, Ollama)',
    category: 'setting',
  },
  {
    section: 'Integration & Automation',
    tab: 'AI & Models',
    title: 'API Keys',
    description: 'Manage API keys for AI providers',
    category: 'setting',
  },

  // Scheduling & Time Section
  {
    section: 'Scheduling & Time',
    tab: 'Working Hours',
    title: 'Working Hours Configuration',
    description: 'Set your working hours schedule',
    category: 'tab',
  },
  {
    section: 'Scheduling & Time',
    tab: 'Working Hours',
    title: 'Daily Schedule',
    description: 'Configure daily work schedule',
    category: 'setting',
  },
  {
    section: 'Scheduling & Time',
    tab: 'Working Hours',
    title: 'Time Zone',
    description: 'Set your time zone for scheduling',
    category: 'setting',
  },
  {
    section: 'Scheduling & Time',
    tab: 'Holidays & Days Off',
    title: 'Holiday Management',
    description: 'Manage holidays and days off',
    category: 'tab',
  },
  {
    section: 'Scheduling & Time',
    tab: 'Holidays & Days Off',
    title: 'Add Holiday',
    description: 'Add new holidays to your calendar',
    category: 'setting',
  },
  {
    section: 'Scheduling & Time',
    tab: 'Holidays & Days Off',
    title: 'Country Selection',
    description: 'Select country for holiday calendar',
    category: 'setting',
  },

  // Performance & Monitoring Section
  {
    section: 'Performance & Monitoring',
    tab: 'System Health',
    title: 'Overall System Health',
    description: 'Monitor overall system health and status',
    category: 'setting',
  },
  {
    section: 'Performance & Monitoring',
    tab: 'System Health',
    title: 'Health Recommendations',
    description: 'View system health recommendations',
    category: 'setting',
  },
  {
    section: 'Performance & Monitoring',
    tab: 'Cache Performance',
    title: 'Cache Statistics',
    description: 'View database cache performance metrics',
    category: 'setting',
  },
  {
    section: 'Performance & Monitoring',
    tab: 'Cache Performance',
    title: 'Cache Hit Rate',
    description: 'Monitor cache hit rate and efficiency',
    category: 'setting',
  },
  {
    section: 'Performance & Monitoring',
    tab: 'Request Queue',
    title: 'Queue Statistics',
    description: 'View request queue performance',
    category: 'setting',
  },
  {
    section: 'Performance & Monitoring',
    tab: 'Request Queue',
    title: 'Deduplication Stats',
    description: 'Monitor request deduplication metrics',
    category: 'setting',
  },
  {
    section: 'Performance & Monitoring',
    tab: 'WebSocket Status',
    title: 'WebSocket Connections',
    description: 'Monitor real-time WebSocket connections',
    category: 'setting',
  },
];

export function useSettingsSearch(query: string): SearchResult[] {
  return useMemo(() => {
    if (!query.trim()) return [];

    const normalizedQuery = query.toLowerCase();

    return SEARCHABLE_SETTINGS.filter((setting) => {
      const searchableText = [
        setting.title,
        setting.description,
        setting.tab,
        setting.section,
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    }).sort((a, b) => {
      // Prioritize exact matches in title
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();

      if (aTitle.includes(normalizedQuery) && !bTitle.includes(normalizedQuery)) {
        return -1;
      }
      if (!aTitle.includes(normalizedQuery) && bTitle.includes(normalizedQuery)) {
        return 1;
      }

      // Then prioritize tabs over settings
      if (a.category === 'tab' && b.category !== 'tab') {
        return -1;
      }
      if (a.category !== 'tab' && b.category === 'tab') {
        return 1;
      }

      return 0;
    });
  }, [query]);
}
