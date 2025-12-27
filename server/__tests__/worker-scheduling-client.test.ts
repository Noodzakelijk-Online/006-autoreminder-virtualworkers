import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Worker-Specific Scheduling', () => {
  describe('Worker Settings Map', () => {
    it('should create worker settings map from vaProfiles', () => {
      // Mock worker profiles
      const workerProfiles = [
        {
          id: 1,
          workStartHour: 8,
          workEndHour: 16,
          workingDays: '1,2,3,4,5',
          lunchTime: '12:00',
          lunchDuration: 45,
          breakfastTime: null,
          breakfastDuration: null,
          dinnerTime: null,
          dinnerDuration: null,
        },
        {
          id: 2,
          workStartHour: 10,
          workEndHour: 19,
          workingDays: '1,2,3,4,5,6',
          lunchTime: '13:00',
          lunchDuration: 60,
          breakfastTime: '09:30',
          breakfastDuration: 15,
          dinnerTime: '18:00',
          dinnerDuration: 30,
        },
      ];

      // Build worker settings map (simulating the logic in aptlss.ts)
      const workerSettingsMap = new Map();
      for (const worker of workerProfiles) {
        const workingDays = worker.workingDays
          .split(',')
          .filter((d: string) => d)
          .map((d: string) => parseInt(d));

        const parseTimeToHour = (timeStr: string | null): number | undefined => {
          if (!timeStr) return undefined;
          const parts = timeStr.split(':');
          return parseInt(parts[0], 10);
        };

        const schedulingOptions: any = {};
        if (worker.lunchTime) {
          schedulingOptions.lunchBreakStart = parseTimeToHour(worker.lunchTime);
          schedulingOptions.lunchBreakDuration = worker.lunchDuration || 60;
        }
        if (worker.breakfastTime) {
          schedulingOptions.breakfastBreakStart = parseTimeToHour(worker.breakfastTime);
          schedulingOptions.breakfastBreakDuration = worker.breakfastDuration || 30;
        }
        if (worker.dinnerTime) {
          schedulingOptions.dinnerBreakStart = parseTimeToHour(worker.dinnerTime);
          schedulingOptions.dinnerBreakDuration = worker.dinnerDuration || 30;
        }

        workerSettingsMap.set(worker.id, {
          workStartHour: worker.workStartHour,
          workEndHour: worker.workEndHour,
          workingDays,
          schedulingOptions,
        });
      }

      // Verify worker 1 settings
      const worker1 = workerSettingsMap.get(1);
      expect(worker1).toBeDefined();
      expect(worker1.workStartHour).toBe(8);
      expect(worker1.workEndHour).toBe(16);
      expect(worker1.workingDays).toEqual([1, 2, 3, 4, 5]);
      expect(worker1.schedulingOptions.lunchBreakStart).toBe(12);
      expect(worker1.schedulingOptions.lunchBreakDuration).toBe(45);

      // Verify worker 2 settings
      const worker2 = workerSettingsMap.get(2);
      expect(worker2).toBeDefined();
      expect(worker2.workStartHour).toBe(10);
      expect(worker2.workEndHour).toBe(19);
      expect(worker2.workingDays).toEqual([1, 2, 3, 4, 5, 6]);
      expect(worker2.schedulingOptions.lunchBreakStart).toBe(13);
      expect(worker2.schedulingOptions.breakfastBreakStart).toBe(9);
      expect(worker2.schedulingOptions.dinnerBreakStart).toBe(18);
    });

    it('should fall back to default settings when worker not found', () => {
      const workerSettingsMap = new Map();
      const defaultSettings = {
        workStartHour: 9,
        workEndHour: 18,
        workingDays: [1, 2, 3, 4, 5],
      };

      // Simulate getting effective settings
      const workerId = 999; // Non-existent worker
      const effectiveSettings = workerSettingsMap.get(workerId) || defaultSettings;

      expect(effectiveSettings.workStartHour).toBe(9);
      expect(effectiveSettings.workEndHour).toBe(18);
      expect(effectiveSettings.workingDays).toEqual([1, 2, 3, 4, 5]);
    });
  });
});

