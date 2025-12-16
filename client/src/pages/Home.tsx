import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Timeline } from "@/components/Timeline";
import { StatsPanel } from "@/components/StatsPanel";
import { WorkloadHeatmap } from "@/components/WorkloadHeatmap";
import { Task, WeeklyStats } from "@/types";
import { CalendarDays, Bell, Search, RefreshCw, Settings, ListTodo, LogOut, User, Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWebSocket } from "@/hooks/useWebSocket";

// No longer using mock data - fetch from Trello API

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth({ redirectOnUnauthenticated: true });

  // Get current date for display
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const rescheduleMutation = trpc.trello.reschedule.useMutation({
    onSuccess: (data) => {
      toast.success(`Rescheduling complete! ${data.tasksCount} tasks updated.`);
      // Reload tasks
      window.location.reload();
    },
    onError: (error) => {
      toast.error(`Rescheduling failed: ${error.message}`);
    },
  });
  const [stats, setStats] = useState<WeeklyStats>({
    totalTasks: 0,
    completedTasks: 0,
    totalHours: 0,
    completedHours: 0,
    accuracy: 100
  });

  // WebSocket connection for real-time updates
  const { status: wsStatus } = useWebSocket({
    onTaskCompleted: (data) => {
      console.log('Received task completion from WebSocket:', data);
      // Update task in local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === data.taskId 
            ? { ...task, isCompleted: data.isCompleted }
            : task
        )
      );
      toast.info(`Task ${data.isCompleted ? 'completed' : 'uncompleted'} by another client`);
    },
    onCacheInvalidated: () => {
      console.log('Cache invalidated, reloading tasks');
      toast.info('Tasks updated, reloading...');
      window.location.reload();
    },
  });

  useEffect(() => {
    // Fetch tasks from Trello API
    const fetchTasks = async () => {
      setIsLoadingTasks(true);
      try {
        const response = await fetch('/api/trello/tasks');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Error fetching tasks:', errorData);
          // Don't show toast for auth errors - user will be redirected
          if (response.status !== 401) {
            toast.error(`Failed to load tasks: ${errorData.error || response.statusText}`);
          }
          return;
        }
        const data = await response.json();
        
        // Validate response
        if (data.error) {
          console.error('Error fetching tasks:', data.error);
          toast.error(`Failed to load tasks: ${data.error}`);
          return;
        }
        
        // Handle both old format (array) and new format (object with tasks and timezone)
        const tasksArray = Array.isArray(data) ? data : (data.tasks || []);
        
        // Validate tasksArray is actually an array
        if (!Array.isArray(tasksArray)) {
          console.error('Invalid tasks data:', data);
          toast.error('Invalid tasks data received from server');
          return;
        }
        
        const loadedTasks = (tasksArray as Task[]).filter(t => !t.isArchived);
        setTasks(loadedTasks);
    
        // Calculate stats
        const totalTasks = loadedTasks.length;
        const completedTasks = loadedTasks.filter(t => t.isCompleted).length;
        const totalHours = loadedTasks.reduce((acc, t) => acc + t.durationHours, 0);
        const completedHours = loadedTasks.filter(t => t.isCompleted).reduce((acc, t) => acc + t.durationHours, 0);
        
        setStats({
          totalTasks,
          completedTasks,
          totalHours,
          completedHours,
          accuracy: 100 // Placeholder
        });
      } catch (error) {
        console.error('Error fetching tasks:', error);
        // Fallback to empty state on error
        setTasks([]);
      } finally {
        setIsLoadingTasks(false);
      }
    };
    
    fetchTasks();
  }, []);

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newCompletedState = !task.isCompleted;

    // Optimistically update UI
    setTasks(tasks.map(t => 
      t.id === id ? { ...t, isCompleted: newCompletedState } : t
    ));

    try {
      // Sync to Trello
      const response = await fetch(`/api/trello/tasks/${id}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isCompleted: newCompletedState,
          cardId: task.cardId,
          checklistId: task.checklistId,
          checkItemId: task.checkItemId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task in Trello');
      }

      toast.success(newCompletedState ? 'Task completed!' : 'Task marked incomplete');
    } catch (error) {
      console.error('Error syncing task status:', error);
      // Revert on error
      setTasks(tasks.map(t => 
        t.id === id ? { ...t, isCompleted: !newCompletedState } : t
      ));
      toast.error('Failed to sync with Trello. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
              VA
            </div>
            <div>
              <h1 className="font-bold text-lg">Task Dashboard</h1>
              <p className="text-xs text-muted-foreground">{currentDate}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {/* Search - hidden on mobile */}
            <div className="relative hidden lg:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tasks..." className="pl-9 w-64 bg-secondary/50 border-none" />
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-2">
              <Link href="/aptlss">
                <Button variant="ghost" size="icon" title="APTLSS Management">
                  <ListTodo className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="icon" title="Settings">
                  <Settings className="h-5 w-5" />
              </Button>
              </Link>
            </div>
            
            {/* Bell notification - visible on all screens */}
            <Button variant="ghost" size="icon" className="relative" title={wsStatus.connected ? 'Real-time updates connected' : 'Real-time updates disconnected'}>
              <Bell className="h-5 w-5" />
              <span className={`absolute top-2 right-2 h-2 w-2 rounded-full ${wsStatus.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarImage src={user?.email ? `https://www.gravatar.com/avatar/${user.email}?d=mp` : undefined} />
                    <AvatarFallback>{user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email || ''}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/settings">
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Stats */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-card rounded-2xl p-6 shadow-sm border relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[url('/images/card-bg.png')] bg-cover" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2">
                  {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'}, {user?.name?.split(' ')[0] || 'there'}! {new Date().getHours() < 12 ? '☀️' : new Date().getHours() < 17 ? '🌤️' : '🌙'}
                </h2>
                <p className="text-muted-foreground mb-6">
                  You have <span className="font-bold text-primary">{tasks.filter(t => !t.isCompleted).length} tasks</span> remaining.
                  {tasks.length > 0 && tasks.some(t => !t.isCompleted && t.startTime) && (
                    <> Your next task starts at {tasks.find(t => !t.isCompleted && t.startTime)?.startTime || 'TBD'}.</>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => window.scrollTo({ top: document.querySelector('.timeline-section')?.getBoundingClientRect().top! + window.scrollY - 100, behavior: 'smooth' })}
                  >
                    View Weekly Schedule
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => rescheduleMutation.mutate()}
                    disabled={rescheduleMutation.isPending}
                  >
                    {rescheduleMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Reschedule</span>
                  </Button>
                </div>
              </div>
            </div>
            
            <StatsPanel stats={stats} />
            
            <div className="bg-card rounded-xl p-4 border">
              <WorkloadHeatmap tasks={tasks} />
            </div>
            
            {/* Upcoming Tasks - Dynamic based on actual tasks */}
            {tasks.filter(t => !t.isCompleted).length > 0 && (
              <div className="bg-card rounded-xl p-4 border">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Upcoming Tasks
                </h3>
                <div className="space-y-3">
                  {tasks.filter(t => !t.isCompleted).slice(0, 3).map((task, index) => {
                    const today = new Date();
                    const taskDate = new Date(today);
                    taskDate.setDate(today.getDate() + index);
                    return (
                      <div key={task.id} className="flex items-center gap-3 text-sm">
                        <div className="w-12 text-center bg-secondary rounded p-1">
                          <div className="text-xs uppercase text-muted-foreground">
                            {taskDate.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="font-bold">
                            {taskDate.getDate().toString().padStart(2, '0')}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : 'Time TBD'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Main Content - Timeline */}
          <div className="lg:col-span-8">
            <div className="timeline-section bg-card rounded-2xl shadow-sm border min-h-[600px] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-32 bg-[url('/images/hero-bg.png')] bg-cover opacity-20" />
              <div className="relative z-10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Workload Timeline</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Day</Button>
                    <Button variant="ghost" size="sm">Week</Button>
                  </div>
                </div>
                
                <Timeline 
                  tasks={tasks} 
                  onToggleTask={handleToggleTask} 
                  isLoading={isLoadingTasks}
                  onRefresh={() => window.location.reload()}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
