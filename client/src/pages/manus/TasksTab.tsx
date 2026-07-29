import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Calendar,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { TaskCard } from '@/components/TaskCard';
import { Task } from '@/types';

interface WorkerProfile {
  id: number;
  name: string;
  email: string | null;
  timezone: string;
  workStartHour: number;
  workEndHour: number;
  workingDays: string;
}

export default function TasksTab() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [activeTab, setActiveTab] = useState('today');
  const [syncing, setSyncing] = useState<string | null>(null);

  useWebSocket({
    onTaskPriorityChanged: (data) => {
      toast.info(`Task priority updated to ${data.priority.toUpperCase()}!`);
      fetchWorkerData();
    }
  });

  useEffect(() => {
    fetchWorkerData();
  }, []);

  const fetchWorkerData = async () => {
    setLoading(true);
    try {
      // Fetch worker profile
      const profileRes = await fetch('/api/va/worker/profile', {
        credentials: 'include',
      });
      
      if (profileRes.status === 401) {
        setLoading(false);
        return;
      }
      
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setWorkerProfile(profile);
      } else if (profileRes.status === 404) {
        setLoading(false);
        return;
      }

      // Fetch assigned tasks
      const tasksRes = await fetch('/api/va/worker/tasks', {
        credentials: 'include',
      });
      
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching worker data:', error);
      toast.error('Failed to load your tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string, completed: boolean) => {
    setSyncing(taskId);
    try {
      const res = await fetch(`/api/va/worker/tasks/${encodeURIComponent(taskId)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed }),
      });

      if (res.ok) {
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, isCompleted: completed } : t
        ));
        toast.success(completed ? 'Task marked complete' : 'Task marked incomplete');
      } else {
        toast.error('Failed to update task');
      }
    } catch (error) {
      toast.error('Failed to update task');
    } finally {
      setSyncing(null);
    }
  };

  const handleMarkForReview = async (taskId: string) => {
    setSyncing(taskId);
    try {
      const res = await fetch(`/api/va/worker/tasks/${encodeURIComponent(taskId)}/review`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, status: 'completed', isCompleted: true } : t
        ));
        toast.success('Task marked complete');
      } else {
        toast.error('Failed to submit for review');
      }
    } catch (error) {
      toast.error('Failed to submit for review');
    } finally {
      setSyncing(null);
    }
  };

  // Filter tasks by date
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = useMemo(() => 
    tasks.filter(t => t.date <= today && !t.isCompleted), [tasks, today]);
  const upcomingTasks = useMemo(() => 
    tasks.filter(t => t.date > today && !t.isCompleted), [tasks, today]);
  const completedTasks = useMemo(() => 
    tasks.filter(t => t.isCompleted), [tasks]);

  const handleSaveHandoff = async (taskId: string, notes: string) => {
    if (!workerProfile) return;
    try {
      await fetch('/api/handoff/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, workerId: workerProfile.id, notes })
      });
      toast.success('Handoff notes saved');
    } catch (e) {
      toast.error('Failed to save handoff notes');
    }
  };

  const handleAskFounder = async (taskId: string, question: string) => {
    if (!workerProfile) return;
    try {
      await fetch('/api/communication/ask-founder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, workerId: workerProfile.id, question })
      });
      toast.success('Question sent to Founder');
    } catch (e) {
      toast.error('Failed to send question');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Today</span>
            </div>
            <p className="text-2xl font-bold mt-1">{todayTasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Upcoming</span>
            </div>
            <p className="text-2xl font-bold mt-1">{upcomingTasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{completedTasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Hours Today</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {todayTasks.reduce((sum, t) => sum + (t.durationHours || 0), 0).toFixed(1)}h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="today">
            Today ({todayTasks.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-3">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : todayTasks.length === 0 ? (
            <Card className="py-12 border-0 bg-card/50">
              <CardContent className="text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">All done for today!</h3>
                <p className="text-muted-foreground">No tasks scheduled for today.</p>
              </CardContent>
            </Card>
          ) : (
            todayTasks
              .sort((a, b) => {
                if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                return (a.startTime || '').localeCompare(b.startTime || '');
              })
              .map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  role="worker"
                  onToggle={(id) => handleCompleteTask(id, !task.isCompleted)}
                  onSaveHandoff={handleSaveHandoff}
                  onAskFounder={handleAskFounder}
                />
              ))
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-3">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : upcomingTasks.length === 0 ? (
            <Card className="py-12 border-0 bg-card/50">
              <CardContent className="text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">No upcoming tasks</h3>
                <p className="text-muted-foreground">Check back later for new assignments.</p>
              </CardContent>
            </Card>
          ) : (
            upcomingTasks
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  role="worker"
                  onToggle={(id) => handleCompleteTask(id, !task.isCompleted)}
                  onSaveHandoff={handleSaveHandoff}
                  onAskFounder={handleAskFounder}
                />
              ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : completedTasks.length === 0 ? (
            <Card className="py-12 border-0 bg-card/50">
              <CardContent className="text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">No completed tasks yet</h3>
                <p className="text-muted-foreground">Complete tasks to see them here.</p>
              </CardContent>
            </Card>
          ) : (
            completedTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                role="worker"
                onToggle={(id) => handleCompleteTask(id, !task.isCompleted)}
                onSaveHandoff={handleSaveHandoff}
                onAskFounder={handleAskFounder}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
