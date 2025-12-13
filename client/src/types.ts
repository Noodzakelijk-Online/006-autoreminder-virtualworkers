export interface Task {
  id: string;
  cardId: string;
  cardName: string;
  stepIndex: number;
  description: string;
  durationHours: number;
  startTime: string;
  endTime: string;
  date: string;
  isCompleted: boolean;
  isArchived?: boolean;
  isBlocker: boolean;
  isPriority: boolean;
  priorityLevel: 'CRITICAL' | 'URGENT' | 'HIGH' | 'NORMAL';
  hasDutch: boolean;
  dutchPercentage?: number;
  attachments: Attachment[];
}

export interface Attachment {
  name: string;
  url: string;
  type: 'pdf' | 'doc' | 'image' | 'other';
}

export interface DaySchedule {
  date: string;
  tasks: Task[];
  totalHours: number;
  completedHours: number;
}

export interface WeeklyStats {
  totalTasks: number;
  completedTasks: number;
  totalHours: number;
  completedHours: number;
  accuracy: number;
}
