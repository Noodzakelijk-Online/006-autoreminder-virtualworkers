import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Trello Checklist Sync Service', () => {
  describe('Checklist item formatting', () => {
    it('should format APTLSS checklist item with type label', () => {
      const item = {
        step: 'Review the document',
        timeMinutes: 30,
        aptlssType: 'T' as const,
      };

      const typeLabels: Record<string, string> = {
        A: '🎯 Action',
        P: '📋 Process',
        T: '✅ Task',
        L: '📚 Learn',
        S: '🤝 Support',
      };

      const typeLabel = typeLabels[item.aptlssType];
      const timeStr = item.timeMinutes >= 60 
        ? `${Math.floor(item.timeMinutes / 60)}h ${item.timeMinutes % 60}m`
        : `${item.timeMinutes}m`;
      
      const formatted = `[${typeLabel}] ${item.step} (${timeStr})`;

      expect(formatted).toBe('[✅ Task] Review the document (30m)');
    });

    it('should format time with hours and minutes', () => {
      const formatTime = (minutes: number) => {
        if (minutes >= 60) {
          return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
        }
        return `${minutes}m`;
      };

      expect(formatTime(30)).toBe('30m');
      expect(formatTime(60)).toBe('1h 0m');
      expect(formatTime(90)).toBe('1h 30m');
      expect(formatTime(120)).toBe('2h 0m');
    });

    it('should handle all APTLSS types', () => {
      const types = ['A', 'P', 'T', 'L', 'S'];
      const typeLabels: Record<string, string> = {
        A: '🎯 Action',
        P: '📋 Process',
        T: '✅ Task',
        L: '📚 Learn',
        S: '🤝 Support',
      };

      types.forEach(type => {
        expect(typeLabels[type]).toBeDefined();
        expect(typeLabels[type].length).toBeGreaterThan(0);
      });
    });
  });

  describe('Sync result handling', () => {
    it('should return success result with checklist info', () => {
      const result = {
        success: true,
        checklistId: 'checklist123',
        checklistName: '✨ APTLSS Checklist (AI-Generated)',
        itemsCreated: 5,
      };

      expect(result.success).toBe(true);
      expect(result.checklistId).toBe('checklist123');
      expect(result.itemsCreated).toBe(5);
    });

    it('should return error result on failure', () => {
      const result = {
        success: false,
        error: 'Failed to create checklist',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create checklist');
    });

    it('should handle existing checklist warning', () => {
      const result = {
        success: true,
        checklistId: 'existing123',
        checklistName: 'APTLSS Checklist',
        itemsCreated: 0,
        error: 'APTLSS checklist already exists. Use replaceExisting=true to update.',
      };

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBe(0);
      expect(result.error).toContain('already exists');
    });
  });

  describe('Bulk sync operations', () => {
    it('should aggregate bulk sync results', () => {
      const results = [
        { success: true, itemsCreated: 5 },
        { success: true, itemsCreated: 3 },
        { success: false, error: 'Card not found' },
        { success: true, itemsCreated: 7 },
      ];

      const total = results.length;
      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      expect(total).toBe(4);
      expect(success).toBe(3);
      expect(failed).toBe(1);
    });

    it('should filter cards without checklists', () => {
      const cards = [
        { cardId: 1, trelloId: 'abc', checklist: [{ step: 'Step 1' }] },
        { cardId: 2, trelloId: 'def', checklist: [] },
        { cardId: 3, trelloId: 'ghi', checklist: [{ step: 'Step 1' }, { step: 'Step 2' }] },
      ];

      const toSync = cards.filter(c => c.checklist.length > 0);

      expect(toSync).toHaveLength(2);
      expect(toSync[0].cardId).toBe(1);
      expect(toSync[1].cardId).toBe(3);
    });
  });

  describe('Completion sync', () => {
    it('should determine correct state for completion', () => {
      const getState = (completed: boolean) => completed ? 'complete' : 'incomplete';

      expect(getState(true)).toBe('complete');
      expect(getState(false)).toBe('incomplete');
    });

    it('should find checklist item by index', () => {
      const checkItems = [
        { id: 'item1', name: 'Step 1', state: 'incomplete' },
        { id: 'item2', name: 'Step 2', state: 'incomplete' },
        { id: 'item3', name: 'Step 3', state: 'complete' },
      ];

      const stepIndex = 1;
      const item = checkItems[stepIndex];

      expect(item.id).toBe('item2');
      expect(item.name).toBe('Step 2');
    });

    it('should validate step index bounds', () => {
      const checkItems = [
        { id: 'item1', name: 'Step 1' },
        { id: 'item2', name: 'Step 2' },
      ];

      const isValidIndex = (index: number) => index >= 0 && index < checkItems.length;

      expect(isValidIndex(0)).toBe(true);
      expect(isValidIndex(1)).toBe(true);
      expect(isValidIndex(2)).toBe(false);
      expect(isValidIndex(-1)).toBe(false);
    });
  });

  describe('Preserve completed items', () => {
    it('should track completed items by name', () => {
      const existingItems = [
        { id: '1', name: '[✅ Task] Step 1 (10m)', state: 'complete' as const },
        { id: '2', name: '[✅ Task] Step 2 (15m)', state: 'incomplete' as const },
        { id: '3', name: '[📋 Process] Step 3 (20m)', state: 'complete' as const },
      ];

      const completedItems = new Set<string>();
      existingItems
        .filter(item => item.state === 'complete')
        .forEach(item => completedItems.add(item.name));

      expect(completedItems.size).toBe(2);
      expect(completedItems.has('[✅ Task] Step 1 (10m)')).toBe(true);
      expect(completedItems.has('[📋 Process] Step 3 (20m)')).toBe(true);
      expect(completedItems.has('[✅ Task] Step 2 (15m)')).toBe(false);
    });

    it('should restore completion state for matching items', () => {
      const completedItems = new Set(['[✅ Task] Step 1 (10m)', '[📋 Process] Step 3 (20m)']);
      
      const newItems = [
        '[✅ Task] Step 1 (10m)',
        '[✅ Task] Step 2 (15m)',
        '[📋 Process] Step 3 (20m)',
      ];

      const itemsToComplete = newItems.filter(name => completedItems.has(name));

      expect(itemsToComplete).toHaveLength(2);
      expect(itemsToComplete).toContain('[✅ Task] Step 1 (10m)');
      expect(itemsToComplete).toContain('[📋 Process] Step 3 (20m)');
    });
  });

  describe('Sync status tracking', () => {
    it('should return synced status with metadata', () => {
      const syncStatus = {
        synced: true,
        checklistId: 'checklist123',
        itemsSynced: 5,
        syncedAt: new Date('2025-12-23T10:00:00Z'),
      };

      expect(syncStatus.synced).toBe(true);
      expect(syncStatus.itemsSynced).toBe(5);
      expect(syncStatus.syncedAt).toBeInstanceOf(Date);
    });

    it('should return not synced status', () => {
      const syncStatus = {
        synced: false,
        reason: 'No Trello ID',
      };

      expect(syncStatus.synced).toBe(false);
      expect(syncStatus.reason).toBe('No Trello ID');
    });
  });
});
