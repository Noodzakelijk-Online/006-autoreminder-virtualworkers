import { Task } from "@/types";
import { TaskCard } from "./TaskCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TimelineSkeleton, EmptyState } from "./Skeletons";
import { CalendarX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface TimelineProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  allExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

export function Timeline({ tasks, onToggleTask, isLoading, onRefresh, allExpanded, onExpandChange }: TimelineProps) {
  // Track individual card expansion states
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Sync with allExpanded prop
  useEffect(() => {
    if (allExpanded !== undefined) {
      if (allExpanded) {
        // Expand all cards
        setExpandedCards(new Set(tasks.map(t => t.id)));
      } else {
        // Collapse all cards
        setExpandedCards(new Set());
      }
    }
  }, [allExpanded, tasks]);

  const handleCardExpandChange = (taskId: string, expanded: boolean) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      
      // Notify parent if all cards are now expanded or collapsed
      if (onExpandChange) {
        const allNowExpanded = newSet.size === tasks.length;
        const allNowCollapsed = newSet.size === 0;
        if (allNowExpanded && !allExpanded) {
          onExpandChange(true);
        } else if (allNowCollapsed && allExpanded) {
          onExpandChange(false);
        }
      }
      
      return newSet;
    });
  };

  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className="relative pl-8 py-4">
        <TimelineSkeleton />
      </div>
    );
  }

  // Show empty state when no tasks
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title="No tasks scheduled"
        description="Your timeline is empty. Tasks from your Trello APTLSS checklists will appear here once loaded."
        action={
          onRefresh && (
            <Button onClick={onRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Tasks
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="relative pl-8 py-4">
      {/* Vertical Line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      
      <ScrollArea className="h-[calc(100vh-200px)] pr-4">
        <div className="space-y-8">
          {tasks.map((task, index) => (
            <div key={task.id} className="relative">
              {/* Timeline Dot */}
              <div className={`absolute -left-[2.25rem] top-6 h-4 w-4 rounded-full border-2 border-background ${
                task.isCompleted ? "bg-green-500" : 
                task.priorityLevel === 'CRITICAL' ? "bg-destructive" :
                "bg-primary"
              }`} />
              
              {/* Time Label */}
              <div className="absolute -left-[6rem] top-5 text-xs font-mono text-muted-foreground w-12 text-right">
                {task.startTime || '--:--'}
              </div>
              
              <TaskCard 
                task={task} 
                onToggle={onToggleTask}
                isExpanded={expandedCards.has(task.id)}
                onExpandChange={(expanded) => handleCardExpandChange(task.id, expanded)}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
