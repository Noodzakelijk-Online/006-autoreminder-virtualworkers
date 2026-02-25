import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Users } from 'lucide-react';

interface TaskPreviewTooltipProps {
  taskId: string;
  taskTitle: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignedWorkers?: string[];
  estimatedDuration?: number; // in minutes
  children: React.ReactNode;
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function TaskPreviewTooltip({
  taskId,
  taskTitle,
  description,
  priority = 'medium',
  assignedWorkers = [],
  estimatedDuration,
  children,
}: TaskPreviewTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const truncateText = (text: string, maxLength: number = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          className="w-80 p-4 bg-card border border-border shadow-lg"
        >
          <div className="space-y-3">
            {/* Title */}
            <div>
              <h4 className="font-semibold text-sm line-clamp-2">{taskTitle}</h4>
            </div>

            {/* Description */}
            {description && (
              <div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {truncateText(description, 150)}
                </p>
              </div>
            )}

            {/* Priority Badge */}
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <Badge
                className={`text-xs capitalize ${priorityColors[priority]}`}
              >
                {priority}
              </Badge>
            </div>

            {/* Duration */}
            {estimatedDuration && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Est. {formatDuration(estimatedDuration)}</span>
              </div>
            )}

            {/* Assigned Workers */}
            {assignedWorkers.length > 0 && (
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {assignedWorkers.slice(0, 3).map((worker, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="text-xs"
                    >
                      {worker}
                    </Badge>
                  ))}
                  {assignedWorkers.length > 3 && (
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      +{assignedWorkers.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Footer hint */}
            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
              Click to view full details
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
