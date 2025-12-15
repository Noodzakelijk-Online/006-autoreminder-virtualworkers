import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Activity, Zap, Database, Wifi } from 'lucide-react';
import { toast } from 'sonner';

interface PerformanceMetrics {
  cache: {
    hits: number;
    misses: number;
    totalRequests: number;
    hitRate: number;
    missRate: number;
    lastUpdated: string;
  };
  queue: {
    totalRequests: number;
    uniqueRequests: number;
    deduplicatedRequests: number;
    deduplicationRate: number;
    activeRequests: number;
    pendingRequests: number;
  };
  websocket: {
    connected: boolean;
    totalClients: number;
    userClients: number;
    totalUsers: number;
    status: string;
  };
  performance: {
    apiCallsSaved: number;
    apiCallReduction: number;
    timeSavedMs: number;
    timeSavedSeconds: number;
    avgCacheHitTime: number;
    avgApiCallTime: number;
  };
  summary: {
    overallHealth: string;
    recommendations: string[];
  };
}

export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async (showToast = false) => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/metrics/performance');
      
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data);
      
      if (showToast) {
        toast.success('Metrics refreshed');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchMetrics(), 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading Performance Metrics...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-blue-500';
      case 'poor':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'excellent':
        return <Badge className="bg-green-500">Excellent</Badge>;
      case 'good':
        return <Badge className="bg-blue-500">Good</Badge>;
      case 'poor':
        return <Badge className="bg-yellow-500">Needs Improvement</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Metrics</h2>
          <p className="text-muted-foreground">
            Monitor cache, queue, and WebSocket performance
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchMetrics(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Overall System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {getHealthBadge(metrics.summary.overallHealth)}
              <div className="mt-4 space-y-2">
                {metrics.summary.recommendations.map((rec, index) => (
                  <p key={index} className="text-sm text-muted-foreground">
                    • {rec}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cache Hit Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Cache Hit Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.cache.hitRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.cache.hits} hits / {metrics.cache.totalRequests} requests
            </p>
            <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${metrics.cache.hitRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* API Call Reduction */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              API Call Reduction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.performance.apiCallReduction}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.performance.apiCallsSaved} calls saved
            </p>
            <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${metrics.performance.apiCallReduction}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Time Saved */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Time Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.performance.timeSavedSeconds}s</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {metrics.performance.avgCacheHitTime}ms vs {metrics.performance.avgApiCallTime}ms
            </p>
            <div className="mt-2 flex items-center gap-1 text-green-600">
              <TrendingUp className="h-3 w-3" />
              <span className="text-xs font-medium">
                {Math.round((metrics.performance.avgApiCallTime / metrics.performance.avgCacheHitTime) * 10) / 10}x faster
              </span>
            </div>
          </CardContent>
        </Card>

        {/* WebSocket Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              WebSocket Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${metrics.websocket.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-2xl font-bold capitalize">{metrics.websocket.status}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.websocket.totalClients} clients / {metrics.websocket.totalUsers} users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cache Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Cache Statistics</CardTitle>
            <CardDescription>Database caching performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{metrics.cache.totalRequests}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cache Hits</p>
                <p className="text-2xl font-bold text-green-600">{metrics.cache.hits}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cache Misses</p>
                <p className="text-2xl font-bold text-yellow-600">{metrics.cache.misses}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Miss Rate</p>
                <p className="text-2xl font-bold">{metrics.cache.missRate}%</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(metrics.cache.lastUpdated).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Queue Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Request Queue Statistics</CardTitle>
            <CardDescription>Request deduplication performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{metrics.queue.totalRequests}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique Requests</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.queue.uniqueRequests}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deduplicated</p>
                <p className="text-2xl font-bold text-green-600">{metrics.queue.deduplicatedRequests}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dedup Rate</p>
                <p className="text-2xl font-bold">{metrics.queue.deduplicationRate}%</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Active: {metrics.queue.activeRequests} | Pending: {metrics.queue.pendingRequests}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
