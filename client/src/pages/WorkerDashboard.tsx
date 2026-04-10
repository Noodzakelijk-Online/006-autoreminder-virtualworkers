import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ListTodo,
  Star,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  cardName: string;
  durationHours: number;
  startTime?: string;
  endTime?: string;
  isCompleted: boolean;
  priorityLevel: string;
  date: string;
  status?: string;
}

interface WorkerProfile {
  id: number;
  name: string;
  email: string | null;
  timezone: string;
  workStartHour: number;
  workEndHour: number;
  workingDays: string;
}

export default function WorkerDashboard() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [activeTab, setActiveTab] = useState('today');
  const [syncing, setSyncing] = useState<string | null>(null);

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
        // Not logged in - stay on page and show login prompt
        setLoading(false);
        return;
      }
      
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setWorkerProfile(profile);
      } else if (profileRes.status === 404) {
        // User is logged in but not a worker - show message
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
    tasks.filter(t => t.date === today), [tasks, today]);
  const upcomingTasks = useMemo(() => 
    tasks.filter(t => t.date > today), [tasks, today]);
  const completedTasks = useMemo(() => 
    tasks.filter(t => t.isCompleted), [tasks]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-500 text-white';
      case 'URGENT': return 'bg-orange-500 text-white';
      case 'HIGH': return 'bg-yellow-500 text-black';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const TaskCard = ({ task }: { task: Task }) => (
    <Card className={`transition-all ${task.isCompleted ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="pt-1">
            {syncing === task.id ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Checkbox
                checked={task.isCompleted}
                onCheckedChange={(checked) => handleCompleteTask(task.id, !!checked)}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className={getPriorityColor(task.priorityLevel)} variant="secondary">
                {task.priorityLevel}
              </Badge>

              {task.startTime && task.startTime !== 'TBD' && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {task.startTime} - {task.endTime}
                </span>
              )}
            </div>
            <h4 className={`font-medium ${task.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              {task.cardName} • {task.durationHours}h
            </p>
          </div>
          {task.isCompleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMarkForReview(task.id)}
              disabled={syncing === task.id}
            >
              <Send className="h-4 w-4 mr-1" />
              Submit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Show message for non-workers
  if (!loading && !workerProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Worker Access Required
            </CardTitle>
            <CardDescription>
              This page is for virtual workers only. If you are a worker, please ask your manager to link your account to a worker profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setLocation('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">My Tasks</h1>
                {workerProfile && (
                  <p className="text-sm text-muted-foreground">
                    {workerProfile.name} • {workerProfile.timezone.split('/')[1]?.replace('_', ' ')}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={fetchWorkerData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
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
                {todayTasks.reduce((sum, t) => sum + t.durationHours, 0).toFixed(1)}h
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
              <Card className="py-12">
                <CardContent className="text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All done for today!</h3>
                  <p className="text-muted-foreground">No tasks scheduled for today.</p>
                </CardContent>
              </Card>
            ) : (
              todayTasks
                .sort((a, b) => {
                  if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                  return (a.startTime || '').localeCompare(b.startTime || '');
                })
                .map(task => <TaskCard key={task.id} task={task} />)
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-3">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))
            ) : upcomingTasks.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No upcoming tasks</h3>
                  <p className="text-muted-foreground">Check back later for new assignments.</p>
                </CardContent>
              </Card>
            ) : (
              upcomingTasks
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(task => <TaskCard key={task.id} task={task} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))
            ) : completedTasks.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No completed tasks yet</h3>
                  <p className="text-muted-foreground">Complete tasks to see them here.</p>
                </CardContent>
              </Card>
            ) : (
              completedTasks.map(task => <TaskCard key={task.id} task={task} />)
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
