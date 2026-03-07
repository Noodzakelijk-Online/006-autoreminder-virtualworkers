import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  message?: string;
  className?: string;
}

export function AutoSaveIndicator({
  status,
  message,
  className,
}: AutoSaveIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm transition-all duration-300',
        {
          'text-muted-foreground': status === 'idle',
          'text-blue-600 dark:text-blue-400': status === 'saving',
          'text-green-600 dark:text-green-400': status === 'saved',
          'text-red-600 dark:text-red-400': status === 'error',
        },
        className
      )}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{message || 'Saving...'}</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle className="h-4 w-4" />
          <span>{message || 'Saved!'}</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-4 w-4" />
          <span>{message || 'Save failed'}</span>
        </>
      )}
    </div>
  );
}
