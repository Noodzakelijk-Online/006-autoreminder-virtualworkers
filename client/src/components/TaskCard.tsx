import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, AlertTriangle, Lock, Globe, FileText, Brain, Target, Sparkles, ExternalLink, ChevronDown, ChevronRight, RefreshCw, Check, CloudUpload, Play, ListChecks } from "lucide-react";
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

// APTLSS type colors and labels
const aptlssTypeInfo: Record<string, { color: string; label: string; bgColor: string }> = {
  A: { color: "text-blue-700", label: "Action", bgColor: "bg-blue-100" },
  P: { color: "text-purple-700", label: "Process", bgColor: "bg-purple-100" },
  T: { color: "text-green-700", label: "Task", bgColor: "bg-green-100" },
  L: { color: "text-yellow-700", label: "Learn", bgColor: "bg-yellow-100" },
  S: { color: "text-orange-700", label: "Support", bgColor: "bg-orange-100" },
};

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const [cardExpanded, setCardExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(task.synced || false);
  const [stepCompletions, setStepCompletions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    task.checklist?.forEach(item => {
      initial[item.id] = item.completed || false;
    });
    return initial;
  });

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

  const handleStepToggle = (stepId: string) => {
    setStepCompletions(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
    // TODO: Persist step completion to backend
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

  const completedSteps = task.checklist?.filter((_, idx) => stepCompletions[task.checklist![idx].id]).length || 0;
  const totalSteps = task.checklist?.length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  // Calculate total time from checklist
  const totalMinutes = task.checklist?.reduce((sum, item) => sum + (item.timeMinutes || 0), 0) || Math.round(task.durationHours * 60);

  return (
    <Card 
      className={cn(
        "mb-4 transition-all duration-200 border-l-4 overflow-hidden",
        task.isCompleted ? "opacity-60 border-l-green-500" : 
        task.priorityLevel === 'CRITICAL' ? "border-l-destructive" :
        task.priorityLevel === 'URGENT' ? "border-l-orange-500" :
        "border-l-primary"
      )}
    >
      <Collapsible open={cardExpanded} onOpenChange={setCardExpanded}>
        {/* Card Header - Always visible */}
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3">
              {/* Expand/Collapse Icon */}
              <div className="flex-shrink-0 mt-1">
                {cardExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              
              {/* Checkbox for entire card */}
              <div onClick={(e) => e.stopPropagation()} className="mt-0.5">
                <Checkbox 
                  checked={task.isCompleted} 
                  onCheckedChange={() => onToggle(task.id)}
                  className="h-5 w-5 rounded-full"
                />
              </div>
              
              {/* Card Name & Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className={cn(
                    "text-base font-semibold leading-tight",
                    task.isCompleted && "line-through text-muted-foreground"
                  )}>
                    {task.cardName}
                  </CardTitle>
                  
                  {/* Priority Badge */}
                  <Badge className={cn("text-xs", priorityColors[task.priorityLevel])}>
                    {task.priorityLevel}
                  </Badge>
                  
                  {/* AI Badge */}
                  {task.hasUnderstanding && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                      <Brain className="h-3 w-3 mr-1" />
                      AI
                    </Badge>
                  )}
                </div>
                
                {/* Board & List info */}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {task.boardName && <span className="truncate">{task.boardName}</span>}
                  {task.listName && (
                    <>
                      <span>•</span>
                      <span className="truncate">{task.listName}</span>
                    </>
                  )}
                </div>
                
                {/* Quick stats row */}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {/* Steps count */}
                  {totalSteps > 0 && (
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5" />
                      {completedSteps}/{totalSteps} steps
                    </span>
                  )}
                  
                  {/* Total Duration */}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)}h` : `${totalMinutes}m`}
                  </span>
                  
                  {/* Task Type */}
                  {task.taskType && (
                    <span className="flex items-center gap-1">
                      <span>{taskTypeIcons[task.taskType] || '📌'}</span>
                      <span className="capitalize">{task.taskType}</span>
                    </span>
                  )}
                  
                  {/* Complexity */}
                  {task.complexity && (
                    <span className={cn("px-1.5 py-0.5 rounded text-xs", complexityColors[task.complexity])}>
                      {task.complexity}
                    </span>
                  )}
                </div>
                
                {/* Progress bar - always visible */}
                {totalSteps > 0 && (
                  <div className="mt-2">
                    <Progress value={progress} className="h-1.5" />
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        {/* Expanded Content - Checklist Steps */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {/* AI Goal - if available */}
            {task.goal && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border border-purple-100 mb-4 ml-10">
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

            {/* APTLSS Checklist Steps - Always visible when expanded */}
            {task.checklist && task.checklist.length > 0 && (
              <div className="ml-10 space-y-1">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                  <ListChecks className="h-4 w-4" />
                  <span>Checklist Steps</span>
                </div>
                
                <div className="space-y-2">
                  {task.checklist.map((item, index) => {
                    const typeInfo = aptlssTypeInfo[item.aptlssType] || { color: "text-gray-700", label: item.aptlssType, bgColor: "bg-gray-100" };
                    const isCompleted = stepCompletions[item.id];
                    
                    return (
                      <div 
                        key={item.id} 
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border transition-all",
                          isCompleted 
                            ? "bg-green-50/50 border-green-200" 
                            : "bg-muted/30 border-transparent hover:border-muted-foreground/20"
                        )}
                      >
                        {/* Step checkbox */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={isCompleted}
                            onCheckedChange={() => handleStepToggle(item.id)}
                            className="h-5 w-5 mt-0.5"
                          />
                        </div>
                        
                        {/* Step number & type badge */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-1">
                          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            typeInfo.bgColor,
                            typeInfo.color
                          )}>
                            {item.aptlssType}
                          </span>
                        </div>
                        
                        {/* Step content */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm leading-relaxed",
                            isCompleted && "line-through text-muted-foreground"
                          )}>
                            {item.step}
                          </p>
                          
                          {/* Step metadata */}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {item.timeMinutes}m
                            </span>
                            <span className={cn("capitalize", typeInfo.color)}>
                              {typeInfo.label}
                            </span>
                          </div>
                        </div>
                        
                        {/* Completion indicator */}
                        {isCompleted && (
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Total time summary */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t text-sm">
                  <span className="text-muted-foreground">Total estimated time</span>
                  <span className="font-medium">
                    {totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)} hours` : `${totalMinutes} minutes`}
                  </span>
                </div>
              </div>
            )}

            {/* No checklist - show description */}
            {(!task.checklist || task.checklist.length === 0) && task.description && (
              <p className="text-sm ml-10 text-muted-foreground">{task.description}</p>
            )}

            {/* Actions row */}
            <div className="pt-4 mt-4 border-t flex items-center justify-between gap-2 ml-10">
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
