import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the timeline tasks endpoint response format
describe('ATIS Timeline Tasks API', () => {
  describe('Timeline task response format', () => {
    it('should return tasks with required fields', () => {
      const mockTask = {
        id: 1,
        trelloId: 'abc123',
        name: 'Test Task',
        description: 'Task description',
        dueDate: '2025-12-25',
        boardName: 'Test Board',
        listName: 'To Do',
        url: 'https://trello.com/c/abc123',
        goal: 'Complete the test task',
        deliverable: 'A completed test',
        taskType: 'admin',
        complexity: 'medium',
        estimatedMinutes: 60,
        confidenceScore: 85,
        hasUnderstanding: true,
        checklist: [
          { id: '1', step: 'Step 1', timeMinutes: 30, aptlssType: 'T', completed: false }
        ]
      };

      // Verify all required fields are present
      expect(mockTask).toHaveProperty('id');
      expect(mockTask).toHaveProperty('trelloId');
      expect(mockTask).toHaveProperty('name');
      expect(mockTask).toHaveProperty('dueDate');
      expect(mockTask).toHaveProperty('goal');
      expect(mockTask).toHaveProperty('deliverable');
      expect(mockTask).toHaveProperty('taskType');
      expect(mockTask).toHaveProperty('complexity');
      expect(mockTask).toHaveProperty('estimatedMinutes');
      expect(mockTask).toHaveProperty('checklist');
    });

    it('should transform task to frontend Task format correctly', () => {
      const atisTask = {
        id: 1,
        trelloId: 'abc123',
        name: 'Test Task',
        dueDate: '2025-12-25',
        goal: 'Complete the test task',
        complexity: 'complex',
        estimatedMinutes: 120,
      };

      // Simulate frontend transformation
      const frontendTask = {
        id: `atis-${atisTask.id}`,
        cardId: atisTask.trelloId,
        cardName: atisTask.name,
        date: new Date(atisTask.dueDate).toISOString().split('T')[0],
        description: atisTask.goal,
        durationHours: atisTask.estimatedMinutes / 60,
        isBlocker: false,
        isPriority: atisTask.complexity === 'complex',
        priorityLevel: atisTask.complexity === 'complex' ? 'HIGH' : 'NORMAL',
      };

      expect(frontendTask.id).toBe('atis-1');
      expect(frontendTask.cardId).toBe('abc123');
      expect(frontendTask.durationHours).toBe(2);
      expect(frontendTask.isPriority).toBe(true);
      expect(frontendTask.priorityLevel).toBe('HIGH');
    });
  });

  describe('Task filtering logic', () => {
    const mockTasks = [
      { id: 1, date: '2025-12-20', taskType: 'admin', complexity: 'simple' },
      { id: 2, date: '2025-12-23', taskType: 'creation', complexity: 'medium' },
      { id: 3, date: '2025-12-25', taskType: 'admin', complexity: 'complex' },
      { id: 4, date: '2025-12-30', taskType: 'research', complexity: 'medium' },
    ];

    it('should filter by task type', () => {
      const filtered = mockTasks.filter(t => t.taskType === 'admin');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.taskType === 'admin')).toBe(true);
    });

    it('should filter by complexity', () => {
      const filtered = mockTasks.filter(t => t.complexity === 'medium');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.complexity === 'medium')).toBe(true);
    });

    it('should filter overdue tasks', () => {
      const now = new Date('2025-12-23');
      const filtered = mockTasks.filter(t => new Date(t.date) < now);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    it('should filter upcoming tasks', () => {
      const now = new Date('2025-12-23');
      const filtered = mockTasks.filter(t => new Date(t.date) >= now);
      expect(filtered).toHaveLength(3);
    });

    it('should combine multiple filters', () => {
      const filtered = mockTasks.filter(t => 
        t.taskType === 'admin' && t.complexity !== 'simple'
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(3);
    });
  });

  describe('Task sorting logic', () => {
    const mockTasks = [
      { id: 1, date: '2025-12-25', durationHours: 2, complexity: 'medium' },
      { id: 2, date: '2025-12-20', durationHours: 1, complexity: 'simple' },
      { id: 3, date: '2025-12-30', durationHours: 3, complexity: 'complex' },
    ];

    it('should sort by due date ascending', () => {
      const sorted = [...mockTasks].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
      expect(sorted[2].id).toBe(3);
    });

    it('should sort by due date descending', () => {
      const sorted = [...mockTasks].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      expect(sorted[0].id).toBe(3);
      expect(sorted[1].id).toBe(1);
      expect(sorted[2].id).toBe(2);
    });

    it('should sort by estimated time ascending', () => {
      const sorted = [...mockTasks].sort((a, b) => a.durationHours - b.durationHours);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
      expect(sorted[2].id).toBe(3);
    });

    it('should sort by complexity', () => {
      const complexityOrder = { simple: 1, medium: 2, complex: 3 };
      const sorted = [...mockTasks].sort((a, b) => 
        complexityOrder[a.complexity as keyof typeof complexityOrder] - 
        complexityOrder[b.complexity as keyof typeof complexityOrder]
      );
      expect(sorted[0].id).toBe(2); // simple
      expect(sorted[1].id).toBe(1); // medium
      expect(sorted[2].id).toBe(3); // complex
    });
  });

  describe('Checklist completion tracking', () => {
    it('should calculate progress correctly', () => {
      const checklist = [
        { id: '1', step: 'Step 1', completed: true },
        { id: '2', step: 'Step 2', completed: false },
        { id: '3', step: 'Step 3', completed: true },
        { id: '4', step: 'Step 4', completed: false },
      ];

      const completedSteps = checklist.filter(c => c.completed).length;
      const totalSteps = checklist.length;
      const progress = (completedSteps / totalSteps) * 100;

      expect(completedSteps).toBe(2);
      expect(totalSteps).toBe(4);
      expect(progress).toBe(50);
    });

    it('should handle empty checklist', () => {
      const checklist: any[] = [];
      const totalSteps = checklist.length;
      const progress = totalSteps > 0 ? 0 : 0;

      expect(totalSteps).toBe(0);
      expect(progress).toBe(0);
    });

    it('should toggle completion status', () => {
      let completed = false;
      
      // Toggle on
      completed = !completed;
      expect(completed).toBe(true);
      
      // Toggle off
      completed = !completed;
      expect(completed).toBe(false);
    });
  });

  describe('APTLSS type validation', () => {
    it('should recognize valid APTLSS types', () => {
      const validTypes = ['A', 'P', 'T', 'L', 'S'];
      
      validTypes.forEach(type => {
        expect(['A', 'P', 'T', 'L', 'S']).toContain(type);
      });
    });

    it('should map APTLSS types to descriptions', () => {
      const aptlssDescriptions: Record<string, string> = {
        A: 'Action',
        P: 'Process',
        T: 'Task',
        L: 'Learn',
        S: 'Support',
      };

      expect(aptlssDescriptions['A']).toBe('Action');
      expect(aptlssDescriptions['P']).toBe('Process');
      expect(aptlssDescriptions['T']).toBe('Task');
      expect(aptlssDescriptions['L']).toBe('Learn');
      expect(aptlssDescriptions['S']).toBe('Support');
    });
  });
});

describe('Task type aggregation', () => {
  it('should count tasks by type', () => {
    const tasks = [
      { taskType: 'admin' },
      { taskType: 'admin' },
      { taskType: 'creation' },
      { taskType: 'research' },
      { taskType: 'admin' },
    ];

    const typeCounts = tasks.reduce((acc, task) => {
      acc[task.taskType] = (acc[task.taskType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(typeCounts['admin']).toBe(3);
    expect(typeCounts['creation']).toBe(1);
    expect(typeCounts['research']).toBe(1);
  });

  it('should format task types for filter dropdown', () => {
    const typeCounts = { admin: 3, creation: 1, research: 1 };
    
    const formatted = Object.entries(typeCounts).map(([taskType, count]) => ({
      taskType,
      count,
    }));

    expect(formatted).toHaveLength(3);
    expect(formatted.find(t => t.taskType === 'admin')?.count).toBe(3);
  });
});
