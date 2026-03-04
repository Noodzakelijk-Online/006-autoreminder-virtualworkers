import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface Task {
  id: string;
  cardName: string;
  cardId: string;
  checklistId?: string;
  checkItemId?: string;
}

interface TaskBulkActionsProps {
  tasks: Task[];
  onTasksUpdated?: () => void;
}

export function TaskBulkActions({ tasks, onTasksUpdated }: TaskBulkActionsProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const completeTasksMutation = trpc.tasks.bulkComplete.useMutation();
  const incompleteTasksMutation = trpc.tasks.bulkIncomplete.useMutation();

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map(t => t.id)));
    }
  }, [tasks, selectedTasks.size]);

  const handleBulkComplete = async () => {
    if (selectedTasks.size === 0) return;

    setIsProcessing(true);
    setFeedback(null);

    try {
      const taskIds = Array.from(selectedTasks);
      await completeTasksMutation.mutateAsync({ taskIds });
      
      setFeedback({
        type: 'success',
        message: `✓ Marked ${taskIds.length} task${taskIds.length > 1 ? 's' : ''} as complete`,
      });
      
      setSelectedTasks(new Set());
      onTasksUpdated?.();
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error.message || 'Failed to complete tasks',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkIncomplete = async () => {
    if (selectedTasks.size === 0) return;

    setIsProcessing(true);
    setFeedback(null);

    try {
      const taskIds = Array.from(selectedTasks);
      await incompleteTasksMutation.mutateAsync({ taskIds });
      
      setFeedback({
        type: 'success',
        message: `✓ Marked ${taskIds.length} task${taskIds.length > 1 ? 's' : ''} as incomplete`,
      });
      
      setSelectedTasks(new Set());
      onTasksUpdated?.();
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error.message || 'Failed to mark tasks as incomplete',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (tasks.length === 0) {
    return null;
  }

  const hasSelection = selectedTasks.size > 0;
  const isAllSelected = selectedTasks.size === tasks.length && tasks.length > 0;

  return (
    <div className="space-y-4">
      {/* Selection Header */}
      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all tasks"
          />
          <span className="text-sm font-medium text-gray-700">
            {selectedTasks.size > 0
              ? `${selectedTasks.size} of ${tasks.length} selected`
              : `Select tasks to perform bulk actions`}
          </span>
        </div>
      </div>

      {/* Task List with Checkboxes */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {tasks.map(task => (
          <div
            key={task.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              selectedTasks.has(task.id)
                ? 'bg-blue-50 border-blue-300'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Checkbox
              checked={selectedTasks.has(task.id)}
              onCheckedChange={() => toggleTaskSelection(task.id)}
              aria-label={`Select task: ${task.cardName}`}
            />
            <span className="text-sm text-gray-700 flex-1 truncate">{task.cardName}</span>
          </div>
        ))}
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="text-sm">{feedback.message}</span>
        </div>
      )}

      {/* Action Buttons */}
      {hasSelection && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => setSelectedTasks(new Set())}
            disabled={isProcessing}
          >
            Clear Selection
          </Button>
          <Button
            variant="default"
            onClick={handleBulkIncomplete}
            disabled={isProcessing || completeTasksMutation.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Mark Incomplete
          </Button>
          <Button
            onClick={handleBulkComplete}
            disabled={isProcessing || incompleteTasksMutation.isPending}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark Complete
          </Button>
        </div>
      )}
    </div>
  );
}
