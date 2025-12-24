import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeeklyProgressData {
  weekStart: string;
  weekEnd: string;
  actualHours: number;
  actualMinutes: number;
  weeklyHoursMin: number;
  weeklyHoursMax: number;
  dailyHoursMin: number;
  dailyHoursMax: number;
  dailyHours: Record<string, number>;
  progressPercent: number;
  onTrack: boolean;
  status: 'under' | 'on_track' | 'over';
}

interface ScheduledHoursData {
  totalScheduledHours: number;
  dailyScheduled: Record<string, number>;
}

export function WeeklyProgressDashboard() {
  const [progress, setProgress] = useState<WeeklyProgressData | null>(null);
  const [scheduledHours, setScheduledHours] = useState<ScheduledHoursData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeeklyProgress();
    fetchScheduledHours();
  }, []);

  const fetchWeeklyProgress = async () => {
    try {
      const response = await fetch('/api/time-tracking/weekly-progress');
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
      } else {
        // If API returns error, use defaults
        setProgress({
          weekStart: getWeekStart(),
          weekEnd: getWeekEnd(),
          actualHours: 0,
          actualMinutes: 0,
          weeklyHoursMin: 40,
          weeklyHoursMax: 45,
          dailyHoursMin: 8,
          dailyHoursMax: 9,
          dailyHours: {},
          progressPercent: 0,
          onTrack: false,
          status: 'under'
        });
      }
    } catch (err) {
      console.error('Error fetching weekly progress:', err);
      setError('Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledHours = async () => {
    try {
      // Fetch tasks to calculate scheduled hours for the week
      const response = await fetch('/api/aptlss/tasks');
      if (response.ok) {
        const data = await response.json();
        const tasks = data.scheduled || data.tasks || [];
        
        // Calculate scheduled hours for current week
        const weekStart = new Date(getWeekStart());
        const weekEnd = new Date(getWeekEnd());
        weekEnd.setHours(23, 59, 59, 999);
        
        let totalScheduledMinutes = 0;
        const dailyScheduled: Record<string, number> = {};
        
        tasks.forEach((task: any) => {
          if (task.date && task.durationHours) {
            const taskDate = new Date(task.date);
            if (taskDate >= weekStart && taskDate <= weekEnd) {
              const dateStr = task.date;
              const minutes = Math.round(task.durationHours * 60);
              totalScheduledMinutes += minutes;
              dailyScheduled[dateStr] = (dailyScheduled[dateStr] || 0) + minutes;
            }
          }
        });
        
        setScheduledHours({
          totalScheduledHours: Math.round(totalScheduledMinutes / 60 * 10) / 10,
          dailyScheduled
        });
      }
    } catch (err) {
      console.error('Error fetching scheduled hours:', err);
    }
  };

  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    return startOfWeek.toISOString().split('T')[0];
  };

  const getWeekEnd = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return endOfWeek.toISOString().split('T')[0];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Clock className="h-5 w-5 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading progress...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !progress) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            {error || 'Unable to load weekly progress'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const targetMidpoint = (progress.weeklyHoursMin + progress.weeklyHoursMax) / 2;
  const scheduledTotal = scheduledHours?.totalScheduledHours || 0;
  const scheduledProgressPercent = Math.min(100, Math.round((scheduledTotal / targetMidpoint) * 100));

  // Generate week days for the chart
  const weekDays: string[] = [];
  const startDate = new Date(progress.weekStart);
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    weekDays.push(date.toISOString().split('T')[0]);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5" />
          Weekly Progress
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {formatDate(progress.weekStart)} - {formatDate(progress.weekEnd)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scheduled Hours vs Target */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Scheduled</span>
            </div>
            <span className={cn(
              "text-lg font-bold",
              scheduledTotal < progress.weeklyHoursMin && "text-amber-500",
              scheduledTotal >= progress.weeklyHoursMin && scheduledTotal <= progress.weeklyHoursMax && "text-green-500",
              scheduledTotal > progress.weeklyHoursMax && "text-red-500"
            )}>
              {scheduledTotal}h
              <span className="text-sm font-normal text-muted-foreground">
                /{progress.weeklyHoursMin}-{progress.weeklyHoursMax}h
              </span>
            </span>
          </div>
          <Progress 
            value={scheduledProgressPercent} 
            className={cn(
              "h-3",
              scheduledTotal < progress.weeklyHoursMin && "[&>div]:bg-amber-500",
              scheduledTotal >= progress.weeklyHoursMin && scheduledTotal <= progress.weeklyHoursMax && "[&>div]:bg-green-500",
              scheduledTotal > progress.weeklyHoursMax && "[&>div]:bg-red-500"
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0h</span>
            <span>{progress.weeklyHoursMin}h (min)</span>
            <span>{progress.weeklyHoursMax}h (max)</span>
          </div>
        </div>

        {/* Actual Tracked Hours */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tracked</span>
            </div>
            <span className="text-lg font-bold text-primary">
              {progress.actualHours}h
            </span>
          </div>
          <Progress 
            value={progress.progressPercent} 
            className="h-2 [&>div]:bg-primary"
          />
        </div>

        {/* Daily Breakdown */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">Daily Breakdown</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((date) => {
              const scheduled = scheduledHours?.dailyScheduled[date] || 0;
              const tracked = (progress.dailyHours[date] || 0) * 60; // Convert hours to minutes
              const scheduledHrs = Math.round(scheduled / 60 * 10) / 10;
              const trackedHrs = Math.round(tracked / 60 * 10) / 10;
              const isToday = date === new Date().toISOString().split('T')[0];
              const maxDailyMinutes = progress.dailyHoursMax * 60;
              const fillPercent = Math.min(100, Math.round((scheduled / maxDailyMinutes) * 100));
              
              return (
                <div 
                  key={date} 
                  className={cn(
                    "flex flex-col items-center p-1 rounded text-xs",
                    isToday && "bg-primary/10 ring-1 ring-primary"
                  )}
                >
                  <span className="font-medium">{getDayName(date)}</span>
                  <div className="w-full h-12 bg-secondary rounded mt-1 relative overflow-hidden">
                    <div 
                      className="absolute bottom-0 w-full bg-primary/60 transition-all"
                      style={{ height: `${fillPercent}%` }}
                    />
                    {tracked > 0 && (
                      <div 
                        className="absolute bottom-0 w-full bg-green-500/80"
                        style={{ height: `${Math.min(100, Math.round((tracked / maxDailyMinutes) * 100))}%` }}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {scheduledHrs > 0 ? `${scheduledHrs}h` : '-'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-primary/60 rounded" />
              <span>Scheduled</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500/80 rounded" />
              <span>Tracked</span>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className={cn(
          "flex items-center gap-2 p-2 rounded-md text-sm",
          progress.status === 'under' && "bg-amber-500/10 text-amber-600",
          progress.status === 'on_track' && "bg-green-500/10 text-green-600",
          progress.status === 'over' && "bg-red-500/10 text-red-600"
        )}>
          {progress.status === 'under' && (
            <>
              <TrendingDown className="h-4 w-4" />
              <span>Below target - {(progress.weeklyHoursMin - progress.actualHours).toFixed(1)}h remaining to reach minimum</span>
            </>
          )}
          {progress.status === 'on_track' && (
            <>
              <Target className="h-4 w-4" />
              <span>On track! Within target range</span>
            </>
          )}
          {progress.status === 'over' && (
            <>
              <TrendingUp className="h-4 w-4" />
              <span>Above target by {(progress.actualHours - progress.weeklyHoursMax).toFixed(1)}h</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default WeeklyProgressDashboard;
