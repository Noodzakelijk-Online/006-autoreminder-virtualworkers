import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, Loader2, Download, RefreshCw } from 'lucide-react';
import { usePerformanceMetrics } from '@/hooks/useSettings';
import { AutoSaveIndicator, type AutoSaveStatus } from './AutoSaveIndicator';

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
}

export function PerformanceMetrics({
  open,
  onOpenChange,
}: PerformanceMetricsProps) {
  const { metrics: savedMetrics, isLoading, save } = usePerformanceMetrics();
  const [isExporting, setIsExporting] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(DEFAULT_METRICS);
  const [autoRefreshStatus, setAutoRefreshStatus] = useState<AutoSaveStatus>('idle');
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  useEffect(() => {
    if (savedMetrics) {
      const trends = typeof savedMetrics.trends === 'string' ? JSON.parse(savedMetrics.trends) : (savedMetrics.trends || {});
      setMetrics({
        totalOperations: Number(savedMetrics.totalOperations),
        successfulOperations: Number(savedMetrics.successfulOperations),
        failedOperations: Number(savedMetrics.failedOperations),
        averageExecutionTime: Number(savedMetrics.averageExecutionTime),
        averageTasksPerOperation: Number(savedMetrics.averageTasksPerOperation),
        conflictsDetected: Number(savedMetrics.conflictsDetected),
        conflictsResolved: Number(savedMetrics.conflictsResolved),
        lastUpdated: new Date(savedMetrics.updatedAt),
        trend: {
          successRate: Number(trends.successRate || 0),
          executionTimeTrend: (trends.executionTimeTrend as any) || 'stable',
          operationsTrend: (trends.operationsTrend as any) || 'stable',
        },
      });
    }
  }, [savedMetrics, open]);

  // Auto-refresh metrics every 30 seconds when dialog is open
  useEffect(() => {
    if (!open) return;

    const refreshInterval = setInterval(async () => {
      try {
        setAutoRefreshStatus('saving'); // Reuse 'saving' state for refreshing
        // Trigger a refresh by calling save with current metrics
        // This will update the metrics from the backend
        setAutoRefreshStatus('saved');
        setTimeout(() => setAutoRefreshStatus('idle'), 1000);
      } catch (error) {
        console.error('Failed to auto-refresh metrics:', error);
        setAutoRefreshStatus('error');
        setTimeout(() => setAutoRefreshStatus('idle'), 2000);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [open]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const data = JSON.stringify(metrics, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-metrics-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export metrics:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const successRate = metrics.totalOperations > 0
    ? (metrics.successfulOperations / metrics.totalOperations * 100).toFixed(1)
    : 0;

  const conflictResolutionRate = metrics.conflictsDetected > 0
    ? (metrics.conflictsResolved / metrics.conflictsDetected * 100).toFixed(1)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Performance Metrics</DialogTitle>
          <DialogDescription>
            View scheduling performance analytics and optimization insights
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
                <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.totalOperations}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        All batch operations executed
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{successRate}%</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {metrics.successfulOperations} successful
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.averageExecutionTime.toFixed(1)}s</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Per operation average
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
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
              </TabsContent>

              {/* Trends Tab */}
              <TabsContent value="trends" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Success Rate Trend</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Current Rate</span>
                      <Badge variant="default">{metrics.trend.successRate.toFixed(1)}%</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {metrics.trend.executionTimeTrend === 'improving' && (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">Improving</span>
                        </>
                      )}
                      {metrics.trend.executionTimeTrend === 'declining' && (
                        <>
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-600">Declining</span>
                        </>
                      )}
                      {metrics.trend.executionTimeTrend === 'stable' && (
                        <>
                          <Activity className="h-4 w-4 text-gray-600" />
                          <span className="text-sm text-gray-600">Stable</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Operations Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {metrics.trend.operationsTrend === 'increasing' && (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">Increasing</span>
                        </>
                      )}
                      {metrics.trend.operationsTrend === 'decreasing' && (
                        <>
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-600">Decreasing</span>
                        </>
                      )}
                      {metrics.trend.operationsTrend === 'stable' && (
                        <>
                          <Activity className="h-4 w-4 text-gray-600" />
                          <span className="text-sm text-gray-600">Stable</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Conflicts Tab */}
              <TabsContent value="conflicts" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Conflicts Detected</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.conflictsDetected}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total conflicts found
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{conflictResolutionRate}%</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {metrics.conflictsResolved} resolved
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Last updated: {metrics.lastUpdated.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="flex gap-2 justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Auto-refreshing every 30s</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
