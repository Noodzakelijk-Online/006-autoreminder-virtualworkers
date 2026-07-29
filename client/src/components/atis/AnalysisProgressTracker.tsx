import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle, BarChart3 } from 'lucide-react';
import ConfidenceScoreIndicator from './ConfidenceScoreIndicator';

interface PhaseStatus {
  phase: number;
  title: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  confidence?: number;
  error?: string;
}

interface AnalysisData {
  sessionId: string;
  taskId: string;
  taskTitle: string;
  createdAt: string;
  updatedAt: string;
  overallConfidence: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface AnalysisProgressTrackerProps {
  phaseStatuses: PhaseStatus[];
  analysisData: AnalysisData;
}

export default function AnalysisProgressTracker({
  phaseStatuses,
  analysisData,
}: AnalysisProgressTrackerProps) {
  const completedPhases = phaseStatuses.filter(p => p.status === 'completed').length;
  const failedPhases = phaseStatuses.filter(p => p.status === 'failed').length;
  const totalPhases = phaseStatuses.length;
  const progressPercentage = (completedPhases / totalPhases) * 100;

  const phaseGroups = [
    {
      category: 'Planning Phases',
      phases: [3, 4, 5, 6],
      description: 'Task decomposition, risk, resources, and timeline',
    },
    {
      category: 'Execution Phases',
      phases: [7, 8, 9, 10],
      description: 'QA, documentation, dependencies, and execution',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Completion</span>
            <span className="text-sm font-bold">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{completedPhases}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{totalPhases - completedPhases - failedPhases}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{failedPhases}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Score */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Confidence</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <ConfidenceScoreIndicator score={analysisData.overallConfidence} size="lg" />
        </CardContent>
      </Card>

      {/* Phase Groups */}
      {phaseGroups.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <CardTitle className="text-lg">{group.category}</CardTitle>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {phaseStatuses
                .filter(p => group.phases.includes(p.phase))
                .map((phase) => (
                  <div key={phase.phase} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-3 flex-1">
                      {phase.status === 'completed' && (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      )}
                      {phase.status === 'pending' && (
                        <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      {phase.status === 'failed' && (
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">Phase {phase.phase}: {phase.title}</p>
                        {phase.error && <p className="text-xs text-red-600">{phase.error}</p>}
                      </div>
                    </div>
                    {phase.confidence !== undefined && (
                      <div className="text-right">
                        <p className="text-sm font-bold">{Math.round(phase.confidence)}%</p>
                        <p className="text-xs text-muted-foreground">confidence</p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Analysis Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Analysis Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Session ID:</span>
            <code className="bg-secondary px-2 py-1 rounded text-xs">{analysisData.sessionId.slice(0, 12)}...</code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Task:</span>
            <span className="font-medium">{analysisData.taskTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span>{new Date(analysisData.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated:</span>
            <span>{new Date(analysisData.updatedAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className="capitalize font-medium">{analysisData.status}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
