import { useState } from "react";
import { Timeline } from "@/components/Timeline";
import { StatsPanel } from "@/components/StatsPanel";
import { Task, WeeklyStats } from "@/types";
import { CalendarDays, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Dummy Data
const initialTasks: Task[] = [
  {
    id: "1",
    cardName: "Business Plan",
    stepIndex: 1,
    description: "Review initial draft and identify missing sections based on the template.",
    durationHours: 1.5,
    startTime: "08:00",
    endTime: "09:30",
    isCompleted: true,
    isBlocker: false,
    isPriority: true,
    priorityLevel: "HIGH",
    hasDutch: false,
    attachments: []
  },
  {
    id: "2",
    cardName: "Email Correspondence",
    stepIndex: 1,
    description: "Draft response to the municipality regarding the registration delay.",
    durationHours: 1.0,
    startTime: "09:30",
    endTime: "10:30",
    isCompleted: false,
    isBlocker: true,
    isPriority: true,
    priorityLevel: "CRITICAL",
    hasDutch: true,
    dutchPercentage: 45,
    attachments: [{ name: "Brief.pdf", url: "#", type: "pdf" }]
  },
  {
    id: "3",
    cardName: "Tax Office Registration",
    stepIndex: 2,
    description: "Fill out form 283-B for VAT registration.",
    durationHours: 2.0,
    startTime: "10:45",
    endTime: "12:45",
    isCompleted: false,
    isBlocker: false,
    isPriority: false,
    priorityLevel: "NORMAL",
    hasDutch: true,
    dutchPercentage: 85,
    attachments: [{ name: "Formulier.pdf", url: "#", type: "pdf" }]
  },
  {
    id: "4",
    cardName: "Website Content",
    stepIndex: 5,
    description: "Write 'About Us' section for the new website.",
    durationHours: 2.5,
    startTime: "14:00",
    endTime: "16:30",
    isCompleted: false,
    isBlocker: false,
    isPriority: false,
    priorityLevel: "NORMAL",
    hasDutch: false,
    attachments: []
  }
];

const weeklyStats: WeeklyStats = {
  totalTasks: 24,
  completedTasks: 14,
  totalHours: 42,
  completedHours: 26,
  accuracy: 105
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

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
              <p className="text-xs text-muted-foreground">Tuesday, Dec 3, 2025</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tasks..." className="pl-9 w-64 bg-secondary/50 border-none" />
            </div>
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
                  You have <span className="font-bold text-primary">3 tasks</span> remaining today. 
                  Your focus block starts at 14:00.
                </p>
                <Button className="w-full">View Weekly Schedule</Button>
              </div>
            </div>
            
            <StatsPanel stats={weeklyStats} />
            
            <div className="bg-card rounded-xl p-4 border">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Upcoming
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-12 text-center bg-secondary rounded p-1">
                    <div className="text-xs uppercase text-muted-foreground">Wed</div>
                    <div className="font-bold">04</div>
                  </div>
                  <div>
                    <p className="font-medium">Client Meeting</p>
                    <p className="text-xs text-muted-foreground">10:00 - 11:00</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-12 text-center bg-secondary rounded p-1">
                    <div className="text-xs uppercase text-muted-foreground">Thu</div>
                    <div className="font-bold">05</div>
                  </div>
                  <div>
                    <p className="font-medium">Quarterly Review</p>
                    <p className="text-xs text-muted-foreground">14:00 - 15:30</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Timeline */}
          <div className="lg:col-span-8">
            <div className="bg-card rounded-2xl shadow-sm border min-h-[600px] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-32 bg-[url('/images/hero-bg.png')] bg-cover opacity-20" />
              <div className="relative z-10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Today's Timeline</h2>
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