describe('Client Extraction', () => {
  // Simulating the extractClient function from aptlss.ts
  const extractClient = (boardName: string, cardName: string): string | undefined => {
    // Try board name first (most reliable)
    const boardParts = boardName.split(/\s*[|\-\/]\s*/);
    if (boardParts.length >= 2) {
      const potentialClient = boardParts[0].trim();
      if (potentialClient.length > 2 && !/^\d/.test(potentialClient) && 
          !['personal', 'internal', 'admin', 'general'].includes(potentialClient.toLowerCase())) {
        return potentialClient;
      }
      if (boardParts.length >= 3 && boardParts[1].trim().length > 2) {
        return boardParts[1].trim();
      }
    }
    
    // Try card name as fallback
    const cardParts = cardName.split(/\s*[|\-\/]\s*/);
    if (cardParts.length >= 2) {
      const potentialClient = cardParts[0].trim();
      if (potentialClient.length > 2 && !/^\d/.test(potentialClient)) {
        return potentialClient;
      }
    }
    
    // Extract from common patterns
    const bracketMatch = cardName.match(/^\[([^\]]+)\]/);
    if (bracketMatch) return bracketMatch[1].trim();
    
    const colonMatch = cardName.match(/^([^:]+):/);
    if (colonMatch && colonMatch[1].length > 2 && colonMatch[1].length < 30) {
      return colonMatch[1].trim();
    }
    
    return undefined;
  };

  describe('Board name patterns', () => {
    it('should extract client from "Client | Project" pattern', () => {
      expect(extractClient('Acme Corp | Website Redesign', 'Task 1')).toBe('Acme Corp');
    });

    it('should extract client from "Client - Project" pattern', () => {
      expect(extractClient('TechStart - Mobile App', 'Task 1')).toBe('TechStart');
    });

    it('should extract client from "Client / Project" pattern', () => {
      expect(extractClient('GlobalBank / API Integration', 'Task 1')).toBe('GlobalBank');
    });

    it('should skip short codes and use second part', () => {
      expect(extractClient('NO | 1.0. | ClientName | Project', 'Task 1')).toBe('1.0.');
    });

    it('should skip "Personal" as client', () => {
      expect(extractClient('Personal | My Tasks', 'Task 1')).toBeUndefined();
    });

    it('should skip "Internal" as client', () => {
      expect(extractClient('Internal | Admin Tasks', 'Task 1')).toBeUndefined();
    });
  });

  describe('Card name patterns', () => {
    it('should extract client from "[Client] Task" pattern', () => {
      expect(extractClient('General Board', '[ClientX] Update homepage')).toBe('ClientX');
    });

    it('should extract client from "Client: Task" pattern', () => {
      expect(extractClient('General Board', 'BigCorp: Fix login issue')).toBe('BigCorp');
    });

    it('should not extract very short client names', () => {
      expect(extractClient('General Board', 'AB: Task')).toBeUndefined();
    });

    it('should not extract very long client names from colon pattern', () => {
      const longName = 'A'.repeat(35);
      expect(extractClient('General Board', `${longName}: Task`)).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should return undefined for simple board/card names', () => {
      expect(extractClient('My Tasks', 'Complete report')).toBeUndefined();
    });

    it('should handle empty strings', () => {
      expect(extractClient('', '')).toBeUndefined();
    });

    it('should prefer board name over card name', () => {
      expect(extractClient('BoardClient | Project', '[CardClient] Task')).toBe('BoardClient');
    });
  });
});

describe('Task Filters with Client', () => {
  it('should filter tasks by client', () => {
    const tasks = [
      { id: '1', client: 'Acme Corp', description: 'Task 1' },
      { id: '2', client: 'TechStart', description: 'Task 2' },
      { id: '3', client: 'Acme Corp', description: 'Task 3' },
      { id: '4', client: undefined, description: 'Task 4' },
    ];

    const clientFilter = 'Acme Corp';
    const filtered = tasks.filter(t => t.client === clientFilter);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe('1');
    expect(filtered[1].id).toBe('3');
  });

  it('should sort tasks by client', () => {
    const tasks = [
      { id: '1', client: 'Zebra Inc', description: 'Task 1' },
      { id: '2', client: 'Acme Corp', description: 'Task 2' },
      { id: '3', client: undefined, description: 'Task 3' },
      { id: '4', client: 'TechStart', description: 'Task 4' },
    ];

    const sorted = [...tasks].sort((a, b) => {
      const clientA = a.client || 'zzz';
      const clientB = b.client || 'zzz';
      return clientA.localeCompare(clientB);
    });

    expect(sorted[0].client).toBe('Acme Corp');
    expect(sorted[1].client).toBe('TechStart');
    expect(sorted[2].client).toBe('Zebra Inc');
    expect(sorted[3].client).toBeUndefined(); // Tasks without client at end
  });

  it('should extract unique clients with counts', () => {
    const tasks = [
      { client: 'Acme Corp' },
      { client: 'TechStart' },
      { client: 'Acme Corp' },
      { client: 'Acme Corp' },
      { client: undefined },
      { client: 'TechStart' },
    ];

    const clientCounts = new Map<string, number>();
    tasks.forEach(t => {
      if (t.client) {
        clientCounts.set(t.client, (clientCounts.get(t.client) || 0) + 1);
      }
    });

    const clientsList = Array.from(clientCounts.entries())
      .map(([client, count]) => ({ client, count }))
      .sort((a, b) => b.count - a.count);

    expect(clientsList).toHaveLength(2);
    expect(clientsList[0]).toEqual({ client: 'Acme Corp', count: 3 });
    expect(clientsList[1]).toEqual({ client: 'TechStart', count: 2 });
  });
});
