import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect, useState, useMemo, memo } from 'react';
import { TaskCard as TaskCardBase } from './TaskCard';
import { TimelineSkeleton } from './Skeletons';
import { Task } from '@/types';
import { CalendarX, RefreshCw, CheckSquare, Brain, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Memoized TaskCard to prevent unnecessary re-renders
const TaskCard = memo(TaskCardBase);
TaskCard.displayName = 'MemoizedTaskCard';

interface VirtualizedTimelineProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  allExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  onStartInterview?: (task: Task) => void;
  viewMode?: 'day' | 'week' | 'all';
}

export function VirtualizedTimeline({
  tasks,
  onToggleTask,
  isLoading,
  onRefresh,
  allExpanded,
  onExpandChange,
  onStartInterview,
  viewMode = 'all',
}: VirtualizedTimelineProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [batchReanalyzing, setBatchReanalyzing] = useState(false);
  const [reanalysisProgress, setReanalysisProgress] = useState({ current: 0, total: 0 });

  // Filter tasks by view mode
  const filteredTasksByView = useMemo(() => {
    if (viewMode === 'all') return tasks;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    return tasks.filter(task => {
      if (!task.date) return true;
      try {
        const taskDate = new Date(task.date);
        taskDate.setHours(0, 0, 0, 0);

        if (viewMode === 'day') {
          return taskDate.getTime() === today.getTime();
        } else if (viewMode === 'week') {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          return taskDate >= weekStart && taskDate <= weekEnd;
        }
      } catch (e) {
        return true;
      }
      return true;
    });
  }, [tasks, viewMode]);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: filteredTasksByView.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Sync with allExpanded prop
  useEffect(() => {
    if (allExpanded !== undefined) {
      if (allExpanded) {
        setExpandedCards(new Set(filteredTasksByView.map(t => t.id)));
      } else {
        setExpandedCards(new Set());
      }
    }
  }, [allExpanded, filteredTasksByView]);

  // Clear selection when exiting selection mode
  useEffect(() => {
    if (!selectionMode) {
      setSelectedTasks(new Set());
    }
  }, [selectionMode]);

  const handleCardExpandChange = (taskId: string, expanded: boolean) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  };

  const handleTaskSelect = (taskId: string, checked: boolean) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedTasks(new Set(filteredTasksByView.map(t => t.id)));
  };

  const handleClearSelection = () => {
    setSelectedTasks(new Set());
  };

  const handleBatchReanalyze = async () => {
    if (selectedTasks.size === 0) return;
    setBatchReanalyzing(true);
    setReanalysisProgress({ current: 0, total: selectedTasks.size });

    try {
      const selectedArray = Array.from(selectedTasks);
      for (let i = 0; i < selectedArray.length; i++) {
        const taskId = selectedArray[i];
        try {
          const response = await fetch('/api/atis/reanalyze', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId }),
          });

          if (!response.ok) {
            console.error(`Failed to reanalyze task ${taskId}`);
          }
          setReanalysisProgress({ current: i + 1, total: selectedArray.length });
        } catch (error) {
          console.error(`Error reanalyzing task ${taskId}:`, error);
        }
      }
      toast.success(`Reanalyzed ${selectedArray.length} tasks`);
      setSelectedTasks(new Set());
      setSelectionMode(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error('Batch reanalysis failed');
    } finally {
      setBatchReanalyzing(false);
    }
  };

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (filteredTasksByView.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <CalendarX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No tasks found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or view mode</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/50 flex-wrap">
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        )}

        <Button
          variant={selectionMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectionMode(!selectionMode)}
          className="text-xs"
        >
          {selectionMode ? (
            <>
              <X className="h-3.5 w-3.5 mr-1" />
              Exit Selection
            </>
          ) : (
            <>
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              Select Cards
            </>
          )}
        </Button>

        {selectionMode && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="text-xs"
              disabled={selectedTasks.size === 0}
            >
              Clear
            </Button>
          </>
        )}
      </div>

      {selectionMode && selectedTasks.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b">
          <span className="text-sm text-muted-foreground">
            {selectedTasks.size} selected
          </span>
          <Button
            size="sm"
            onClick={handleBatchReanalyze}
            disabled={batchReanalyzing}
            className="text-xs gap-1"
          >
            {batchReanalyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {reanalysisProgress.current}/{reanalysisProgress.total}
              </>
            ) : (
              <>
                <Brain className="h-3.5 w-3.5" />
                Re-analyze Selected
              </>
            )}
          </Button>
        </div>
      )}

      {/* Virtual scrolling container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto relative"
        style={{
          contain: 'layout style paint',
        }}
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {/* Virtual items */}
          {virtualItems.map(virtualItem => {
            const task = filteredTasksByView[virtualItem.index];
            if (!task) return null;

            return (
              <div
                key={task.id}
                data-index={virtualItem.index}
                className="absolute w-full px-4"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="relative pl-8 py-4">
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div
                      className="absolute -left-[4rem] top-6 z-10"
                      onClick={e => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={checked =>
                          handleTaskSelect(task.id, checked as boolean)
                        }
                        className={cn(
                          'h-5 w-5 border-2',
                          selectedTasks.has(task.id) &&
                            'bg-primary border-primary'
                        )}
                      />
                    </div>
                  )}

                  {/* Timeline Dot */}
                  <div
                    className={cn(
                      'absolute -left-[2.25rem] top-6 h-4 w-4 rounded-full border-2 border-background',
                      task.isCompleted
                        ? 'bg-green-500'
                        : task.priorityLevel === 'CRITICAL'
                          ? 'bg-destructive'
                          : 'bg-primary'
                    )}
                  />

                  {/* Task Card */}
                  <TaskCard
                    task={task}
                    isExpanded={expandedCards.has(task.id)}
                    onExpandChange={expanded =>
                      handleCardExpandChange(task.id, expanded)
                    }
                    onToggle={() => onToggleTask(task.id)}
                    onStartInterview={onStartInterview}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
