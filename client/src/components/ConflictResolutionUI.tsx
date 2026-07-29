import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface SchedulingConflict {
  id: string;
  taskId: string;
  taskName: string;
  conflictType: 'overlap' | 'overbooked' | 'break_violation' | 'working_hours';
  severity: 'low' | 'medium' | 'high';
  description: string;
  conflictingTasks?: Array<{
    id: string;
    name: string;
    scheduledTime: string;
  }>;
  suggestedResolutions: Array<{
    id: string;
    title: string;
    description: string;
    action: () => Promise<void>;
    impact?: string;
  }>;
  detectedAt: Date;
}

interface ConflictResolutionUIProps {
  conflicts: SchedulingConflict[];
  onResolve?: (conflictId: string, resolutionId: string) => Promise<void>;
  onDismiss?: (conflictId: string) => void;
  isLoading?: boolean;
}

export const ConflictResolutionUI: React.FC<ConflictResolutionUIProps> = ({
  conflicts,
  onResolve,
  onDismiss,
  isLoading = false,
}) => {
  const [resolving, setResolving] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const handleResolve = async (conflict: SchedulingConflict, resolutionId: string) => {
    try {
      setResolving(`${conflict.id}-${resolutionId}`);
      const resolution = conflict.suggestedResolutions.find(r => r.id === resolutionId);
      if (resolution) {
        await resolution.action();
        if (onResolve) {
          await onResolve(conflict.id, resolutionId);
        }
        setDismissed(prev => {
          const newSet = new Set(prev);
          newSet.add(conflict.id);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(null);
    }
  };

  const handleDismiss = (conflictId: string) => {
    setDismissed(prev => {
      const newSet = new Set(prev);
      newSet.add(conflictId);
      return newSet;
    });
    if (onDismiss) {
      onDismiss(conflictId);
    }
  };

  const visibleConflicts = conflicts.filter(c => !Array.from(dismissed).includes(c.id));

  if (visibleConflicts.length === 0) {
    return null;
  }

  const severityConfig = {
    low: { icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    medium: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    high: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  };

  return (
    <div className="space-y-4">
      {Array.from(visibleConflicts).map(conflict => {
        const config = severityConfig[conflict.severity];
        const Icon = config.icon;

        return (
          <Alert key={conflict.id} className={`${config.bg} ${config.border} border`}>
            <div className="flex gap-4">
              <Icon className={`h-5 w-5 ${config.color} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <AlertTitle className="flex items-center gap-2 mb-2">
                  <span>{conflict.taskName}</span>
                  <Badge variant="outline" className="text-xs">
                    {conflict.conflictType.replace(/_/g, ' ')}
                  </Badge>
                  <Badge
                    variant={conflict.severity === 'high' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {conflict.severity}
                  </Badge>
                </AlertTitle>

                <AlertDescription className="space-y-3">
                  {/* Conflict Description */}
                  <p className="text-sm">{conflict.description}</p>

                  {/* Conflicting Tasks */}
                  {conflict.conflictingTasks && conflict.conflictingTasks.length > 0 && (
                    <div className="text-sm space-y-1">
                      <p className="font-medium">Conflicting with:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {conflict.conflictingTasks.map(task => (
                          <li key={task.id} className="text-xs">
                            <span className="font-medium">{task.name}</span> at {task.scheduledTime}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested Resolutions */}
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Suggested resolutions:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {conflict.suggestedResolutions.map(resolution => (
                        <div key={resolution.id} className="border rounded p-2 bg-background/50">
                          <p className="font-medium text-sm mb-1">{resolution.title}</p>
                          <p className="text-xs text-muted-foreground mb-2">{resolution.description}</p>
                          {resolution.impact && (
                            <p className="text-xs text-muted-foreground mb-2">
                              <Clock className="h-3 w-3 inline mr-1" />
                              Impact: {resolution.impact}
                            </p>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-7"
                            onClick={() => handleResolve(conflict, resolution.id)}
                            disabled={isLoading || resolving === `${conflict.id}-${resolution.id}`}
                          >
                            {resolving === `${conflict.id}-${resolution.id}` ? (
                              <>
                                <span className="animate-spin mr-1">⚙️</span>
                                Applying...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Apply
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dismiss Button */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => handleDismiss(conflict.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </AlertDescription>
              </div>
            </div>
          </Alert>
        );
      })}
    </div>
  );
};

export default ConflictResolutionUI;
