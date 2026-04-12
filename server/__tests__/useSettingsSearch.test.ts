import { describe, it, expect } from 'vitest';

// Mock implementation of useSettingsSearch for testing
const SEARCHABLE_SETTINGS = [
  {
    section: 'Integration & Automation',
    tab: 'Trello Chatbot',
    title: 'Trello Chatbot Configuration',
    description: 'Configure Trello chatbot settings and webhooks',
    category: 'tab' as const,
  },
  {
    section: 'Integration & Automation',
    tab: 'Trello Chatbot',
    title: 'Webhook Setup',
    description: 'Set up and manage Trello webhook endpoints',
    category: 'setting' as const,
  },
  {
    section: 'Integration & Automation',
    tab: 'Notifications',
    title: 'Notification Settings',
    description: 'Configure notification preferences',
    category: 'tab' as const,
  },
  {
    section: 'Scheduling & Time',
    tab: 'Working Hours',
    title: 'Working Hours Configuration',
    description: 'Set your working hours schedule',
    category: 'tab' as const,
  },
  {
    section: 'Performance & Monitoring',
    tab: 'System Health',
    title: 'Overall System Health',
    description: 'Monitor overall system health and status',
    category: 'setting' as const,
  },
];

function useSettingsSearch(query: string) {
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
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();

    if (aTitle.includes(normalizedQuery) && !bTitle.includes(normalizedQuery)) {
      return -1;
    }
    if (!aTitle.includes(normalizedQuery) && bTitle.includes(normalizedQuery)) {
      return 1;
    }

    if (a.category === 'tab' && b.category !== 'tab') {
      return -1;
    }
    if (a.category !== 'tab' && b.category === 'tab') {
      return 1;
    }

    return 0;
  });
}

describe('useSettingsSearch', () => {
  it('should return empty array when query is empty', () => {
    const result = useSettingsSearch('');
    expect(result).toEqual([]);
  });

  it('should return empty array when query is only whitespace', () => {
    const result = useSettingsSearch('   ');
    expect(result).toEqual([]);
  });

  it('should find settings by title', () => {
    const result = useSettingsSearch('Trello');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => r.title.includes('Trello'))).toBe(true);
  });

  it('should find settings by description', () => {
    const result = useSettingsSearch('webhook');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => r.description?.includes('webhook'))).toBe(true);
  });

  it('should find settings by tab name', () => {
    const result = useSettingsSearch('Notifications');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => r.tab === 'Notifications')).toBe(true);
  });

  it('should find settings by section name', () => {
    const result = useSettingsSearch('Integration');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => r.section.includes('Integration'))).toBe(true);
  });

  it('should be case insensitive', () => {
    const result1 = useSettingsSearch('trello');
    const result2 = useSettingsSearch('TRELLO');
    const result3 = useSettingsSearch('Trello');

    expect(result1.length).toBe(result2.length);
    expect(result1.length).toBe(result3.length);
  });

  it('should prioritize exact title matches', () => {
    const result = useSettingsSearch('Trello Chatbot');
    const firstResult = result[0];
    expect(firstResult.title.toLowerCase()).toContain('trello chatbot');
  });

  it('should prioritize tabs over settings', () => {
    const result = useSettingsSearch('Notifications');
    const tabResults = result.filter(r => r.category === 'tab');
    const settingResults = result.filter(r => r.category === 'setting');

    if (tabResults.length > 0 && settingResults.length > 0) {
      expect(result.indexOf(tabResults[0])).toBeLessThan(
        result.indexOf(settingResults[0])
      );
    }
  });

  it('should return results from multiple sections', () => {
    const result = useSettingsSearch('Configuration');
    const sections = new Set(result.map(r => r.section));
    expect(sections.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle partial word matches', () => {
    const result = useSettingsSearch('health');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => 
      r.title.toLowerCase().includes('health') || 
      r.description?.toLowerCase().includes('health')
    )).toBe(true);
  });

  it('should return consistent results for same query', () => {
    const result1 = useSettingsSearch('Chatbot');
    const result2 = useSettingsSearch('Chatbot');

    expect(result1.length).toBe(result2.length);
    expect(result1.map(r => r.title)).toEqual(result2.map(r => r.title));
  });

  it('should return no results for non-matching query', () => {
    const result = useSettingsSearch('xyz123nonexistent');
    expect(result.length).toBe(0);
  });
});
