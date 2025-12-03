import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WeeklyStats } from "@/types";
import { CheckCircle2, Clock, Target, TrendingUp } from "lucide-react";

interface StatsPanelProps {
  stats: WeeklyStats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  const completionRate = Math.round((stats.completedTasks / stats.totalTasks) * 100) || 0;
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Weekly Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completion Rate</span>
              <span className="font-medium">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                Tasks
              </div>
              <p className="text-2xl font-bold">{stats.completedTasks}/{stats.totalTasks}</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Hours
              </div>
              <p className="text-2xl font-bold">{stats.completedHours}/{stats.totalHours}</p>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Time Accuracy
              </div>
              <span className={`font-bold ${
                stats.accuracy > 110 ? "text-orange-500" : 
                stats.accuracy < 90 ? "text-green-500" : 
                "text-blue-500"
              }`}>
                {stats.accuracy}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.accuracy > 110 ? "Tasks taking longer than estimated" : 
               stats.accuracy < 90 ? "Tasks completed faster than estimated" : 
               "Estimates are accurate"}
            </p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-primary/5 border-none">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">💡 Productivity Tip</h3>
          <p className="text-sm text-muted-foreground">
            You have a focus block coming up at 14:00. Try to clear small admin tasks before then to maximize deep work time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
