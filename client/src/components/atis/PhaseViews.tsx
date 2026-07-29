import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Clock, DollarSign, Calendar, FileText, Link2, Zap } from 'lucide-react';

// Phase 3: Task Decomposition
export function Phase3DecompositionView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Task Decomposition
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Subtasks</p>
              <p className="text-2xl font-bold">{data.subtasks?.length || 0}</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Total Duration</p>
              <p className="text-2xl font-bold">{data.totalDurationHours || 0}h</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Critical Path</p>
              <p className="text-2xl font-bold">{data.criticalPath?.length || 0}</p>
            </div>
          </div>

          {/* Subtasks Table */}
          {data.subtasks && data.subtasks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Seq</th>
                    <th className="text-left py-2 px-2">Title</th>
                    <th className="text-left py-2 px-2">Duration</th>
                    <th className="text-left py-2 px-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subtasks.map((task: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-secondary/50">
                      <td className="py-2 px-2">{task.sequence}</td>
                      <td className="py-2 px-2 font-medium">{task.title}</td>
                      <td className="py-2 px-2">{task.estimatedHours}h</td>
                      <td className="py-2 px-2 text-muted-foreground">{task.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Analysis */}
          {data.analysis && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">{data.analysis}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Phase 4: Risk Assessment
export function Phase4RiskAssessmentView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Total Risks</p>
              <p className="text-2xl font-bold">{data.risks?.length || 0}</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">High Risk</p>
              <p className="text-2xl font-bold text-red-600">
                {data.risks?.filter((r: any) => r.probability * r.impact > 30).length || 0}
              </p>
            </div>
          </div>

          {/* Risks */}
          {data.risks && data.risks.length > 0 && (
            <div className="space-y-3">
              {data.risks.map((risk: any, idx: number) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{risk.title}</h4>
                    <span className="text-xs bg-secondary px-2 py-1 rounded capitalize">{risk.category}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{risk.description}</p>
                  <div className="flex gap-4 text-xs mb-2">
                    <span>Probability: {risk.probability}/10</span>
                    <span>Impact: {risk.impact}/10</span>
                    <span className="font-bold">Score: {Math.round((risk.probability * risk.impact) / 10)}</span>
                  </div>
                  {risk.mitigations && risk.mitigations.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Mitigations:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {risk.mitigations.map((m: any, i: number) => (
                          <li key={i}>{m.strategy} ({m.effort})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {data.summary && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-900">{data.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Phase 5: Resource Estimation
export function Phase5ResourceEstimationView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Resource Estimation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Skills */}
          {data.skills && data.skills.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Required Skills</h4>
              <div className="space-y-2">
                {data.skills.map((skill: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <span className="text-sm">{skill.name}</span>
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded capitalize">
                      {skill.proficiencyLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tools */}
          {data.tools && data.tools.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Required Tools</h4>
              <div className="space-y-2">
                {data.tools.map((tool: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <span className="text-sm">{tool.name}</span>
                    <span className="text-xs font-medium">${tool.estimatedCost}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Training */}
          {data.training && data.training.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Training Needed</h4>
              <div className="space-y-2">
                {data.training.map((train: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <span className="text-sm">{train.topic}</span>
                    <span className="text-xs font-medium">${train.estimatedCost}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {data.summary && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-900">{data.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Phase 6: Timeline Optimization
export function Phase6TimelineView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline Optimization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timeline Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Start Date</p>
              <p className="text-sm font-bold">{new Date(data.startDate).toLocaleDateString()}</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">End Date</p>
              <p className="text-sm font-bold">{new Date(data.endDate).toLocaleDateString()}</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Total Days</p>
              <p className="text-sm font-bold">{data.totalDays}</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Buffer Days</p>
              <p className="text-sm font-bold">{data.bufferDays}</p>
            </div>
          </div>

          {/* Milestones */}
          {data.milestones && data.milestones.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Milestones</h4>
              <div className="space-y-2">
                {data.milestones.map((milestone: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-2 bg-secondary rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{milestone.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(milestone.dueDate).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{milestone.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optimization Note */}
          {data.optimization && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">{data.optimization}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Phase 7: QA Strategy
export function Phase7QAStrategyView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            QA Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Strategy */}
          {data.strategy && (
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-sm">{data.strategy}</p>
            </div>
          )}

          {/* Testing Phases */}
          {data.testingPhases && data.testingPhases.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Testing Phases</h4>
              <div className="space-y-2">
                {data.testingPhases.map((phase: any, idx: number) => (
                  <div key={idx} className="p-2 border rounded">
                    <p className="font-medium text-sm">{phase.name}</p>
                    <p className="text-xs text-muted-foreground">{phase.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">Duration: {phase.duration}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quality Metrics */}
          {data.qualityMetrics && data.qualityMetrics.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Quality Metrics</h4>
              <div className="space-y-2">
                {data.qualityMetrics.map((metric: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <span className="text-sm">{metric.metric}</span>
                    <span className="text-xs font-bold">{metric.target}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acceptance Criteria */}
          {data.acceptanceCriteria && data.acceptanceCriteria.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Acceptance Criteria</h4>
              <ul className="space-y-1">
                {data.acceptanceCriteria.map((criterion: any, idx: number) => (
                  <li key={idx} className="text-sm flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>{criterion.criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Phase 8: Documentation
export function Phase8DocumentationView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentation Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.documentationTypes && data.documentationTypes.length > 0 && (
            <div className="space-y-3">
              {data.documentationTypes.map((doc: any, idx: number) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium capitalize">{doc.type.replace(/_/g, ' ')}</h4>
                    <span className="text-xs bg-secondary px-2 py-1 rounded">{doc.estimatedEffort}h</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Audience: {doc.audience.replace(/_/g, ' ')}</p>
                  {doc.outline && (
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Outline:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {doc.outline.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.summary && (
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-900">{data.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Phase 9: Dependencies
export function Phase9DependenciesView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            External Dependencies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.dependencies && data.dependencies.length > 0 && (
            <div className="space-y-3">
              {data.dependencies.map((dep: any, idx: number) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium capitalize">{dep.type.replace(/_/g, ' ')}</h4>
                    <span className="text-xs bg-secondary px-2 py-1 rounded">
                      {new Date(dep.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{dep.description}</p>
                  <p className="text-xs text-muted-foreground mb-1"><strong>Owner:</strong> {dep.owner}</p>
                  <p className="text-xs text-red-600"><strong>Impact:</strong> {dep.impact}</p>
                </div>
              ))}
            </div>
          )}

          {data.summary && (
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-900">{data.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Phase 10: Execution Plan
export function Phase10ExecutionPlanView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Execution Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Confidence Score */}
          <div className="p-3 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Confidence Score</p>
            <p className="text-2xl font-bold">{data.confidenceScore}%</p>
          </div>

          {/* Roadmap */}
          {data.roadmap && data.roadmap.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Roadmap</h4>
              <div className="space-y-2">
                {data.roadmap.map((step: any, idx: number) => (
                  <div key={idx} className="flex gap-3 p-2 bg-secondary rounded">
                    <span className="text-sm font-bold text-primary">{step.step}.</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Duration: {step.duration} | Owner: {step.owner}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Metrics */}
          {data.successMetrics && data.successMetrics.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Success Metrics</h4>
              <div className="space-y-2">
                {data.successMetrics.map((metric: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <span className="text-sm">{metric.metric}</span>
                    <span className="text-xs font-bold">{metric.target}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {data.summary && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-900">{data.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
