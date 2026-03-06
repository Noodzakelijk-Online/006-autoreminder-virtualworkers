import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { CalendarView } from '@/components/CalendarView';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

interface Task {
  id: string;
  cardId: string;
  cardName: string;
  description: string;
  durationHours: number;
  startTime: string;
  endTime: string;
  date: string;
  isCompleted: boolean;
  priorityLevel: string;
  taskType?: string;
}

export default function Calendar() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/trello/tasks', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return;
        }
        throw new Error('Failed to fetch tasks');
      }
      
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/working-hours/settings', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.workingDays) {
          setWorkingDays(JSON.parse(data.workingDays));
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchHolidays = async () => {
    try {
      const response = await fetch('/api/aptlss/trello/tasks', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // Extract dates from tasks for calendar view
        const dates = data.map((task: any) => task.date);
        setHolidays(dates);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchSettings();
    fetchHolidays();
  }, []);

  const handleTaskClick = (task: Task) => {
    toast.info(`${task.description}`, {
      description: `${task.cardName} • ${task.startTime} - ${task.endTime} (${task.durationHours}h)`
    });
  };

  const handleTaskReschedule = async (taskId: string, newDate: string) => {
    // Find the task to get its cardId
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      toast.error('Task not found');
      return;
    }

    // Optimistically update the UI
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, date: newDate } : t
    ));
    
    toast.loading('Syncing to Trello...', { id: 'reschedule-sync' });
    
    try {
      // Sync to Trello - update card due date
      const response = await fetch(`/api/trello/cards/${task.cardId}/due`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dueDate: new Date(newDate + 'T23:59:59').toISOString(),
        }),
      });

      if (response.ok) {
        toast.success('Task rescheduled and synced to Trello', {
          id: 'reschedule-sync',
          description: `Moved to ${new Date(newDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync');
      }
    } catch (error: any) {
      // Revert optimistic update on failure
      setTasks(previousTasks);
      toast.error('Failed to sync to Trello', {
        id: 'reschedule-sync',
        description: error.message || 'Please try again'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg">Calendar View</h1>
              <p className="text-xs text-muted-foreground">
                {tasks.length} tasks scheduled
              </p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchTasks}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading calendar...</p>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No tasks to display</p>
              <Button onClick={fetchTasks}>Refresh Tasks</Button>
            </div>
          </div>
        ) : (
          <CalendarView
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onTaskReschedule={handleTaskReschedule}
            holidays={holidays}
            workingDays={workingDays}
          />
        )}
      </main>
    </div>
  );
}
