import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, Zap, Database } from 'lucide-react';

interface PreparationPhaseViewProps {
  status: 'pending' | 'completed' | 'failed';
  dataGatheringTime?: number; // in milliseconds
  reasoningTime?: number; // in milliseconds
  dataSourcesCount?: number;
  contextSummary?: string;
  error?: string;
}

export function PreparationPhaseView({
  status,
  dataGatheringTime = 0,
  reasoningTime = 0,
  dataSourcesCount = 0,
  contextSummary,
  error,
}: PreparationPhaseViewProps) {
  const totalTime = (dataGatheringTime + reasoningTime) / 1000; // Convert to seconds
  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    if (seconds < 1) return '<1s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-lg">Preparation Phase</CardTitle>
              <CardDescription>Data gathering and analysis preparation (Phases 1-2)</CardDescription>
            </div>
          </div>
          <Badge
            variant={status === 'completed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary'}
            className="text-sm"
          >
            {status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
            {status === 'pending' && <Clock className="h-3 w-3 mr-1 animate-spin" />}
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Phase 1: Context Engine */}
          <div className="p-3 rounded-lg bg-white border border-blue-100">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-sm">Phase 1: Context Engine</h4>
                <p className="text-xs text-muted-foreground">Data gathering from Trello</p>
              </div>
              {status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
              {status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Database className="h-3 w-3 text-muted-foreground" />
                <span>{dataSourcesCount} data sources gathered</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>Time: {formatTime(dataGatheringTime)}</span>
              </div>
            </div>
          </div>

          {/* Phase 2: Reasoning Engine */}
          <div className="p-3 rounded-lg bg-white border border-blue-100">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-sm">Phase 2: Reasoning Engine</h4>
                <p className="text-xs text-muted-foreground">Analysis and breakdown generation</p>
              </div>
              {status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
              {status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Zap className="h-3 w-3 text-muted-foreground" />
                <span>Analyzing context data</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>Time: {formatTime(reasoningTime)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Context Summary */}
        {contextSummary && status === 'completed' && (
          <div className="p-3 rounded-lg bg-white border border-blue-100">
            <h4 className="font-semibold text-sm mb-2">Context Summary</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{contextSummary}</p>
          </div>
        )}

        {/* Error Message */}
        {error && status === 'failed' && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-red-900">Preparation Failed</h4>
                <p className="text-xs text-red-800 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Total Time Summary */}
        {status === 'completed' && (
          <div className="pt-2 border-t border-blue-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Preparation Time</span>
              <span className="text-sm font-semibold text-blue-600">{formatTime(dataGatheringTime + reasoningTime)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
