import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, AlertTriangle, Lock, Globe, FileText, Brain, Target, Sparkles, ExternalLink, ChevronDown, ChevronUp, RefreshCw, Check, CloudUpload, Play } from "lucide-react";
import { Timer } from "@/components/Timer";
import { toast } from "sonner";
import { Task } from "@/types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(task.synced || false);

  const handleSyncToTrello = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.atisCardId) {
      toast.error('No ATIS card ID available');
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch(`/api/atis/sync-checklist/${task.atisCardId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replaceExisting: true, preserveCompleted: true }),
      });

      const result = await response.json();

      if (result.success) {
        setSynced(true);
        toast.success(`Synced ${result.itemsCreated} checklist items to Trello`);
      } else {
        toast.error(result.error || 'Failed to sync checklist');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync checklist');
    } finally {
      setSyncing(false);
    }
  };
  
  const priorityColors = {
    CRITICAL: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    URGENT: "bg-orange-500 text-white hover:bg-orange-600",
    HIGH: "bg-yellow-500 text-white hover:bg-yellow-600",
    NORMAL: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  };

  const complexityColors = {
    simple: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    complex: "bg-red-100 text-red-700",
  };

  const taskTypeIcons: Record<string, string> = {
    admin: "📋",
    creation: "✏️",
    research: "🔍",
    technical: "⚙️",
    communication: "💬",
    meeting: "📅",
    review: "👁️",
    finance: "💰",
    legal: "⚖️",
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking checkbox or expand button
    if ((e.target as HTMLElement).closest('[role="checkbox"]') || 
        (e.target as HTMLElement).closest('button')) {
      return;
    }
    // Open Trello card in new tab
    if (task.url) {
      window.open(task.url, '_blank');
    } else {
      window.open(`https://trello.com/c/${task.cardId}`, '_blank');
    }
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const completedSteps = task.checklist?.filter(c => c.completed).length || 0;
  const totalSteps = task.checklist?.length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <Card 
      className={cn(
        "mb-4 transition-all duration-300 hover:shadow-md border-l-4 cursor-pointer",
        task.isCompleted ? "opacity-60 border-l-green-500" : 
        task.priorityLevel === 'CRITICAL' ? "border-l-destructive" :
        task.priorityLevel === 'URGENT' ? "border-l-orange-500" :
        "border-l-primary"
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Checkbox 
              checked={task.isCompleted} 
              onCheckedChange={() => onToggle(task.id)}
              className="h-5 w-5 rounded-full mt-1 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <CardTitle className={cn("text-lg font-medium leading-tight", task.isCompleted && "line-through text-muted-foreground")}>
                {task.cardName}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                {task.boardName && (
                  <span className="truncate">{task.boardName}</span>
                )}
                {task.listName && (
                  <>
                    <span>•</span>
                    <span className="truncate">{task.listName}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {task.hasUnderstanding && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <Brain className="h-3 w-3 mr-1" />
                AI
              </Badge>
            )}
            <Badge className={cn(priorityColors[task.priorityLevel])}>
              {task.priorityLevel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* AI Goal - shown prominently if available */}
        {task.goal && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border border-purple-100">
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-900">Goal</p>
                <p className="text-sm text-purple-700">{task.goal}</p>
              </div>
            </div>
            {task.deliverable && (
              <div className="flex items-start gap-2 mt-2">
                <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Deliverable</p>
                  <p className="text-sm text-blue-700">{task.deliverable}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fallback to description if no goal */}
        {!task.goal && task.description && (
          <p className="text-sm">{task.description}</p>
        )}

        {/* Progress bar for checklist */}
        {totalSteps > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{completedSteps}/{totalSteps} steps</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2 text-xs">
          {/* Duration with Timer */}
          <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(task.durationHours)}</span>
          </div>
          
          {/* Time Tracking Timer */}
          {!task.isCompleted && (
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
              <Timer 
                taskId={task.id} 
                taskName={task.cardName}
                estimatedHours={task.durationHours}
                compact={true}
              />
            </div>
          )}

          {/* Task Type */}
          {task.taskType && (
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
              <span>{taskTypeIcons[task.taskType] || '📌'}</span>
              <span className="capitalize">{task.taskType}</span>
            </div>
          )}

          {/* Complexity */}
          {task.complexity && (
            <div className={cn("flex items-center gap-1 px-2 py-1 rounded-md", complexityColors[task.complexity])}>
              <span className="capitalize">{task.complexity}</span>
            </div>
          )}

          {/* Due Date */}
          {task.date && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md",
              task.isBlocker ? "bg-red-100 text-red-700" : "bg-muted"
            )}>
              <span>{new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              {task.isBlocker && <AlertTriangle className="h-3 w-3" />}
            </div>
          )}
          
          {task.isBlocker && !task.date && (
            <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-md">
              <Lock className="h-3 w-3" />
              <span>Overdue</span>
            </div>
          )}
          
          {task.hasDutch && (
            <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
              <Globe className="h-3 w-3" />
              <span>Dutch</span>
            </div>
          )}
          
          {task.attachments && task.attachments.length > 0 && (
            <div className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
              <FileText className="h-3 w-3" />
              <span>{task.attachments.length}</span>
            </div>
          )}

          {/* AI Confidence */}
          {task.confidenceScore && task.confidenceScore > 0 && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md",
              task.confidenceScore >= 70 ? "bg-green-100 text-green-700" :
              task.confidenceScore >= 40 ? "bg-yellow-100 text-yellow-700" :
              "bg-gray-100 text-gray-500"
            )}>
              <Brain className="h-3 w-3" />
              <span>{task.confidenceScore}%</span>
            </div>
          )}
        </div>

        {/* Expandable checklist */}
        {task.checklist && task.checklist.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                APTLSS Checklist ({task.checklist.length} steps)
              </span>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {expanded && (
              <div className="mt-2 space-y-2 pl-2 border-l-2 border-muted">
                {task.checklist.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-2 text-sm">
                    <div className={cn(
                      "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                      item.completed ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    )}>
                      {item.aptlssType}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(item.completed && "line-through text-muted-foreground")}>
                        {item.step}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.timeMinutes}m</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions row */}
        <div className="pt-2 border-t flex items-center justify-between gap-2">
          {/* Sync to Trello button */}
          {task.checklist && task.checklist.length > 0 && task.atisCardId && (
            <Button
              variant={synced ? "outline" : "default"}
              size="sm"
              className={cn(
                "text-xs gap-1",
                synced && "text-green-600 border-green-200 bg-green-50 hover:bg-green-100"
              )}
              onClick={handleSyncToTrello}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Syncing...
                </>
              ) : synced ? (
                <>
                  <Check className="h-3 w-3" />
                  Synced
                </>
              ) : (
                <>
                  <CloudUpload className="h-3 w-3" />
                  Sync to Trello
                </>
              )}
            </Button>
          )}

          {/* Open in Trello link */}
          {task.url && (
            <a 
              href={task.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              Open in Trello
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
