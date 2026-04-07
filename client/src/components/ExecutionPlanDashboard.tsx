import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

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

interface StepStatus {
  status: 'blocked' | 'ready' | 'in-progress' | 'completed';
  blockedBy?: string[];
}

interface ExecutionPlanDashboardProps {
  plan: ExecutionPlan;
  completedSteps?: string[];
  inProgressStep?: string;
}

export const ExecutionPlanDashboard: React.FC<ExecutionPlanDashboardProps> = ({
  plan,
  completedSteps = [],
  inProgressStep
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Calculate step status
  const getStepStatus = (step: Step): StepStatus => {
    if (completedSteps.includes(step.id)) {
      return { status: 'completed' };
    }
    if (inProgressStep === step.id) {
      return { status: 'in-progress' };
    }
    if (step.dependencies.length > 0) {
      const blockedBy = step.dependencies.filter(dep => !completedSteps.includes(dep));
      if (blockedBy.length > 0) {
        return { status: 'blocked', blockedBy };
      }
    }
    return { status: 'ready' };
  };

  // Get status badge styling
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

  // Format time estimate
  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Sort steps by dependencies for logical order
  const sortedSteps = [...plan.steps].sort((a, b) => {
    if (a.dependencies.length === 0 && b.dependencies.length > 0) return -1;
    if (a.dependencies.length > 0 && b.dependencies.length === 0) return 1;
    return plan.steps.indexOf(a) - plan.steps.indexOf(b);
  });

  const totalHours = Math.round(plan.totalEstimate.min / 60 * 10) / 10;
  const totalHoursMax = Math.round(plan.totalEstimate.max / 60 * 10) / 10;

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
            <p className="text-xs text-gray-600 mt-2">
              ({plan.totalEstimate.min}m – {plan.totalEstimate.max}m)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Steps Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Execution Steps</h2>
        {sortedSteps.map((step, index) => {
          const stepStatus = getStepStatus(step);
          const isExpanded = expandedSteps.has(step.id);

          return (
            <Card
              key={step.id}
              className={`border-l-4 transition-all cursor-pointer hover:shadow-md ${
                stepStatus.status === 'completed'
                  ? 'border-l-green-500 bg-green-50/30'
                  : stepStatus.status === 'blocked'
                    ? 'border-l-red-500 bg-red-50/30'
                    : stepStatus.status === 'in-progress'
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
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-gray-500">#{index + 1}</span>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <Badge
                        variant="outline"
                        className={`flex items-center gap-1 ${getStatusStyles(stepStatus.status)}`}
                      >
                        {getStatusIcon(stepStatus.status)}
                        <span className="capitalize">{stepStatus.status}</span>
                      </Badge>
                    </div>
                    {stepStatus.status === 'blocked' && stepStatus.blockedBy && (
                      <div className="flex items-center gap-2 text-red-700 text-sm mt-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>Blocked — waiting for {stepStatus.blockedBy.join(', ')}</span>
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
                        <span className="font-semibold">Parallelizable:</span> This step can run in parallel with others
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

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
