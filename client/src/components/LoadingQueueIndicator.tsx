import { useLoadingQueue } from '@/contexts/LoadingQueueContext';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export function LoadingQueueIndicator() {
  const { operations, removeOperation, clearCompleted, hasActiveOperations } = useLoadingQueue();

  if (operations.length === 0) {
    return null;
  }

  const activeCount = operations.filter(op => op.status === 'running').length;
  const completedCount = operations.filter(op => op.status === 'completed').length;
  const failedCount = operations.filter(op => op.status === 'failed').length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 px-3 gap-2"
        >
          {hasActiveOperations ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : completedCount > 0 && failedCount === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : failedCount > 0 ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : null}
          <span className="text-sm hidden sm:inline">
            {hasActiveOperations ? `${activeCount} running` : 
             failedCount > 0 ? `${failedCount} failed` : 
             `${completedCount} done`}
          </span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Background Operations</h4>
            {(completedCount > 0 || failedCount > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={clearCompleted}
              >
                Clear completed
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {operations.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">
              No operations
            </p>
          ) : (
            <div className="divide-y">
              {operations.map(op => (
                <div key={op.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {op.status === 'running' && (
                          <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                        )}
                        {op.status === 'completed' && (
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        )}
                        {op.status === 'failed' && (
                          <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                        )}
                        {op.status === 'cancelled' && (
                          <X className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">{op.label}</span>
                      </div>
                      {op.status === 'running' && (
                        <div className="mt-2 space-y-1">
                          <Progress value={op.progress} className="h-1.5" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{Math.round(op.progress)}%</span>
                            {op.current !== undefined && op.total !== undefined && (
                              <span>{op.current} / {op.total}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => removeOperation(op.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
