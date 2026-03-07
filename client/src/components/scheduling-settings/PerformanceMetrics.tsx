import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

export interface PerformanceMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageExecutionTime: number;
  averageTasksPerOperation: number;
  conflictsDetected: number;
  conflictsResolved: number;
  lastUpdated: Date;
  trend: {
    successRate: number;
    executionTimeTrend: 'improving' | 'declining' | 'stable';
    operationsTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

const DEFAULT_METRICS: PerformanceMetrics = {
  totalOperations: 0,
  successfulOperations: 0,
  failedOperations: 0,
  averageExecutionTime: 0,
  averageTasksPerOperation: 0,
  conflictsDetected: 0,
  conflictsResolved: 0,
  lastUpdated: new Date(),
  trend: {
    successRate: 0,
    executionTimeTrend: 'stable',
    operationsTrend: 'stable',
  },
};

interface PerformanceMetricsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport?: () => Promise<void>;
}

export function PerformanceMetrics({
  open,
  onOpenChange,
  onExport,
}: PerformanceMetricsProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(DEFAULT_METRICS);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (open) {
      loadMetrics();
    }
  }, [open]);

  const loadMetrics = async () => {
    try {
      const saved = localStorage.getItem('performanceMetrics');
      if (saved) {
        const parsed = JSON.parse(saved);
        setMetrics({
          ...parsed,
          lastUpdated: new Date(parsed.lastUpdated),
        });
      }
    } catch (e) {
      console.error('Failed to load performance metrics:', e);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      if (onExport) {
        await onExport();
      } else {
        // Default export as JSON
        const dataStr = JSON.stringify(metrics, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `performance-metrics-${new Date().toISOString()}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export metrics:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const successRate = metrics.totalOperations > 0
    ? ((metrics.successfulOperations / metrics.totalOperations) * 100).toFixed(1)
    : 0;

  const failureRate = metrics.totalOperations > 0
    ? ((metrics.failedOperations / metrics.totalOperations) * 100).toFixed(1)
    : 0;

  const conflictResolutionRate = metrics.conflictsDetected > 0
    ? ((metrics.conflictsResolved / metrics.conflictsDetected) * 100).toFixed(1)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Performance Metrics</DialogTitle>
          <DialogDescription>
            View scheduling performance and optimization suggestions
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full py-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Total Operations */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalOperations}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    All-time batch operations
                  </p>
                </CardContent>
              </Card>

              {/* Success Rate */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{successRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.successfulOperations} successful
                  </p>
                </CardContent>
              </Card>

              {/* Average Execution Time */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.averageExecutionTime.toFixed(1)}s</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per operation
                  </p>
                </CardContent>
              </Card>

              {/* Average Tasks Per Operation */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Tasks/Op</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.averageTasksPerOperation.toFixed(1)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tasks per operation
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Operation Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Successful Operations</span>
                  <Badge variant="default" className="bg-green-600">
                    {metrics.successfulOperations}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Failed Operations</span>
                  <Badge variant="destructive">
                    {metrics.failedOperations}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Failure Rate</span>
                  <Badge variant="secondary">
                    {failureRate}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Performance Trends</CardTitle>
                <CardDescription>
                  Historical performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">Operations Trend</p>
                      <p className="text-xs text-muted-foreground">
                        {metrics.trend.operationsTrend === 'increasing' && 'Increasing volume'}
                        {metrics.trend.operationsTrend === 'decreasing' && 'Decreasing volume'}
                        {metrics.trend.operationsTrend === 'stable' && 'Stable volume'}
                      </p>
                    </div>
                  </div>
                  {metrics.trend.operationsTrend === 'increasing' && (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  )}
                  {metrics.trend.operationsTrend === 'decreasing' && (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>

                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium">Execution Time Trend</p>
                      <p className="text-xs text-muted-foreground">
                        {metrics.trend.executionTimeTrend === 'improving' && 'Getting faster'}
                        {metrics.trend.executionTimeTrend === 'declining' && 'Getting slower'}
                        {metrics.trend.executionTimeTrend === 'stable' && 'Stable performance'}
                      </p>
                    </div>
                  </div>
                  {metrics.trend.executionTimeTrend === 'improving' && (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  )}
                  {metrics.trend.executionTimeTrend === 'declining' && (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>

                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Success Rate Trend</p>
                      <p className="text-xs text-muted-foreground">
                        Current: {successRate}%
                      </p>
                    </div>
                  </div>
                  {parseFloat(successRate as string) >= 90 && (
                    <Badge className="bg-green-600">Excellent</Badge>
                  )}
                  {parseFloat(successRate as string) >= 70 && parseFloat(successRate as string) < 90 && (
                    <Badge className="bg-amber-600">Good</Badge>
                  )}
                  {parseFloat(successRate as string) < 70 && (
                    <Badge className="bg-red-600">Needs Improvement</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conflicts Tab */}
          <TabsContent value="conflicts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Conflict Resolution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Conflicts Detected</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.conflictsDetected}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Conflicts Resolved</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.conflictsResolved}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="p-4 border rounded bg-blue-50 dark:bg-blue-950">
                  <p className="text-sm font-medium">Resolution Rate</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-secondary rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${conflictResolutionRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{conflictResolutionRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground">
          Last updated: {metrics.lastUpdated.toLocaleString()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export Metrics'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
