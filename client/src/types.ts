export interface Task {
  id: string;
  cardId: string;
  cardName: string;
  checklistId?: string;
  checkItemId?: string;
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
  // ATIS AI-enhanced fields
  goal?: string;
  deliverable?: string;
  taskType?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  boardName?: string;
  listName?: string;
  url?: string;
  checklist?: ChecklistItem[];
  hasUnderstanding?: boolean;
  confidenceScore?: number;
  atisCardId?: number;
  synced?: boolean;
}

export interface ChecklistItem {
  id: string;
  step: string;
  timeMinutes: number;
  aptlssType: 'A' | 'P' | 'T' | 'L' | 'S';
  completed: boolean;
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
