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
      // Try the main tasks endpoint first
      const response = await fetch('/api/trello/tasks', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return;
        }
        throw new Error('Failed to fetch tasks');
      }
      
      const text = await response.text();
      if (!text) {
        setTasks([]);
        return;
      }

      try {
        const data = JSON.parse(text);
        setTasks(data.tasks || data || []);
      } catch (parseError) {
        console.error('Error parsing tasks JSON:', parseError);
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
      setTasks([]);
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
        const text = await response.text();
        if (!text) return;

        try {
          const data = JSON.parse(text);
          if (data.workingDays) {
            const parsed = typeof data.workingDays === 'string' 
              ? JSON.parse(data.workingDays) 
              : data.workingDays;
            setWorkingDays(Array.isArray(parsed) ? parsed : [1, 2, 3, 4, 5]);
          }
        } catch (parseError) {
          console.error('Error parsing settings JSON:', parseError);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchHolidays = async () => {
    try {
      // Use the holidays endpoint instead of tasks endpoint
      const response = await fetch('/api/holidays', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const text = await response.text();
        if (!text) {
          setHolidays([]);
          return;
        }

        try {
          const data = JSON.parse(text);
          // Handle different response formats
          if (Array.isArray(data)) {
            setHolidays(data.map((h: any) => h.date || h));
          } else if (data.holidays && Array.isArray(data.holidays)) {
            setHolidays(data.holidays.map((h: any) => h.date || h));
          } else if (data.dates && Array.isArray(data.dates)) {
            setHolidays(data.dates);
          } else {
            setHolidays([]);
          }
        } catch (parseError) {
          console.error('Error parsing holidays JSON:', parseError);
          setHolidays([]);
        }
      } else {
        setHolidays([]);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
      setHolidays([]);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchSettings();
      fetchHolidays();
    }
  }, [user]);

  const handleRefresh = async () => {
    await fetchTasks();
    toast.success('Calendar refreshed');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view calendar</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/founder">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Calendar</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading calendar...</p>
          </div>
        ) : (
          <CalendarView 
            tasks={tasks} 
            holidays={holidays}
            workingDays={workingDays}
          />
        )}
      </div>
    </div>
  );
}
