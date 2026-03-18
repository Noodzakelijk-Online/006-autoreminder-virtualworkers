'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Brain, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { TaskSelector } from '@/components/atis/TaskSelector';
import RealtimeProgressMonitor from '@/components/atis/RealtimeProgressMonitor';
import type { AnalysisCompleteEvent } from '@/hooks/useATISWebSocket';

interface AnalysisData {
  sessionId: string;
  taskId: string;
  taskTitle: string;
  createdAt: string;
  updatedAt: string;
  phase1?: any;
  phase2?: any;
  phase3?: any;
  phase4?: any;
  phase5?: any;
  phase6?: any;
  phase7?: any;
  phase8?: any;
  phase9?: any;
  phase10?: any;
  overallConfidence: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dataGatheringTime?: number;
  reasoningTime?: number;
  dataSourcesCount?: number;
  contextSummary?: string;
}

export default function ATISPhasesAnalysisDashboard() {
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Start analysis mutation using tRPC
  const startAnalysisMutation = trpc.atis.startAnalysis.useMutation({
    onSuccess: (data: any) => {
      setAnalysisData(data.data as AnalysisData);
      setSessionId(data.data?.sessionId || null);
      setError(null);
    },
    onError: (error) => {
      setError(error.message || 'Failed to start analysis');
      setIsAnalyzing(false);
    },
  });

  // Load existing analysis
  const handleLoadAnalysis = async () => {
    if (!selectedTask) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/atis/phases/analyze/${selectedTask}`);
      if (!response.ok) throw new Error('Failed to load analysis');
      const data = await response.json();
      setAnalysisData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Start analysis for all phases
  const handleStartAnalysis = async () => {
    if (!selectedTask) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      // Call tRPC mutation for ATIS analysis
      // The backend will fetch task description from Trello
      await startAnalysisMutation.mutateAsync({
        taskId: selectedTask,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsAnalyzing(false);
    }
  };

  const handleAnalysisComplete = async (event: AnalysisCompleteEvent) => {
    setAnalysisData((prev) => prev ? {
      ...prev,
      status: 'completed',
      overallConfidence: event.overallConfidence,
    } : prev);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">ATIS Phases Analysis</h1>
          <p className="text-muted-foreground">Advanced Task Intelligence System - Comprehensive task analysis across 8 phases</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Analysis Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Select Task from Trello</label>
                  <TaskSelector 
                    selectedTaskId={selectedTask}
                    onTaskSelect={setSelectedTask}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Or enter task ID manually:</label>
                  <input
                    type="text"
                    placeholder="Paste task ID here..."
                    value={selectedTask}
                    onChange={(e) => setSelectedTask(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline" 
                    size="sm"
                    onClick={handleLoadAnalysis}
                    disabled={!selectedTask || isLoading || isAnalyzing}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Load Analysis
                  </Button>
                  <Button
                    onClick={handleStartAnalysis}
                    disabled={!selectedTask || isAnalyzing || isLoading || analysisData?.status === 'in_progress'}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Brain className="w-4 h-4 mr-2" />
                    )}
                    Start Analysis
                  </Button>
                </div>

                {/* Phase Status */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Phase Status</h3>
                  <div className="space-y-2">
                    {[3, 4, 5, 6, 7, 8, 9, 10].map((phase) => (
                      <div key={phase} className="flex items-center justify-between text-sm">
                        <span>Phase {phase}</span>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!analysisData ? (
              <Card className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Select a task and start analysis to view results</p>
                </div>
              </Card>
            ) : analysisData?.status === 'in_progress' && sessionId ? (
              <RealtimeProgressMonitor
                sessionId={sessionId}
                taskId={selectedTask}
                onAnalysisComplete={handleAnalysisComplete}
              />
            ) : (
              <div className="space-y-6">
                {/* Preparation Phase */}
                {(analysisData.phase1 || analysisData.phase2) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Preparation Phase</CardTitle>
                      <CardDescription>Phases 1-2: Context Engine & Reasoning Engine</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {analysisData.phase1 && (
                        <div className="border-b pb-4">
                          <h4 className="font-medium mb-2">Phase 1: Context Engine</h4>
                          <p className="text-sm text-muted-foreground">Data gathering and context collection</p>
                          {analysisData.dataGatheringTime && (
                            <p className="text-sm mt-2">Time: {analysisData.dataGatheringTime}ms</p>
                          )}
                          {analysisData.dataSourcesCount && (
                            <p className="text-sm">Sources: {analysisData.dataSourcesCount}</p>
                          )}
                        </div>
                      )}
                      {analysisData.phase2 && (
                        <div>
                          <h4 className="font-medium mb-2">Phase 2: Reasoning Engine</h4>
                          <p className="text-sm text-muted-foreground">Analysis and reasoning</p>
                          {analysisData.reasoningTime && (
                            <p className="text-sm mt-2">Time: {analysisData.reasoningTime}ms</p>
                          )}
                          {analysisData.contextSummary && (
                            <p className="text-sm mt-2">{analysisData.contextSummary}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Analysis Results */}
                <Card>
                  <CardHeader>
                    <CardTitle>Analysis Results</CardTitle>
                    <CardDescription>Phases 3-10: Detailed Task Analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {[3, 4, 5, 6, 7, 8, 9, 10].map((phase) => (
                        <div key={phase} className="border rounded-lg p-4">
                          <h4 className="font-medium mb-2">Phase {phase}</h4>
                          <p className="text-sm text-muted-foreground">Analysis data available</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Confidence Score */}
                {analysisData.overallConfidence && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Confidence Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="text-4xl font-bold">{analysisData.overallConfidence}%</div>
                        <div className="flex-1">
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${analysisData.overallConfidence}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
