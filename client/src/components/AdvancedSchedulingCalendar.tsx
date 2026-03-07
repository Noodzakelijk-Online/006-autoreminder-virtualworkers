import React, { useState, useCallback, useMemo } from 'react';
import { format, addDays, startOfDay, endOfDay, eachHourOfDay, isSameDay, parse } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ChevronLeft, ChevronRight, Undo2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Task {
  id: string;
  title: string;
  cardTrelloId?: string;
  startTime: Date;
  endTime: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  complexity?: number;
  status: 'pending' | 'in-progress' | 'completed';
}

interface ScheduleHistoryRecord {
  id: string;
  taskId: string;
  previousStartTime?: Date;
  previousEndTime?: Date;
  newStartTime: Date;
  newEndTime: Date;
  reason?: string;
  hadConflicts: boolean;
  conflictDetails?: string;
  createdAt: Date;
}

interface AdvancedSchedulingCalendarProps {
  tasks: Task[];
  onTaskReschedule: (taskId: string, newStartTime: Date, newEndTime: Date, reason?: string) => Promise<void>;
  onUndo: (taskId: string) => Promise<void>;
  scheduleHistory?: ScheduleHistoryRecord[];
  isLoading?: boolean;
  onConflictDetected?: (conflicts: any[]) => void;
}

const HOURS = eachHourOfDay(new Date()).map(h => format(h, 'HH:00'));
const HOUR_HEIGHT = 60; // pixels per hour

