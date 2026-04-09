import React, { useState, useMemo } from 'react';
import { useExecutionPlanV2 } from '@/hooks/useExecutionPlanV2';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, AlertTriangle, Grid3x3, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutionPlanDashboardV3Props {
  planId: string | null;
  onClose?: () => void;
}

type ViewMode = 'list' | 'timeline';
type StatusFilter = 'all' | 'blocked' | 'ready' | 'in-progress' | 'completed';

export function ExecutionPlanDashboardV3({ planId, onClose }: ExecutionPlanDashboardV3Props) {
  const { plan, loading, error, updateStepStatus, getCriticalPath, getParallelWork, getProgress, isUpdating } = useExecutionPlanV2(planId);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Filter steps
  const filteredSteps = useMemo(() => {
    if (!plan) return [];
    return plan.steps.filter(step => {
      if (statusFilter === 'all') return true;
      return step.status === statusFilter;
    });
  }, [plan, statusFilter]);

  // Get critical path
  const criticalPath = useMemo(() => getCriticalPath(), [getCriticalPath]);
  const parallelWork = useMemo(() => getParallelWork(), [getParallelWork]);
  const progress = useMemo(() => getProgress(), [getProgress]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading execution plan...</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground">{error || 'No execution plan found'}</p>
          {onClose && <Button onClick={onClose} variant="outline">Close</Button>}
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'in-progress':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'ready':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'blocked':
        return 'bg-red-50 border-red-200 text-red-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-yellow-600">In Progress</Badge>;
      case 'ready':
        return <Badge className="bg-blue-600">Ready</Badge>;
      case 'blocked':
        return <Badge className="bg-red-600">Blocked</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const isCriticalPath = (stepId: string) => criticalPath.includes(stepId);
  const isParallelizable = (stepId: string) => parallelWork.some(group => group.includes(stepId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <h2 className="text-2xl font-bold">{plan.overview.objective}</h2>
            <p className="text-muted-foreground text-sm">
              {filteredSteps.length} of {plan.steps.length} steps • {progress}% complete
            </p>
          </div>
          {onClose && <Button onClick={onClose} variant="ghost">Close</Button>}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Overview */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Estimated Time</p>
            <p className="text-lg font-semibold">
              {plan.totalEstimateMin}–{plan.totalEstimateMax} min
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Steps</p>
            <p className="text-lg font-semibold">{plan.steps.length}</p>
          </Card>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-2"
          >
            <Grid3x3 className="h-4 w-4" />
            List
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('timeline')}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Timeline
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'blocked', 'ready', 'in-progress', 'completed'] as StatusFilter[]).map(filter => (
            <Button
              key={filter}
              variant={statusFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {filteredSteps.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No steps match the selected filter</p>
            </Card>
          ) : (
            filteredSteps.map(step => (
              <StepCard
                key={step.id}
                step={step}
                plan={plan}
                isExpanded={expandedSteps.has(step.id)}
                onToggleExpand={() => {
                  const newExpanded = new Set(expandedSteps);
                  if (newExpanded.has(step.id)) {
                    newExpanded.delete(step.id);
                  } else {
                    newExpanded.add(step.id);
                  }
                  setExpandedSteps(newExpanded);
                }}
                onStatusChange={(newStatus) => updateStepStatus(step.id, newStatus)}
                isCriticalPath={isCriticalPath(step.stepId)}
                isParallelizable={isParallelizable(step.stepId)}
                getStatusColor={getStatusColor}
                getStatusBadge={getStatusBadge}
                isUpdating={isUpdating}
              />
            ))
          )}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <TimelineView
          plan={plan}
          criticalPath={criticalPath}
          parallelWork={parallelWork}
          getStatusColor={getStatusColor}
          getStatusBadge={getStatusBadge}
        />
      )}

      {/* Iteration Flows */}
      {plan.iterationFlows && plan.iterationFlows.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Iteration Loops</h3>
          {plan.iterationFlows.map((flow, idx) => (
            <Card key={idx} className="p-4">
              <p className="font-semibold mb-2">{flow.loopName}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {flow.steps.map((stepId, stepIdx) => (
                  <React.Fragment key={stepId}>
                    <Badge variant="outline">{stepId}</Badge>
                    {stepIdx < flow.steps.length - 1 && <span className="text-muted-foreground">→</span>}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This sequence may repeat until validation is successful
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface StepCardProps {
  step: any;
  plan: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (status: 'completed' | 'in-progress' | 'ready' | 'blocked') => void;
  isCriticalPath: boolean;
  isParallelizable: boolean;
  getStatusColor: (status: string) => string;
  getStatusBadge: (status: string) => React.ReactNode;
  isUpdating: boolean;
}

function StepCard({
  step,
  plan,
  isExpanded,
  onToggleExpand,
  onStatusChange,
  isCriticalPath,
  isParallelizable,
  getStatusColor,
  getStatusBadge,
  isUpdating
}: StepCardProps) {
  const dependencies = step.dependencies
    .map((depId: string) => plan.steps.find((s: any) => s.stepId === depId))
    .filter(Boolean);

  return (
    <Card className={cn('p-4 border-l-4 cursor-pointer transition-all', getStatusColor(step.status))}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{step.stepId}: {step.title}</h4>
              {isCriticalPath && <Badge className="bg-purple-600">Critical Path</Badge>}
              {isParallelizable && <Badge className="bg-cyan-600">Parallelizable</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(step.status)}
              <span className="text-xs text-muted-foreground">
                {step.timeEstimateMin}–{step.timeEstimateMax} min
              </span>
            </div>
          </div>
          <button
            onClick={onToggleExpand}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="space-y-3 pt-3 border-t">
            {/* Description */}
            <div>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>

            {/* Dependencies */}
            {dependencies.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Dependencies:</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {dependencies.map((dep: any) => (
                    <Badge key={dep.id} variant="outline">{dep.stepId}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {step.risks && step.risks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Risks:
                </p>
                <ul className="text-xs space-y-1 ml-4">
                  {step.risks.map((risk: string, idx: number) => (
                    <li key={idx} className="list-disc text-muted-foreground">{risk}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Status Controls */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant={step.status === 'completed' ? 'default' : 'outline'}
                onClick={() => onStatusChange('completed')}
                disabled={isUpdating}
                className="gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </Button>
              <Button
                size="sm"
                variant={step.status === 'in-progress' ? 'default' : 'outline'}
                onClick={() => onStatusChange('in-progress')}
                disabled={isUpdating}
                className="gap-1"
              >
                <Clock className="h-3 w-3" />
                In Progress
              </Button>
              <Button
                size="sm"
                variant={step.status === 'ready' ? 'default' : 'outline'}
                onClick={() => onStatusChange('ready')}
                disabled={isUpdating}
              >
                Ready
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

interface TimelineViewProps {
  plan: any;
  criticalPath: string[];
  parallelWork: string[][];
  getStatusColor: (status: string) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

function TimelineView({
  plan,
  criticalPath,
  parallelWork,
  getStatusColor,
  getStatusBadge
}: TimelineViewProps) {
  const maxTime = plan.totalEstimateMax;
  const timelineWidth = 800;
  const pixelsPerMinute = timelineWidth / maxTime;

  return (
    <div className="space-y-6 overflow-x-auto">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Execution Timeline</h3>
        <p className="text-sm text-muted-foreground">
          Estimated total time: {plan.totalEstimateMin}–{plan.totalEstimateMax} minutes
        </p>
      </div>

      {/* Timeline Ruler */}
      <div className="space-y-1">
        <div style={{ width: timelineWidth }} className="flex justify-between text-xs text-muted-foreground">
          <span>0 min</span>
          <span>{Math.round(maxTime / 2)} min</span>
          <span>{maxTime} min</span>
        </div>
        <div style={{ width: timelineWidth }} className="h-1 bg-gray-200 rounded" />
      </div>

      {/* Timeline Items */}
      <div className="space-y-3">
        {plan.steps.map((step: any) => {
          const isCritical = criticalPath.includes(step.stepId);
          const width = (step.timeEstimateMax * pixelsPerMinute);
          
          return (
            <div key={step.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold w-24 truncate">{step.stepId}</span>
                <div
                  style={{ width }}
                  className={cn(
                    'h-8 rounded border-2 flex items-center px-2 text-xs font-semibold transition-all',
                    isCritical ? 'border-purple-600 bg-purple-100' : 'border-gray-300 bg-gray-100'
                  )}
                >
                  {width > 60 && step.title.substring(0, 15)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-100 border-2 border-purple-600" />
          <span>Critical Path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-100 border-2 border-gray-300" />
          <span>Non-Critical</span>
        </div>
      </div>
    </div>
  );
}
