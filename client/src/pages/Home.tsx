import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Timeline } from "@/components/Timeline";
import { StatsPanel } from "@/components/StatsPanel";
import { WorkloadHeatmap } from "@/components/WorkloadHeatmap";
import { Task, WeeklyStats } from "@/types";
import { CalendarDays, Bell, Search, RefreshCw, Settings } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Import generated data
import tasksData from "../data/tasks.json";

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
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

  useEffect(() => {
    // Load tasks from JSON
    // In a real app, this would be an API call
    // For now, we use the imported JSON
    
    // Filter for "today" (simulated as Dec 5, 2025 for demo)
    // Filter out archived cards
    const loadedTasks = (tasksData as Task[]).filter(t => !t.isArchived);
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
    
  }, []);

  const handleToggleTask = (id: string) => {
    setTasks(tasks.map(t => 
      t.id === id ? { ...t, isCompleted: !t.isCompleted } : t
    ));
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
              <p className="text-xs text-muted-foreground">Friday, Dec 5, 2025</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tasks..." className="pl-9 w-64 bg-secondary/50 border-none" />
            </div>
            <Link href="/aptlss">
              <Button variant="ghost" size="icon" title="APTLSS Management">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-destructive rounded-full" />
            </Button>
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>JK</AvatarFallback>
            </Avatar>
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
                <h2 className="text-2xl font-bold mb-2">Good Morning, Joyce! ☀️</h2>
                <p className="text-muted-foreground mb-6">
                  You have <span className="font-bold text-primary">{tasks.filter(t => !t.isCompleted).length} tasks</span> remaining. 
                  Your focus block starts at 14:00.
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
            
            <div className="bg-card rounded-xl p-4 border">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Upcoming
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-12 text-center bg-secondary rounded p-1">
                    <div className="text-xs uppercase text-muted-foreground">Mon</div>
                    <div className="font-bold">08</div>
                  </div>
                  <div>
                    <p className="font-medium">Weekly Planning</p>
                    <p className="text-xs text-muted-foreground">09:00 - 10:00</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-12 text-center bg-secondary rounded p-1">
                    <div className="text-xs uppercase text-muted-foreground">Tue</div>
                    <div className="font-bold">09</div>
                  </div>
                  <div>
                    <p className="font-medium">Team Sync</p>
                    <p className="text-xs text-muted-foreground">14:00 - 15:00</p>
                  </div>
                </div>
              </div>
            </div>
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
                
                <Timeline tasks={tasks} onToggleTask={handleToggleTask} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
