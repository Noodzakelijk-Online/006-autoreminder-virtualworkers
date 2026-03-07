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

const DEFAULT_SETTINGS = {
  workingDays: [1, 2, 3, 4, 5],
  workStartHour: 9,
  workEndHour: 18,
};

export default function Calendar() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>(DEFAULT_SETTINGS.workingDays);

  // Retry logic with exponential backoff
  const retryFetch = async (
    url: string,
    maxRetries = 3,
    initialDelayMs = 500,
    timeoutMs = 30000 // 30 second timeout
  ): Promise<Response | null> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
          const response = await fetch(url, {
            credentials: 'include',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          const delayMs = initialDelayMs * Math.pow(2, attempt);
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    if (lastError) throw lastError;
    return null;
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await retryFetch('/api/trello/tasks', 2, 1000, 30000);

      if (!response) {
        console.error('No response from tasks endpoint');
        setTasks([]);
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          console.log('Unauthorized - user not logged in');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) {
        console.log('Empty response from tasks endpoint');
        setTasks([]);
        return;
      }

      try {
        const data = JSON.parse(text);
        // Handle different response formats
        if (Array.isArray(data)) {
          setTasks(data);
        } else if (data.tasks && Array.isArray(data.tasks)) {
          setTasks(data.tasks);
        } else {
          console.warn('Unexpected tasks response format:', data);
          setTasks([]);
        }
      } catch (parseError) {
        console.error('Error parsing tasks JSON:', parseError, 'Response:', text.substring(0, 100));
        setTasks([]);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching tasks:', errorMsg);
      
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        toast.error('Task loading timed out - please try again');
      } else if (errorMsg.includes('abort')) {
        toast.error('Task loading was cancelled');
      } else {
        toast.error('Failed to load tasks - using empty list');
      }
      
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await retryFetch('/api/working-hours/settings');

      if (!response) {
        console.log('No response from settings endpoint');
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          console.log('Unauthorized - using default settings');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) {
        console.log('Empty response from settings endpoint');
        return;
      }

      try {
        const data = JSON.parse(text);
        
        // Parse workingDays - handle both string and array formats
        if (data.workingDays) {
          let parsedDays: number[];
          if (typeof data.workingDays === 'string') {
            parsedDays = data.workingDays
              .split(',')
              .map((d: string) => parseInt(d.trim(), 10))
              .filter((d: number) => !isNaN(d));
          } else if (Array.isArray(data.workingDays)) {
            parsedDays = data.workingDays.map((d: any) => 
              typeof d === 'string' ? parseInt(d, 10) : d
            );
          } else {
            parsedDays = DEFAULT_SETTINGS.workingDays;
          }
          
          setWorkingDays(parsedDays.length > 0 ? parsedDays : DEFAULT_SETTINGS.workingDays);
        }
      } catch (parseError) {
        console.error('Error parsing settings JSON:', parseError, 'Response:', text.substring(0, 100));
        // Use defaults on parse error
        setWorkingDays(DEFAULT_SETTINGS.workingDays);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Use defaults on fetch error
      setWorkingDays(DEFAULT_SETTINGS.workingDays);
    }
  };

  const fetchHolidays = async () => {
    try {
      const response = await retryFetch('/api/holidays');

      if (!response) {
        console.log('No response from holidays endpoint');
        setHolidays([]);
        return;
      }

      if (!response.ok) {
        if (response.status === 404) {
          console.log('Holidays endpoint not found');
        }
        setHolidays([]);
        return;
      }

      const text = await response.text();
      if (!text) {
        console.log('Empty response from holidays endpoint');
        setHolidays([]);
        return;
      }

      try {
        const data = JSON.parse(text);
        
        // Handle different response formats
        if (Array.isArray(data)) {
          setHolidays(data.map((h: any) => 
            typeof h === 'string' ? h : h.date || h
          ));
        } else if (data.holidays && Array.isArray(data.holidays)) {
          setHolidays(data.holidays.map((h: any) => h.date || h));
        } else if (data.dates && Array.isArray(data.dates)) {
          setHolidays(data.dates);
        } else {
          console.warn('Unexpected holidays response format:', data);
          setHolidays([]);
        }
      } catch (parseError) {
        console.error('Error parsing holidays JSON:', parseError);
        setHolidays([]);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
      setHolidays([]);
    }
  };

  useEffect(() => {
    if (user) {
      // Run all fetches in parallel
      Promise.all([
        fetchTasks(),
        fetchSettings(),
        fetchHolidays(),
      ]).catch(error => {
        console.error('Error in parallel fetches:', error);
      });
    }
  }, [user]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchTasks(),
        fetchSettings(),
        fetchHolidays(),
      ]);
      toast.success('Calendar refreshed');
    } catch (error) {
      console.error('Error refreshing calendar:', error);
      toast.error('Failed to refresh calendar');
    } finally {
      setIsLoading(false);
    }
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
