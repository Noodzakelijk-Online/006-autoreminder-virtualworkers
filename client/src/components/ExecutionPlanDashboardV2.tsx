import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  List,
  Loader2,
} from 'lucide-react';
import { useExecutionPlan } from '@/hooks/useExecutionPlan';

interface TimeEstimate {
  min: number;
  max: number;
}

interface Step {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  parallelizable: boolean;
  timeEstimate: TimeEstimate;
  risks: string[];
}

interface IterationFlow {
  loopName: string;
  steps: string[];
}

interface ExecutionPlan {
  overview: {
    objective: string;
    inputs: string[];
    outputs: string[];
  };
  steps: Step[];
  iterationFlows: IterationFlow[];
  totalEstimate: TimeEstimate;
}

interface ExecutionPlanDashboardV2Props {
  cardId?: string;
  plan?: ExecutionPlan;
}

type ViewMode = 'list' | 'timeline';

export const ExecutionPlanDashboardV2: React.FC<ExecutionPlanDashboardV2Props> = ({
  cardId,
  plan: externalPlan,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const {
    plan: fetchedPlan,
    loading,
    error,
    updateStepStatus,
    getCalculatedStepStatus,
    getBlockedDependencies,
  } = useExecutionPlan(cardId);

  const plan = externalPlan || fetchedPlan;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500">No execution plan found</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate critical path
  const calculateCriticalPath = (): string[] => {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);
      path.push(stepId);

      const step = plan.steps.find(s => s.id === stepId);
      if (step) {
        step.dependencies.forEach(dep => dfs(dep));
      }
    };

    // Start from steps with no dependents
    plan.steps.forEach(step => {
      const hasDependents = plan.steps.some(s => s.dependencies.includes(step.id));
      if (!hasDependents) {
        dfs(step.id);
      }
    });

    return path;
  };

  const criticalPath = useMemo(() => calculateCriticalPath(), [plan]);

  // Get status styles
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'ready':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'blocked':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'in-progress':
        return <Clock className="w-4 h-4" />;
      case 'ready':
        return <ArrowRight className="w-4 h-4" />;
      case 'blocked':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Format time
  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Sort steps by dependencies
  const sortedSteps = [...plan.steps].sort((a, b) => {
    if (a.dependencies.length === 0 && b.dependencies.length > 0) return -1;
    if (a.dependencies.length > 0 && b.dependencies.length === 0) return 1;
    return plan.steps.indexOf(a) - plan.steps.indexOf(b);
  });

  const totalHours = Math.round(plan.totalEstimate.min / 60 * 10) / 10;
  const totalHoursMax = Math.round(plan.totalEstimate.max / 60 * 10) / 10;

  // Render step card
  const renderStepCard = (step: Step, index: number) => {
    const status = getCalculatedStepStatus(step);
    const blockedDeps = getBlockedDependencies(step);
    const isExpanded = expandedSteps.has(step.id);
    const isOnCriticalPath = criticalPath.includes(step.id);

    return (
      <Card
        key={step.id}
        className={`border-l-4 transition-all cursor-pointer hover:shadow-md ${
          isOnCriticalPath ? 'border-purple-500 bg-purple-50/30' : ''
        } ${
          status === 'completed'
            ? 'border-l-green-500 bg-green-50/30'
            : status === 'blocked'
              ? 'border-l-red-500 bg-red-50/30'
              : status === 'in-progress'
                ? 'border-l-yellow-500 bg-yellow-50/30'
                : 'border-l-blue-500 bg-blue-50/30'
        }`}
        onClick={() => {
          setExpandedSteps(prev => {
            const newSet = new Set(prev);
            if (newSet.has(step.id)) {
              newSet.delete(step.id);
            } else {
              newSet.add(step.id);
            }
            return newSet;
          });
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-sm font-mono text-gray-500">#{index + 1}</span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <Badge
                  variant="outline"
                  className={`flex items-center gap-1 ${getStatusStyles(status)}`}
                >
                  {getStatusIcon(status)}
                  <span className="capitalize">{status}</span>
                </Badge>
                {isOnCriticalPath && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                    Critical Path
                  </Badge>
                )}
              </div>
              {status === 'blocked' && blockedDeps.length > 0 && (
                <div className="flex items-center gap-2 text-red-700 text-sm mt-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Blocked — waiting for {blockedDeps.join(', ')}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-700">
                {formatTime(step.timeEstimate.min)} – {formatTime(step.timeEstimate.max)}
              </div>
              <p className="text-xs text-gray-500">Est. time</p>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4 border-t pt-4">
            <div>
              <h4 className="font-semibold text-sm text-gray-600 mb-2">Description</h4>
              <p className="text-gray-700 text-sm leading-relaxed">{step.description}</p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600 mb-2">Status</h4>
              <div className="flex gap-2">
                {(['ready', 'in-progress', 'completed'] as const).map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={status === s ? 'default' : 'outline'}
                    onClick={e => {
                      e.stopPropagation();
                      if (cardId) {
                        updateStepStatus(step.id, s);
                      }
                    }}
                    disabled={!cardId || (s === 'in-progress' && status === 'blocked')}
                  >
                    {s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600 mb-2">Dependencies</h4>
              {step.dependencies.length > 0 ? (
                <p className="text-sm text-gray-700">
                  Depends on: <span className="font-mono text-primary">{step.dependencies.join(', ')}</span>
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic">No dependencies</p>
              )}
            </div>

            {step.risks.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Risks
                </h4>
                <ul className="space-y-1">
                  {step.risks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-amber-600 mt-1">⚠</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step.parallelizable && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Parallelizable:</span> Can run in parallel
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  // Render Gantt timeline
  const renderGanttTimeline = () => {
    const maxWidth = 1000;
    const totalMinutes = plan.totalEstimate.max;
    const pixelsPerMinute = maxWidth / totalMinutes;

    return (
      <div className="space-y-4 overflow-x-auto">
        <div className="min-w-full bg-white rounded-lg border p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-40 font-semibold text-sm">Step</div>
            <div className="flex-1 text-xs text-gray-500">Timeline (minutes)</div>
          </div>

          {sortedSteps.map(step => {
            const width = (step.timeEstimate.max - step.timeEstimate.min) * pixelsPerMinute;
            const isCritical = criticalPath.includes(step.id);

            return (
              <div key={step.id} className="flex items-center gap-4 mb-3">
                <div className="w-40 truncate text-sm font-medium">{step.id}</div>
                <div className="flex-1 relative h-8 bg-gray-100 rounded">
                  <div
                    className={`absolute h-full rounded flex items-center justify-center text-xs font-semibold text-white transition-all ${
                      isCritical ? 'bg-purple-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.max(width, 50)}px` }}
                  >
                    {formatTime(step.timeEstimate.max)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Overview Section */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl">Execution Plan Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Objective</h3>
            <p className="text-gray-700">{plan.overview.objective}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-sm text-gray-600 mb-3 uppercase tracking-wide">Inputs</h4>
              <ul className="space-y-2">
                {plan.overview.inputs.map((input, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-sm text-gray-700">{input}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600 mb-3 uppercase tracking-wide">Outputs</h4>
              <ul className="space-y-2">
                {plan.overview.outputs.map((output, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-sm text-gray-700">{output}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Total Estimated Time</span>
              <span className="text-2xl font-bold text-primary">
                {totalHours}h – {totalHoursMax}h
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'list' ? 'default' : 'outline'}
          onClick={() => setViewMode('list')}
          className="flex items-center gap-2"
        >
          <List className="w-4 h-4" />
          List View
        </Button>
        <Button
          variant={viewMode === 'timeline' ? 'default' : 'outline'}
          onClick={() => setViewMode('timeline')}
          className="flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          Timeline View
        </Button>
      </div>

      {/* Steps Section */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Execution Steps</h2>
          {sortedSteps.map((step, index) => renderStepCard(step, index))}
        </div>
      )}

      {/* Timeline Section */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Execution Timeline</h2>
          {renderGanttTimeline()}
        </div>
      )}

      {/* Iteration Loops Section */}
      {plan.iterationFlows.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Iteration Loops</h2>
          {plan.iterationFlows.map((loop, idx) => (
            <Card key={idx} className="border-2 border-amber-200 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="text-lg text-amber-900">{loop.loopName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {loop.steps.map((stepId, stepIdx) => (
                    <React.Fragment key={stepId}>
                      <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300">
                        {stepId}
                      </Badge>
                      {stepIdx < loop.steps.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-amber-600" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-sm text-amber-900 italic">
                  This sequence may repeat until validation is successful
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
