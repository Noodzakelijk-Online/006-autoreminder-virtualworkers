import { Card, CardContent } from "@/components/ui/card";
import { WeeklyStats } from "@/types";
import { CheckCircle2, ListTodo } from "lucide-react";

interface StatsPanelProps {
  stats: WeeklyStats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="bg-primary/5 border-none">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <ListTodo className="h-4 w-4" />
            Total Tasks
          </div>
          <p className="text-2xl font-bold">{stats.totalTasks}</p>
        </CardContent>
      </Card>
      
      <Card className="bg-green-500/10 border-none">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Completed
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
        </CardContent>
      </Card>
    </div>
  );
}
