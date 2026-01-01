import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  BarChart3
} from 'lucide-react';

interface WorkerCompliance {
  vaId: number;
  vaName: string;
  totalCheckins: number;
  respondedCheckins: number;
  missedCheckins: number;
  responseRate: number;
  averageResponseTimeMinutes: number;
  onTimeResponseRate: number;
  lastCheckinDate: string | null;
  complianceTrend: 'improving' | 'stable' | 'declining';
}

interface DailyStats {
  totalCheckins: number;
  respondedCheckins: number;
  missedCheckins: number;
  responseRate: number;
  averageResponseTime: number;
}

export function ComplianceDashboard() {
  const [workers, setWorkers] = useState<WorkerCompliance[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    try {
      const response = await fetch('/api/trello-webhook/compliance');
      const data = await response.json();
      if (data.success) {
        setWorkers(data.workers || []);
        setDailyStats(data.daily || null);
      }
    } catch (error) {
      console.error('Failed to load compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <Badge className="bg-green-100 text-green-800">Improving</Badge>;
      case 'declining':
        return <Badge className="bg-red-100 text-red-800">Declining</Badge>;
      default:
        return <Badge variant="secondary">Stable</Badge>;
    }
  };

  const getResponseRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle>Today's Compliance Overview</CardTitle>
          </div>
          <CardDescription>
            Check-in response metrics for today
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{dailyStats.totalCheckins}</div>
                <div className="text-sm text-muted-foreground">Total Check-ins</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{dailyStats.respondedCheckins}</div>
                <div className="text-sm text-muted-foreground">Responded</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{dailyStats.missedCheckins}</div>
                <div className="text-sm text-muted-foreground">Missed</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{dailyStats.responseRate}%</div>
                <div className="text-sm text-muted-foreground">Response Rate</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No check-in data for today yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Worker Compliance Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Worker Response Metrics</CardTitle>
          </div>
          <CardDescription>
            Individual compliance tracking per worker (no escalation to founder)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No compliance data recorded yet</p>
              <p className="text-sm mt-1">Data will appear after check-ins are sent</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workers.map((worker) => (
                <div 
                  key={worker.vaId} 
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{worker.vaName}</h3>
                        {getTrendBadge(worker.complianceTrend)}
                      </div>
                      {worker.lastCheckinDate && (
                        <p className="text-sm text-muted-foreground">
                          Last response: {new Date(worker.lastCheckinDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(worker.complianceTrend)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Response Rate</div>
                      <div className={`text-lg font-semibold ${getResponseRateColor(worker.responseRate)}`}>
                        {worker.responseRate}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">On-Time Rate</div>
                      <div className={`text-lg font-semibold ${getResponseRateColor(worker.onTimeResponseRate)}`}>
                        {worker.onTimeResponseRate}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Avg Response</div>
                      <div className="text-lg font-semibold flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {worker.averageResponseTimeMinutes}m
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Missed</div>
                      <div className="text-lg font-semibold text-red-600">
                        {worker.missedCheckins}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Check-in Progress</span>
                      <span>{worker.respondedCheckins}/{worker.totalCheckins}</span>
                    </div>
                    <Progress value={worker.responseRate} className="h-2" />
                  </div>

                  <div className="flex gap-2 mt-3 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {worker.respondedCheckins} responded
                    </div>
                    <div className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-3 w-3" />
                      {worker.missedCheckins} missed
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ComplianceDashboard;
