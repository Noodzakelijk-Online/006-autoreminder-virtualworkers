import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, AlertTriangle, Lock, Globe, FileText, Brain, Target, Sparkles, ExternalLink, ChevronDown, ChevronRight, RefreshCw, Check, CloudUpload, Play } from "lucide-react";
import { Timer } from "@/components/Timer";
import { toast } from "sonner";
import { Task } from "@/types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const [cardExpanded, setCardExpanded] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);
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
        "mb-3 transition-all duration-200 border-l-4",
        task.isCompleted ? "opacity-60 border-l-green-500" : 
        task.priorityLevel === 'CRITICAL' ? "border-l-destructive" :
        task.priorityLevel === 'URGENT' ? "border-l-orange-500" :
        "border-l-primary"
      )}
    >
      <Collapsible open={cardExpanded} onOpenChange={setCardExpanded}>
        {/* Collapsed Header - Always visible */}
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              {/* Expand/Collapse Icon */}
              <div className="flex-shrink-0">
                {cardExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              
              {/* Checkbox */}
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                  checked={task.isCompleted} 
                  onCheckedChange={() => onToggle(task.id)}
                  className="h-5 w-5 rounded-full"
                />
              </div>
              
              {/* Card Name & Quick Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className={cn(
                    "text-base font-medium leading-tight truncate",
                    task.isCompleted && "line-through text-muted-foreground"
                  )}>
                    {task.cardName}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  {task.boardName && <span className="truncate">{task.boardName}</span>}
                  {task.listName && (
                    <>
                      <span>•</span>
                      <span className="truncate">{task.listName}</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Steps count */}
                {totalSteps > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {completedSteps}/{totalSteps} steps
                  </span>
                )}
                
                {/* Duration */}
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(task.durationHours)}
                </span>
                
                {/* AI Badge */}
                {task.hasUnderstanding && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                    <Brain className="h-3 w-3 mr-1" />
                    AI
                  </Badge>
                )}
                
                {/* Priority Badge */}
                <Badge className={cn("text-xs", priorityColors[task.priorityLevel])}>
                  {task.priorityLevel}
                </Badge>
              </div>
            </div>
            
            {/* Progress bar - visible in collapsed state */}
            {totalSteps > 0 && !cardExpanded && (
              <div className="mt-2 ml-14">
                <Progress value={progress} className="h-1.5" />
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        
        {/* Expanded Content */}
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {/* AI Goal - shown prominently if available */}
            {task.goal && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border border-purple-100 ml-8">
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
              <p className="text-sm ml-8">{task.description}</p>
            )}

            {/* Progress bar for checklist - in expanded view */}
            {totalSteps > 0 && (
              <div className="space-y-1 ml-8">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{completedSteps}/{totalSteps} steps</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
            
            {/* Metadata badges */}
            <div className="flex flex-wrap gap-2 text-xs ml-8">
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

            {/* Collapsible APTLSS Checklist Steps */}
            {task.checklist && task.checklist.length > 0 && (
              <div className="ml-8">
                <Collapsible open={stepsExpanded} onOpenChange={setStepsExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between text-muted-foreground hover:text-foreground px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="flex items-center gap-2">
                        {stepsExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Sparkles className="h-3 w-3" />
                        APTLSS Checklist ({task.checklist.length} steps)
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 pl-4 border-l-2 border-muted">
                      {task.checklist.map((item, index) => (
                        <div key={item.id} className="flex items-start gap-2 text-sm py-1">
                          <div className={cn(
                            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                            item.completed ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                          )}>
                            {item.aptlssType}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "leading-tight",
                              item.completed && "line-through text-muted-foreground"
                            )}>
                              {item.step}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.timeMinutes}m</p>
                          </div>
                          {item.completed && (
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Actions row */}
            <div className="pt-2 border-t flex items-center justify-between gap-2 ml-8">
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