export const AdvancedSchedulingCalendar: React.FC<AdvancedSchedulingCalendarProps> = ({
  tasks,
  onTaskReschedule,
  onUndo,
  scheduleHistory = [],
  isLoading = false,
  onConflictDetected
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [rescheduleLoading, setRescheduleLoading] = useState<string | null>(null);
  const [undoLoading, setUndoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get tasks for the current week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(startOfDay(currentDate), i));
  }, [currentDate]);

  // Get tasks for each day
  const tasksByDay = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      grouped[dayKey] = tasks.filter(task => 
        isSameDay(new Date(task.startTime), day)
      );
    });
    return grouped;
  }, [tasks, weekDays]);

  // Detect conflicts for a given time range
  const detectConflicts = useCallback((dayKey: string, startHour: number, endHour: number, excludeTaskId?: string) => {
    const dayTasks = tasksByDay[dayKey] || [];
    return dayTasks.filter(task => {
      if (excludeTaskId && task.id === excludeTaskId) return false;
      
      const taskStartHour = new Date(task.startTime).getHours();
      const taskEndHour = new Date(task.endTime).getHours();
      
      // Check for overlap
      return !(endHour <= taskStartHour || startHour >= taskEndHour);
    });
  }, [tasksByDay]);

  // Handle drag start
  const handleDragStart = (task: Task, e: React.DragEvent) => {
    setDraggedTask(task);
    setDragOffset(e.clientY);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = async (dayKey: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTask) return;

    try {
      setError(null);
      setSuccessMessage(null);
      setRescheduleLoading(draggedTask.id);

      // Calculate new time based on drop position
      const calendarRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const dropY = e.clientY - calendarRect.top;
      const hourIndex = Math.floor(dropY / HOUR_HEIGHT);
      const clampedHour = Math.max(0, Math.min(23, hourIndex));

      const newDate = parse(dayKey, 'yyyy-MM-dd', new Date());
      const newStartTime = new Date(newDate);
      newStartTime.setHours(clampedHour, 0, 0, 0);

      const newEndTime = new Date(newStartTime);
      const durationHours = (new Date(draggedTask.endTime).getTime() - new Date(draggedTask.startTime).getTime()) / (1000 * 60 * 60);
      newEndTime.setHours(newEndTime.getHours() + durationHours);

      // Check for conflicts
      const conflicts = detectConflicts(dayKey, clampedHour, clampedHour + durationHours, draggedTask.id);
      if (conflicts.length > 0) {
        onConflictDetected?.(conflicts);
        setError(`Warning: ${conflicts.length} task(s) conflict with this time slot`);
      }

      // Call the reschedule handler
      await onTaskReschedule(draggedTask.id, newStartTime, newEndTime, 'Drag-and-drop reschedule');
      setSuccessMessage(`Task "${draggedTask.title}" rescheduled successfully`);

      setDraggedTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule task');
    } finally {
      setRescheduleLoading(null);
    }
  };

  // Handle undo
  const handleUndo = async (taskId: string) => {
    try {
      setError(null);
      setSuccessMessage(null);
      setUndoLoading(taskId);
      await onUndo(taskId);
      setSuccessMessage('Schedule restored to previous state');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo reschedule');
    } finally {
      setUndoLoading(null);
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Render task block
  const renderTaskBlock = (task: Task, dayKey: string) => {
    const startHour = new Date(task.startTime).getHours();
    const endHour = new Date(task.endTime).getHours();
    const durationHours = endHour - startHour;
    const topPosition = startHour * HOUR_HEIGHT;
    const height = Math.max(durationHours * HOUR_HEIGHT, 40);

    const hasHistory = scheduleHistory.some(h => h.taskId === task.id);

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(task, e)}
        className={`absolute left-1 right-1 p-2 rounded border-l-4 cursor-move hover:shadow-lg transition-shadow ${getPriorityColor(task.priority)} ${
          draggedTask?.id === task.id ? 'opacity-50' : ''
        }`}
        style={{
          top: `${topPosition}px`,
          height: `${height}px`,
          borderLeftWidth: '4px'
        }}
      >
        <div className="text-xs font-semibold truncate">{task.title}</div>
        <div className="text-xs opacity-75">
          {format(new Date(task.startTime), 'HH:mm')} - {format(new Date(task.endTime), 'HH:mm')}
        </div>
        {hasHistory && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 h-6 px-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleUndo(task.id);
            }}
            disabled={undoLoading === task.id}
          >
            {undoLoading === task.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Undo2 className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Advanced Scheduling Calendar</CardTitle>
            <CardDescription>Drag tasks to reschedule them</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(addDays(currentDate, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(addDays(currentDate, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
          </Alert>
        )}

        {isLoading || rescheduleLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header with day names */}
              <div className="flex gap-1 mb-2">
                <div className="w-16 flex-shrink-0" /> {/* Time column */}
                {weekDays.map(day => (
                  <div key={format(day, 'yyyy-MM-dd')} className="flex-1 min-w-[150px]">
                    <div className="text-center font-semibold text-sm">
                      {format(day, 'EEE')}
                    </div>
                    <div className="text-center text-xs text-muted-foreground">
                      {format(day, 'MMM d')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="flex gap-1 border rounded-lg overflow-hidden">
                {/* Time column */}
                <div className="w-16 flex-shrink-0 bg-gray-50 border-r">
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="text-xs text-muted-foreground text-center font-medium"
                      style={{ height: `${HOUR_HEIGHT}px`, lineHeight: `${HOUR_HEIGHT}px` }}
                    >
                      {hour}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map(day => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDay[dayKey] || [];

                  return (
                    <div
                      key={dayKey}
                      className="flex-1 min-w-[150px] border-r relative bg-white"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(dayKey, e)}
                    >
                      {/* Hour grid lines */}
                      {HOURS.map((hour, idx) => (
                        <div
                          key={hour}
                          className="border-b"
                          style={{ height: `${HOUR_HEIGHT}px` }}
                        />
                      ))}

                      {/* Task blocks */}
                      <div className="absolute inset-0">
                        {dayTasks.map(task => renderTaskBlock(task, dayKey))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <Badge className="bg-red-100 text-red-800">Critical</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-100 text-orange-800">High</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800">Low</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvancedSchedulingCalendar;
