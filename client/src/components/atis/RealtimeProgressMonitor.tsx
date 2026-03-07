import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Clock, Zap, Wifi, WifiOff } from 'lucide-react';
import { useATISWebSocket } from '@/hooks/useATISWebSocket';
import type {
  AnalysisProgressUpdate,
  PhaseCompletionEvent,
  AnalysisCompleteEvent,
  WebSocketError,
} from '@/hooks/useATISWebSocket';

interface RealtimeProgressMonitorProps {
  sessionId: string;
  taskId: string;
}

export default function RealtimeProgressMonitor({
  sessionId,
  taskId,
}: RealtimeProgressMonitorProps) {
  const [phaseProgress, setPhaseProgress] = useState<Record<number, number | undefined>>({});
  const [phaseConfidence, setPhaseConfidence] = useState<Record<number, number | undefined>>({});
  const [phaseStatus, setPhaseStatus] = useState<Record<number, 'pending' | 'started' | 'in_progress' | 'completed' | 'failed' | undefined>>({});
  const [completedPhases, setCompletedPhases] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [errors, setErrors] = useState<WebSocketError[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [overallConfidence, setOverallConfidence] = useState<number>(0);

  const { isConnected, error: wsError } = useATISWebSocket({
    sessionId,
    autoConnect: true,
    onProgressUpdate: handleProgressUpdate,
    onPhaseCompletion: handlePhaseCompletion,
    onAnalysisComplete: handleAnalysisComplete,
    onError: handleError,
    onConfidenceUpdate: handleConfidenceUpdate,
  });

  function handleProgressUpdate(update: AnalysisProgressUpdate) {
    setPhaseProgress((prev) => ({
      ...prev,
      [update.phase]: update.progress ?? 0,
    }));

    setPhaseStatus((prev) => ({
      ...prev,
      [update.phase]: update.status,
    }));

    if (update.confidence !== undefined) {
      setPhaseConfidence((prev) => ({
        ...prev,
        [update.phase]: update.confidence,
      }));
    }
  }

  function handlePhaseCompletion(event: PhaseCompletionEvent) {
    setPhaseStatus((prev) => ({
      ...prev,
      [event.phase]: 'completed',
    }));
    setPhaseProgress((prev) => ({
      ...prev,
      [event.phase]: 100,
    }));
    setPhaseConfidence((prev) => ({
      ...prev,
      [event.phase]: event.confidence,
    }));
    setCompletedPhases((prev) => prev + 1);
    setTotalDuration(event.duration);
  }

  function handleAnalysisComplete(event: AnalysisCompleteEvent) {
    setAnalysisComplete(true);
    setOverallConfidence(event.overallConfidence);
    setCompletedPhases(event.completedPhases);
    setTotalDuration(event.totalDuration);
  }

  function handleError(error: WebSocketError) {
    setErrors((prev) => [...prev, error]);
    setPhaseStatus((prev) => ({
      ...prev,
      [error.phase]: 'failed',
    }));
  }

  function handleConfidenceUpdate(data: { phase: number; confidence: number }) {
    setPhaseConfidence((prev) => ({
      ...prev,
      [data.phase]: data.confidence,
    }));
  }

  const phases = [3, 4, 5, 6, 7, 8, 9, 10];
  const overallProgress = (completedPhases / phases.length) * 100;

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-600">Disconnected</span>
                </>
              )}
            </div>
            {wsError && (
              <span className="text-xs text-red-600">{wsError.message}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overall Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Completion</span>
              <span className="text-sm font-bold">{Math.round(overallProgress)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{completedPhases}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{phases.length - completedPhases}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{Math.round(overallConfidence)}%</p>
              <p className="text-xs text-muted-foreground">Confidence</p>
            </div>
          </div>

          {analysisComplete && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200 mt-4">
              <p className="text-sm text-green-900">✓ Analysis completed successfully</p>
              <p className="text-xs text-green-700 mt-1">
                Total duration: {(totalDuration / 1000).toFixed(1)}s
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Phase Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {phases.map((phase) => (
            <div key={phase} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {phaseStatus[phase] === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  {phaseStatus[phase] === 'in_progress' && (
                    <Zap className="h-4 w-4 text-blue-600 animate-pulse" />
                  )}
                  {phaseStatus[phase] === 'failed' && (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  {phaseStatus[phase] === undefined && (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">Phase {phase}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{phaseProgress[phase] ?? 0}%</p>
                  {phaseConfidence[phase] !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round(phaseConfidence[phase] ?? 0)}% confidence
                    </p>
                  )}
                </div>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${phaseProgress[phase] ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-lg text-red-900">Errors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {errors.map((error, idx) => (
              <div key={idx} className="flex gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Phase {error.phase}</p>
                  <p className="text-red-700">{error.error}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
