import { Task } from "@/types";
import { useMemo } from "react";

interface WorkloadHeatmapProps {
  tasks: Task[];
}

export function WorkloadHeatmap({ tasks }: WorkloadHeatmapProps) {
  const heatmapData = useMemo(() => {
    // Aggregate hours by date
    const dateMap = new Map<string, number>();
    
    tasks.forEach(task => {
      const existing = dateMap.get(task.date) || 0;
      dateMap.set(task.date, existing + task.durationHours);
    });
    
    // Convert to array and sort
    const dates = Array.from(dateMap.entries())
      .map(([date, hours]) => ({
        date,
        hours,
        dateObj: new Date(date)
      }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    
    return dates;
  }, [tasks]);
  
  // Calculate intensity (0-4 scale like GitHub)
  const maxHours = Math.max(...heatmapData.map(d => d.hours), 9);
  
  const getIntensity = (hours: number): number => {
    if (hours === 0) return 0;
    if (hours <= 3) return 1;
    if (hours <= 6) return 2;
    if (hours <= 9) return 3;
    return 4;
  };
  
  const getColor = (intensity: number): string => {
    const colors = [
      "bg-secondary", // 0
      "bg-green-200 dark:bg-green-900", // 1
      "bg-green-300 dark:bg-green-700", // 2
      "bg-green-400 dark:bg-green-600", // 3
      "bg-green-500 dark:bg-green-500", // 4
    ];
    return colors[intensity] || colors[0];
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Workload Intensity</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={`w-3 h-3 rounded-sm ${getColor(i)}`} />
          ))}
          <span>More</span>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {heatmapData.slice(0, 70).map(({ date, hours, dateObj }) => {
          const intensity = getIntensity(hours);
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          return (
            <div
              key={date}
              className={`aspect-square rounded-sm ${getColor(intensity)} cursor-pointer hover:ring-2 hover:ring-primary transition-all`}
              title={`${dateStr}: ${hours.toFixed(1)}h`}
            />
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Showing {Math.min(heatmapData.length, 70)} days • 
        Peak: {maxHours.toFixed(1)}h/day
      </p>
    </div>
  );
}
