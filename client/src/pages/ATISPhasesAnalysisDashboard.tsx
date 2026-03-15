'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Brain, CheckCircle2, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import {
  Phase3DecompositionView,
  Phase4RiskAssessmentView,
  Phase5ResourceEstimationView,
  Phase6TimelineView,
  Phase7QAStrategyView,
  Phase8DocumentationView,
  Phase9DependenciesView,
  Phase10ExecutionPlanView,
} from '@/components/atis/PhaseViews';
import AnalysisSessionManager from '@/components/atis/AnalysisSessionManager';
import ConfidenceScoreIndicator from '@/components/atis/ConfidenceScoreIndicator';
import AnalysisProgressTracker from '@/components/atis/AnalysisProgressTracker';
import { PreparationPhaseView } from '@/components/atis/PreparationPhaseView';
import { TaskSelector } from '@/components/atis/TaskSelector';

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

interface PhaseStatus {
  phase: number;
  title: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
}

export default function ATISPhasesAnalysisDashboard() {
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activePhase, setActivePhase] = useState('overview');
  const [preparationStatus, setPreparationStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([
    { phase: 3, title: 'Decomposition', status: 'pending' as const },
    { phase: 4, title: 'Risk Assessment', status: 'pending' as const },
    { phase: 5, title: 'Resources', status: 'pending' as const },
    { phase: 6, title: 'Timeline', status: 'pending' as const },
    { phase: 7, title: 'QA Strategy', status: 'pending' as const },
    { phase: 8, title: 'Documentation', status: 'pending' as const },
    { phase: 9, title: 'Dependencies', status: 'pending' as const },
    { phase: 10, title: 'Execution', status: 'pending' as const },
  ]);
  const [error, setError] = useState<string | null>(null);

  // Fetch analysis data for selected task
  const handleLoadAnalysis = async (taskId: string) => {
    setIsLoading(true);
    setError(null);
    setPreparationStatus('pending');
    try {
      const response = await fetch(`/api/atis/phases/task/${taskId}`);
      if (!response.ok) throw new Error('Failed to load analysis data');
      const data = await response.json();
      setAnalysisData(data);
      setSelectedTask(taskId);
      // Set preparation status based on whether phase 1 and 2 data exists
      setPreparationStatus(data.phase1 && data.phase2 ? 'completed' : 'failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPreparationStatus('failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Start analysis for all phases
  const handleStartAnalysis = async () => {
    if (!selectedTask) return;
    setIsAnalyzing(true);
    setError(null);
    setPreparationStatus('pending');
    try {
      const response = await fetch(`/api/atis/phases/analyze/${selectedTask}`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to start analysis');
      const data = await response.json();
      setAnalysisData(data);
      setPreparationStatus(data.phase1 && data.phase2 ? 'completed' : 'failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPreparationStatus('failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">ATIS Phases Analysis</h1>
          <p className="text-muted-foreground">Advanced Task Intelligence System - Comprehensive task analysis across 8 phases</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Analysis Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Task Selection with Dropdown */}
                <TaskSelector
                  onTaskSelect={(taskId) => setSelectedTask(taskId)}
                  selectedTaskId={selectedTask}
                />

                {/* Load Button */}
                <Button
                  onClick={() => handleLoadAnalysis(selectedTask)}
                  disabled={!selectedTask || isLoading}
                  variant="outline"
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Load Analysis
                    </>
                  )}
                </Button>

                {/* Start Analysis Button */}
                <Button
                  onClick={handleStartAnalysis}
                  disabled={!selectedTask || isAnalyzing}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Start Analysis
                    </>
                  )}
                </Button>

                {/* Analysis Summary */}
                {analysisData && (
                  <div className="mt-6 pt-6 border-t space-y-4">
                    {/* Progress */}
                    <div>
                      <p className="font-medium mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Progress
                      </p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          {phaseStatuses.filter(p => p.status === 'completed').length}/{phaseStatuses.length} phases
                        </span>
                        <span className="text-xs font-medium">
                          {Math.round((phaseStatuses.filter(p => p.status === 'completed').length / phaseStatuses.length) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${(phaseStatuses.filter(p => p.status === 'completed').length / phaseStatuses.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Confidence Score */}
                    <div className="text-sm">
                      <p className="font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Confidence
                      </p>
                      <ConfidenceScoreIndicator score={analysisData.overallConfidence} />
                    </div>

                    {/* Task Info */}
                    <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                      <p>
                        <strong>Task:</strong> {analysisData.taskTitle}
                      </p>
                      <p>
                        <strong>Session:</strong> {analysisData.sessionId.slice(0, 8)}...
                      </p>
                      <p>
                        <strong>Updated:</strong> {new Date(analysisData.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Phase Status List */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Phase Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {phaseStatuses.map((phase) => (
                    <div
                      key={phase.phase}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-secondary cursor-pointer"
                      onClick={() => setActivePhase(`phase${phase.phase}`)}
                    >
                      <span className="text-sm font-medium">Phase {phase.phase}</span>
                      {phase.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {phase.status === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
                      {phase.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {/* Preparation Phase Section - Always Visible When Analysis Data Exists */}
              {analysisData && (
                <PreparationPhaseView
                  status={preparationStatus}
                  dataGatheringTime={analysisData.dataGatheringTime || 0}
                  reasoningTime={analysisData.reasoningTime || 0}
                  dataSourcesCount={analysisData.dataSourcesCount || 0}
                  contextSummary={analysisData.contextSummary}
                  error={preparationStatus === 'failed' ? 'Failed to gather context or analyze task' : undefined}
                />
              )}

              {!analysisData ? (
                <Card className="h-96 flex items-center justify-center">
                  <div className="text-center">
                    <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Select a task and start analysis to view results</p>
                  </div>
                </Card>
              ) : (
                <Tabs value={activePhase} onValueChange={setActivePhase} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="phase3">Phase 3</TabsTrigger>
                    <TabsTrigger value="phase4">Phase 4</TabsTrigger>
                    <TabsTrigger value="phase5">Phase 5</TabsTrigger>
                    <TabsTrigger value="phase6">Phase 6</TabsTrigger>
                    <TabsTrigger value="phase7">Phase 7</TabsTrigger>
                    <TabsTrigger value="phase8">Phase 8</TabsTrigger>
                    <TabsTrigger value="phase9">Phase 9</TabsTrigger>
                    <TabsTrigger value="phase10">Phase 10</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview">
                    <Card>
                      <CardHeader>
                        <CardTitle>Analysis Progress</CardTitle>
                        <CardDescription>Summary of all analysis phases (3-10)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <AnalysisProgressTracker phaseStatuses={phaseStatuses} analysisData={analysisData} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Phase 3 Tab */}
                  <TabsContent value="phase3">
                    {analysisData.phase3 ? (
                      <Phase3DecompositionView data={analysisData.phase3} />
                    ) : (
                      <Card className="p-6 text-center text-muted-foreground">Phase 3 analysis not available</Card>
                    )}
                  </TabsContent>

                  {/* Phase 4 Tab */}
                  <TabsContent value="phase4">
                    {analysisData.phase4 ? (
                      <Phase4RiskAssessmentView data={analysisData.phase4} />
                    ) : (
                      <Card className="p-6 text-center text-muted-foreground">Phase 4 analysis not available</Card>
                    )}
                  </TabsContent>

                  {/* Phase 5 Tab */}
                  <TabsContent value="phase5">
                    {analysisData.phase5 ? (
                      <Phase5ResourceEstimationView data={analysisData.phase5} />
                    ) : (
                      <Card className="p-6 text-center text-muted-foreground">Phase 5 analysis not available</Card>
                    )}
                  </TabsContent>

                  {/* Phase 6 Tab */}
                  <TabsContent value="phase6">
                    {analysisData.phase6 ? (
                      <Phase6TimelineView data={analysisData.phase6} />
                    ) : (
                      <Card className="p-6 text-center text-muted-foreground">Phase 6 analysis not available</Card>
                    )}
                  </TabsContent>

                  {/* Phase 7 Tab */}
                  <TabsContent value="phase7">
                    {analysisData.phase7 ? (
                      <Phase7QAStrategyView data={analysisData.phase7} />
                    ) : (
                      <Card className="p-6 text-center text-muted-foreground">Phase 7 analysis not available</Card>
                    )}
                  </TabsContent>

                  {/* Phase 8 Tab */}
                  <TabsContent value="phase8">
                    {analysisData.phase8 ? (
                      <Phase8DocumentationView data={analysisData.phase8} />
                    ) : (
                      <Card className="p-6 text-center text-muted-foreground">Phase 8 analysis not available</Card>
                    )}
                  </TabsContent>

                  {/* Phase 9 Tab */}
                  <TabsContent value="phase9">
                    {analysisData.phase9 ? (
                      <Phase9DependenciesView data={analysisData.phase9} />
                    ) : (
                      <Card className="p-6 text-center text-muted-foreground">Phase 9 analysis not available</Card>
                    )}
                  </TabsContent>

                  {/* Phase 10 Tab */}
                  <TabsContent value="phase10">
                    {analysisData.phase10 ? (
                      <Phase10ExecutionPlanView data={analysisData.phase10} />
                    ) : (
                      <Card className="p-6 text-center text-muted-foreground">Phase 10 analysis not available</Card>
                    )}
                  </TabsContent>

                  {/* Sessions Tab */}
                  <TabsContent value="sessions">
                    <AnalysisSessionManager taskId={selectedTask} currentSessionId={analysisData.sessionId} />
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
