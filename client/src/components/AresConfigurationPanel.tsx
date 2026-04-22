import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Edit2,
  Settings,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Loader2, RefreshCw } from 'lucide-react';

interface AresConfigurationPanelProps {
  cardId: string;
  cardName: string;
}

export function AresConfigurationPanel({ cardId, cardName }: AresConfigurationPanelProps) {
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigDescription, setNewConfigDescription] = useState('');
  const [newStrictnessLevel, setNewStrictnessLevel] = useState<'lenient' | 'moderate' | 'strict'>('moderate');
  const [confidenceThreshold, setConfidenceThreshold] = useState(40);

  // Queries
  const {
    data: configurations,
    isLoading: isLoadingConfigs,
    error: configsError,
    refetch: refetchConfigs,
  } = trpc.ares.getConfigurations.useQuery(undefined, { retry: false });
  
  const { data: selectedConfig, refetch: refetchSelectedConfig } = trpc.ares.getConfiguration.useQuery(
    { configId: selectedConfigId || '' },
    { enabled: !!selectedConfigId }
  );

  const { data: validationRules, refetch: refetchRules } = trpc.ares.getValidationRules.useQuery(
    { configId: selectedConfigId || '' },
    { enabled: !!selectedConfigId }
  );

  const { data: validationStats } = trpc.ares.getValidationStats.useQuery(
    { configId: selectedConfigId || '' },
    { enabled: !!selectedConfigId }
  );

  const { data: validationHistory } = trpc.ares.getValidationHistory.useQuery(
    { configId: selectedConfigId || '', limit: 10 },
    { enabled: !!selectedConfigId }
  );

  // Mutations
  const createConfigMutation = trpc.ares.createConfiguration.useMutation({
    onSuccess: () => {
      toast.success('Configuration created successfully');
      refetchConfigs();
      setIsCreateDialogOpen(false);
      setNewConfigName('');
      setNewConfigDescription('');
    },
    onError: (error) => {
      toast.error(`Failed to create configuration: ${error.message}`);
    },
  });

  const updateConfigMutation = trpc.ares.updateConfiguration.useMutation({
    onSuccess: () => {
      toast.success('Configuration updated successfully');
      refetchConfigs();
      refetchRules();
      refetchSelectedConfig();
    },
    onError: (error) => {
      toast.error(`Failed to update configuration: ${error.message}`);
    },
  });

  const deleteConfigMutation = trpc.ares.deleteConfiguration.useMutation({
    onSuccess: () => {
      toast.success('Configuration deleted successfully');
      refetchConfigs();
      setSelectedConfigId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete configuration: ${error.message}`);
    },
  });

  const createRuleMutation = trpc.ares.createValidationRule.useMutation({
    onSuccess: () => {
      toast.success('Validation rule created successfully');
      refetchRules();
      setIsRuleDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error) => {
      toast.error(`Failed to create validation rule: ${error.message}`);
    },
  });

  const updateRuleMutation = trpc.ares.updateValidationRule.useMutation({
    onSuccess: () => {
      toast.success('Validation rule updated successfully');
      refetchRules();
      setIsRuleDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error) => {
      toast.error(`Failed to update validation rule: ${error.message}`);
    },
  });

  const deleteRuleMutation = trpc.ares.deleteValidationRule.useMutation({
    onSuccess: () => {
      toast.success('Validation rule deleted successfully');
      refetchRules();
    },
    onError: (error) => {
      toast.error(`Failed to delete validation rule: ${error.message}`);
    },
  });

  const setDefaultMutation = trpc.ares.setDefaultConfiguration.useMutation({
    onSuccess: () => {
      toast.success('Default configuration updated');
      refetchConfigs();
    },
    onError: (error) => {
      toast.error(`Failed to set default configuration: ${error.message}`);
    },
  });

  // Handlers
  const handleCreateConfiguration = () => {
    if (!newConfigName.trim()) {
      toast.error('Configuration name is required');
      return;
    }

    createConfigMutation.mutate({
      name: newConfigName,
      description: newConfigDescription,
      strictnessLevel: newStrictnessLevel,
      confidenceThreshold,
    });
  };

  const handleCreateRule = () => {
    if (!selectedConfigId || !editingRule.ruleName) {
      toast.error('Rule name is required');
      return;
    }

    if (editingRule.id) {
      updateRuleMutation.mutate({
        ruleId: editingRule.id,
        configId: selectedConfigId,
        ruleName: editingRule.ruleName,
        description: editingRule.description,
        severity: editingRule.severity,
        enabled: editingRule.enabled,
        threshold: editingRule.threshold,
      });
    } else {
      createRuleMutation.mutate({
        configId: selectedConfigId,
        ruleType: editingRule.ruleType,
        ruleName: editingRule.ruleName,
        description: editingRule.description,
        severity: editingRule.severity,
        enabled: editingRule.enabled,
        threshold: editingRule.threshold,
      });
    }
  };

  const ruleTypeOptions = [
    { value: 'vagueness', label: 'Vagueness Detection' },
    { value: 'measurability', label: 'Measurability Check' },
    { value: 'timeline', label: 'Timeline Validation' },
    { value: 'resources', label: 'Resource Requirements' },
    { value: 'dependencies', label: 'Dependency Analysis' },
    { value: 'clarity', label: 'Clarity Assessment' },
    { value: 'specificity', label: 'Specificity Check' },
    { value: 'actionability', label: 'Actionability Validation' },
  ];

  const severityColors = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };

  const strictnessLevelDescription = {
    lenient: 'Minimal checks, fast processing',
    moderate: 'Balanced validation, recommended',
    strict: 'Comprehensive checks, thorough validation',
  };

  if (isLoadingConfigs) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (configsError) {
    const isTableMissing =
      configsError.message?.toLowerCase().includes("doesn't exist") ||
      configsError.message?.toLowerCase().includes('table') ||
      configsError.message?.toLowerCase().includes('database') ||
      configsError.message?.toLowerCase().includes('unknown table') ||
      configsError.message?.toLowerCase().includes('no such table');

    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <div>
          <p className="font-semibold text-destructive">
            {isTableMissing ? 'Database tables not found' : 'Failed to load ARES configurations'}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {isTableMissing
              ? 'The ARES database tables have not been created yet. Run the migration to set up the required tables.'
              : configsError.message}
          </p>
          {isTableMissing && (
            <code className="block mt-3 text-xs bg-muted px-3 py-2 rounded font-mono">
              pnpm db:push
            </code>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchConfigs()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            ARES Configuration
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage validation rules and thresholds for automated requirement evaluation
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Configuration
        </Button>
      </div>

      {/* Configuration List */}
      <Card>
        <CardHeader>
          <CardTitle>Configurations</CardTitle>
          <CardDescription>Select a configuration to manage its rules and settings</CardDescription>
        </CardHeader>
        <CardContent>
          {configurations && configurations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {configurations.map((config: any) => (
                <div
                  key={config.id}
                  onClick={() => setSelectedConfigId(config.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedConfigId === config.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{config.name}</h3>
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {config.strictnessLevel}
                        </Badge>
                        {config.isDefault && (
                          <Badge className="text-xs bg-green-100 text-green-800">Default</Badge>
                        )}
                      </div>
                    </div>
                    {!config.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDefaultMutation.mutate({ configId: config.id });
                        }}
                        className="text-xs"
                      >
                        Set Default
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No configurations yet. Create one to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Details */}
      {selectedConfig && (
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Configuration Settings</CardTitle>
                <CardDescription>{selectedConfig.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Strictness Level</Label>
                  <Select
                    value={selectedConfig.strictnessLevel}
                    onValueChange={(value) => {
                      updateConfigMutation.mutate({
                        configId: selectedConfig.id,
                        strictnessLevel: value as 'lenient' | 'moderate' | 'strict',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lenient">Lenient</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="strict">Strict</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {strictnessLevelDescription[selectedConfig.strictnessLevel as keyof typeof strictnessLevelDescription]}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Confidence Threshold: {selectedConfig.confidenceThreshold}%</Label>
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedConfig.confidenceThreshold}
                    onChange={(e) => {
                      updateConfigMutation.mutate({
                        configId: selectedConfig.id,
                        confidenceThreshold: parseInt(e.target.value),
                      });
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    Goals below this confidence level will trigger additional validation
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>Validation Checks</Label>
                  <div className="space-y-3">
                    {[
                      { key: 'enableVaguenessCheck', label: 'Vagueness Detection' },
                      { key: 'enableMeasurabilityCheck', label: 'Measurability Check' },
                      { key: 'enableTimelineCheck', label: 'Timeline Validation' },
                      { key: 'enableResourceCheck', label: 'Resource Requirements' },
                      { key: 'enableDependencyCheck', label: 'Dependency Analysis' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm">{label}</span>
                        <Switch
                          checked={selectedConfig[key as keyof typeof selectedConfig] as boolean}
                          disabled={updateConfigMutation.isPending}
                          onCheckedChange={(checked) => {
                            updateConfigMutation.mutate({
                              configId: selectedConfig.id,
                              [key]: checked,
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this configuration?')) {
                      deleteConfigMutation.mutate({ configId: selectedConfig.id });
                    }
                  }}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Configuration
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Validation Rules</CardTitle>
                  <CardDescription>Manage validation rules for this configuration</CardDescription>
                </div>
                <Button onClick={() => {
                  setEditingRule({});
                  setIsRuleDialogOpen(true);
                }} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Rule
                </Button>
              </CardHeader>
              <CardContent>
                {validationRules && validationRules.length > 0 ? (
                  <div className="space-y-3">
                    {validationRules.map((rule: any) => (
                      <div
                        key={rule.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{rule.ruleName}</h4>
                            <Badge className={`text-xs ${severityColors[rule.severity as keyof typeof severityColors]}`}>
                              {rule.severity}
                            </Badge>
                            {!rule.enabled && (
                              <Badge variant="outline" className="text-xs">Disabled</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Type: {rule.ruleType} | Threshold: {rule.threshold}%
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingRule(rule);
                              setIsRuleDialogOpen(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Delete this rule?')) {
                                deleteRuleMutation.mutate({
                                  ruleId: rule.id,
                                  configId: selectedConfig.id,
                                });
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No validation rules yet. Add one to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle>Validation Statistics</CardTitle>
                <CardDescription>Performance metrics for this configuration</CardDescription>
              </CardHeader>
              <CardContent>
                {validationStats ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold">Total Validations</span>
                      </div>
                      <p className="text-2xl font-bold">{validationStats.totalValidations}</p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-semibold">Pass Rate</span>
                      </div>
                      <p className="text-2xl font-bold">{validationStats.passRate.toFixed(1)}%</p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-semibold">Failed Validations</span>
                      </div>
                      <p className="text-2xl font-bold">{validationStats.failedValidations}</p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-semibold">Avg Confidence</span>
                      </div>
                      <p className="text-2xl font-bold">{validationStats.averageConfidence.toFixed(1)}%</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No validation data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Validation History</CardTitle>
                <CardDescription>Recent validations using this configuration</CardDescription>
              </CardHeader>
              <CardContent>
                {validationHistory && validationHistory.length > 0 ? (
                  <div className="space-y-3">
                    {validationHistory.map((record: any) => (
                      <div
                        key={record.id}
                        className="flex items-start justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{record.cardName}</h4>
                            {record.passed ? (
                              <Badge className="bg-green-100 text-green-800">Passed</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">Failed</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Confidence: {record.confidenceScore}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(record.validatedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No validation history available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Create Configuration Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New ARES Configuration</DialogTitle>
            <DialogDescription>
              Set up a new validation configuration for automated requirement evaluation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="config-name">Configuration Name</Label>
              <Input
                id="config-name"
                placeholder="e.g., Strict Validation"
                value={newConfigName}
                onChange={(e) => setNewConfigName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="config-description">Description (optional)</Label>
              <Textarea
                id="config-description"
                placeholder="Describe the purpose of this configuration"
                value={newConfigDescription}
                onChange={(e) => setNewConfigDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="strictness">Strictness Level</Label>
              <Select value={newStrictnessLevel} onValueChange={(value: any) => setNewStrictnessLevel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lenient">Lenient - Minimal checks</SelectItem>
                  <SelectItem value="moderate">Moderate - Balanced (Recommended)</SelectItem>
                  <SelectItem value="strict">Strict - Comprehensive checks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="threshold">Confidence Threshold: {confidenceThreshold}%</Label>
              <Input
                id="threshold"
                type="range"
                min="0"
                max="100"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConfiguration} disabled={createConfigMutation.isPending}>
              {createConfigMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Configuration'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Rule Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule?.id ? 'Edit' : 'Create'} Validation Rule</DialogTitle>
            <DialogDescription>
              Configure a validation rule for this ARES configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingRule?.id && (
              <div>
                <Label htmlFor="rule-type">Rule Type</Label>
                <Select
                  value={editingRule?.ruleType || ''}
                  onValueChange={(value) => setEditingRule({ ...editingRule, ruleType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ruleTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g., Detect vague pronouns"
                value={editingRule?.ruleName || ''}
                onChange={(e) => setEditingRule({ ...editingRule, ruleName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="rule-description">Description (optional)</Label>
              <Textarea
                id="rule-description"
                placeholder="Describe what this rule validates"
                value={editingRule?.description || ''}
                onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select value={editingRule?.severity || 'warning'} onValueChange={(value) => setEditingRule({ ...editingRule, severity: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="threshold">Threshold: {editingRule?.threshold || 50}%</Label>
              <Input
                id="threshold"
                type="range"
                min="0"
                max="100"
                value={editingRule?.threshold || 50}
                onChange={(e) => setEditingRule({ ...editingRule, threshold: parseInt(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enabled</Label>
              <Switch
                id="enabled"
                checked={editingRule?.enabled !== false}
                onCheckedChange={(checked) => setEditingRule({ ...editingRule, enabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsRuleDialogOpen(false);
              setEditingRule(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateRule} disabled={createRuleMutation.isPending || updateRuleMutation.isPending}>
              {(createRuleMutation.isPending || updateRuleMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingRule?.id ? 'Update Rule' : 'Create Rule'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
