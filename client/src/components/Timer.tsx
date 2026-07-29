import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TimerProps {
  taskId: string;
  taskName?: string;
  estimatedHours?: number;
  onTimeUpdate?: (minutes: number) => void;
  compact?: boolean;
}

interface ActiveTimer {
  id: number;
  taskId: string;
  startTime: string;
  notes?: string;
}

export function Timer({ taskId, taskName, estimatedHours, onTimeUpdate, compact = false }: TimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalTrackedMinutes, setTotalTrackedMinutes] = useState(0);

  // Format seconds to HH:MM:SS
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Format minutes to hours display
  const formatMinutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Check for active timer on mount
  const checkActiveTimer = useCallback(async () => {
    try {
      const response = await fetch('/api/time-tracking/active');
      if (response.ok) {
        const data = await response.json();
        if (data.active && data.entry.taskId === taskId) {
          setActiveTimer(data.entry);
          setIsRunning(true);
          // Calculate elapsed time from start
          const startTime = new Date(data.entry.startTime).getTime();
          const now = Date.now();
          setElapsedSeconds(Math.floor((now - startTime) / 1000));
        }
      }
    } catch (error) {
      console.error('Error checking active timer:', error);
    }
  }, [taskId]);

  // Fetch total tracked time for this task
  const fetchTotalTracked = useCallback(async () => {
    try {
      const response = await fetch(`/api/time-tracking/task/${encodeURIComponent(taskId)}`);
      if (response.ok) {
        const data = await response.json();
        setTotalTrackedMinutes(data.totalMinutes || 0);
      }
    } catch (error) {
      console.error('Error fetching tracked time:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    checkActiveTimer();
    fetchTotalTracked();
  }, [checkActiveTimer, fetchTotalTracked]);

  // Timer tick effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => {
          const newValue = prev + 1;
          // Notify parent every minute
          if (newValue % 60 === 0 && onTimeUpdate) {
            onTimeUpdate(Math.floor(newValue / 60));
          }
          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, onTimeUpdate]);

  const handleStart = async () => {
    try {
      const response = await fetch('/api/time-tracking/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, notes: taskName }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.activeTaskId) {
          toast.error('Another timer is already running. Stop it first.');
        } else {
          toast.error(error.error || 'Failed to start timer');
        }
        return;
      }

      const data = await response.json();
      setActiveTimer(data.entry);
      setIsRunning(true);
      setElapsedSeconds(0);
      toast.success('Timer started');
    } catch (error) {
      console.error('Error starting timer:', error);
      toast.error('Failed to start timer');
    }
  };

  const handlePause = async () => {
    try {
      const response = await fetch('/api/time-tracking/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to pause timer');
        return;
      }

      setIsRunning(false);
      setActiveTimer(null);
      // Update total tracked time
      setTotalTrackedMinutes(prev => prev + Math.floor(elapsedSeconds / 60));
      toast.success('Timer paused');
    } catch (error) {
      console.error('Error pausing timer:', error);
      toast.error('Failed to pause timer');
    }
  };

  const handleStop = async () => {
    try {
      const response = await fetch('/api/time-tracking/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to stop timer');
        return;
      }

      setIsRunning(false);
      setActiveTimer(null);
      // Update total tracked time
      const sessionMinutes = Math.floor(elapsedSeconds / 60);
      setTotalTrackedMinutes(prev => prev + sessionMinutes);
      setElapsedSeconds(0);
      toast.success(`Timer stopped. Session: ${formatMinutesToHours(sessionMinutes)}`);
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast.error('Failed to stop timer');
    }
  };

  // Calculate progress vs estimate
  const totalMinutesIncludingCurrent = totalTrackedMinutes + Math.floor(elapsedSeconds / 60);
  const estimatedMinutes = (estimatedHours || 0) * 60;
  const progressPercent = estimatedMinutes > 0 
    ? Math.min(100, Math.round((totalMinutesIncludingCurrent / estimatedMinutes) * 100))
    : 0;
  const isOverEstimate = totalMinutesIncludingCurrent > estimatedMinutes && estimatedMinutes > 0;

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", compact ? "text-xs" : "text-sm")}>
        <Clock className="h-4 w-4 animate-pulse" />
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isRunning ? (
          <>
            <span className="font-mono text-sm text-primary animate-pulse">
              {formatTime(elapsedSeconds)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handlePause}
              title="Pause"
            >
              <Pause className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleStop}
              title="Stop"
            >
              <Square className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            {totalTrackedMinutes > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatMinutesToHours(totalTrackedMinutes)}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleStart}
              title="Start Timer"
            >
              <Play className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 bg-secondary/30 rounded-lg">
      {/* Timer Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className={cn("h-5 w-5", isRunning && "text-primary animate-pulse")} />
          <span className="font-medium">Time Tracking</span>
        </div>
        <span className={cn(
          "font-mono text-xl",
          isRunning && "text-primary"
        )}>
          {formatTime(elapsedSeconds)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!isRunning ? (
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={handleStart}
          >
            <Play className="h-4 w-4 mr-1" />
            Start
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handlePause}
            >
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={handleStop}
            >
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
          </>
        )}
      </div>

      {/* Progress vs Estimate */}
      {estimatedHours && estimatedHours > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress vs Estimate</span>
            <span className={cn(isOverEstimate && "text-destructive font-medium")}>
              {formatMinutesToHours(totalMinutesIncludingCurrent)} / {estimatedHours}h
              {isOverEstimate && ' (over)'}
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300",
                isOverEstimate ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Total Tracked */}
      <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
        <span>Total Tracked</span>
        <span className="font-medium">
          {formatMinutesToHours(totalMinutesIncludingCurrent)}
        </span>
      </div>
    </div>
  );
}

export default Timer;
