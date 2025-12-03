import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, AlertTriangle, Lock, Globe, FileText } from "lucide-react";
import { Task } from "@/types";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const priorityColors = {
    CRITICAL: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    URGENT: "bg-orange-500 text-white hover:bg-orange-600",
    HIGH: "bg-yellow-500 text-white hover:bg-yellow-600",
    NORMAL: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  };

  return (
    <Card className={cn(
      "mb-4 transition-all duration-300 hover:shadow-md border-l-4",
      task.isCompleted ? "opacity-60 border-l-green-500" : 
      task.priorityLevel === 'CRITICAL' ? "border-l-destructive" :
      task.priorityLevel === 'URGENT' ? "border-l-orange-500" :
      "border-l-primary"
    )}>
      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <Checkbox 
            checked={task.isCompleted} 
            onCheckedChange={() => onToggle(task.id)}
            className="h-5 w-5 rounded-full"
          />
          <div>
            <CardTitle className={cn("text-lg font-medium", task.isCompleted && "line-through text-muted-foreground")}>
              {task.cardName}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Step {task.stepIndex}</p>
          </div>
        </div>
        <Badge className={cn("ml-2", priorityColors[task.priorityLevel])}>
          {task.priorityLevel}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">{task.description}</p>
        
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
            <Clock className="h-3 w-3" />
            <span>{task.startTime} - {task.endTime} ({task.durationHours}h)</span>
          </div>
          
          {task.isBlocker && (
            <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-md">
              <Lock className="h-3 w-3" />
              <span>Blocker</span>
            </div>
          )}
          
          {task.hasDutch && (
            <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
              <Globe className="h-3 w-3" />
              <span>Dutch Content</span>
            </div>
          )}
          
          {task.attachments.length > 0 && (
            <div className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
              <FileText className="h-3 w-3" />
              <span>{task.attachments.length} Attachments</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
