import { AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OverflowTask {
  id: string;
  cardName: string;
  durationHours: number;
  date: string;
  priorityLevel: string;
  taskType: string;
  complexity: string;
  rejectionReason: string;
  boardName?: string;
  listName?: string;
}

interface OverflowTasksProps {
  tasks: OverflowTask[];
  onReschedule?: (taskId: string, newDate: string) => void;
  onIgnore?: (taskId: string) => void;
}

export function OverflowTasks({ tasks, onReschedule, onIgnore }: OverflowTasksProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  if (!tasks || tasks.length === 0) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'destructive';
      case 'URGENT':
        return 'destructive';
      case 'HIGH':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Complex':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Simple':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const calculateSuggestedDate = (originalDate: string, durationHours: number): string => {
    const date = new Date(originalDate);
    const daysToAdd = Math.ceil(durationHours / 8); // Assume 8-hour workday
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  };

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <CardTitle className="text-amber-900 dark:text-amber-100">
                Tasks That Didn't Fit ({tasks.length})
              </CardTitle>
              <CardDescription className="text-amber-800 dark:text-amber-200">
                These tasks exceeded your daily capacity and need to be rescheduled
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-amber-700 hover:text-amber-900 dark:text-amber-300"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          <div className="space-y-3">
            {tasks.map((task) => {
              const suggestedDate = calculateSuggestedDate(task.date, task.durationHours);
              const isExpanded = expandedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-white dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-sm truncate text-slate-900 dark:text-slate-100">
                          {task.cardName}
                        </p>
                        <Badge variant={getPriorityColor(task.priorityLevel)} className="text-xs">
                          {task.priorityLevel}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {task.taskType}
                        </Badge>
                        <div className={`text-xs px-2 py-1 rounded ${getComplexityColor(task.complexity)}`}>
                          {task.complexity}
                        </div>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.durationHours}h
                        </Badge>
                      </div>

                      {task.boardName && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {task.boardName} • {task.listName}
                        </p>
                      )}

                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                        <strong>Reason:</strong> {task.rejectionReason}
                      </p>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                            <strong>Suggested reschedule:</strong> {new Date(suggestedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <div className="flex gap-2">
                            {onReschedule && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => onReschedule(task.id, suggestedDate)}
                              >
                                Reschedule to {new Date(suggestedDate).getDate()}
                              </Button>
                            )}
                            {onIgnore && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs"
                                onClick={() => onIgnore(task.id)}
                              >
                                Ignore
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="text-amber-700 hover:text-amber-900 dark:text-amber-300 flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900 rounded-lg">
            <p className="text-xs text-amber-900 dark:text-amber-100">
              💡 <strong>Tip:</strong> These tasks exceeded your daily capacity. Consider moving them to future dates or reducing their duration estimates.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
