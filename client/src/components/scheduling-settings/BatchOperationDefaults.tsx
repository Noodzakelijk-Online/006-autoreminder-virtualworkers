import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useBatchOperationDefaults } from '@/hooks/useSettings';

export interface BatchOperationDefaultsConfig {
  defaultOperationType: 're_analyze' | 'reschedule' | 'conflict_resolution' | 'optimization';
  defaultPriority: 'low' | 'normal' | 'high';
  autoStartOnQueue: boolean;
  maxConcurrentOperations: number;
  retryFailedTasks: boolean;
  maxRetries: number;
  notifyOnCompletion: boolean;
  notifyOnFailure: boolean;
}

const DEFAULT_CONFIG: BatchOperationDefaultsConfig = {
  defaultOperationType: 're_analyze',
  defaultPriority: 'normal',
  autoStartOnQueue: false,
  maxConcurrentOperations: 3,
  retryFailedTasks: true,
  maxRetries: 2,
  notifyOnCompletion: true,
  notifyOnFailure: true,
};

interface BatchOperationDefaultsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BatchOperationDefaults({
  open,
  onOpenChange,
}: BatchOperationDefaultsProps) {
  const { defaults, isLoading, isSaving, save } = useBatchOperationDefaults();
  const [config, setConfig] = useState<BatchOperationDefaultsConfig>(DEFAULT_CONFIG);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (defaults) {
      setConfig({
        defaultOperationType: (defaults.defaultOperationType as any) || 're_analyze',
        defaultPriority: (defaults.defaultPriority as any) || 'normal',
        autoStartOnQueue: Boolean(defaults.autoStartOnQueue),
        maxConcurrentOperations: Number(defaults.maxConcurrentOperations),
        retryFailedTasks: Boolean(defaults.retryFailedTasks),
        maxRetries: Number(defaults.maxRetries),
        notifyOnCompletion: Boolean(defaults.notifyOnCompletion),
        notifyOnFailure: Boolean(defaults.notifyOnFailure),
      });
    }
  }, [defaults, open]);

  const handleSave = async () => {
    try {
      await save(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save batch operation defaults:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batch Operation Defaults</DialogTitle>
          <DialogDescription>
            Set default options for batch operations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Default Operation Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Default Operation Type</CardTitle>
              <CardDescription>
                The operation type to use when creating new batch operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={config.defaultOperationType}
                onValueChange={(value: any) =>
                  setConfig({ ...config, defaultOperationType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="re_analyze">Re-analyze Tasks</SelectItem>
                  <SelectItem value="reschedule">Reschedule Tasks</SelectItem>
                  <SelectItem value="conflict_resolution">Conflict Resolution</SelectItem>
                  <SelectItem value="optimization">Optimization</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Default Priority */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Default Priority</CardTitle>
              <CardDescription>
                Priority level for new batch operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={config.defaultPriority}
                onValueChange={(value: any) =>
                  setConfig({ ...config, defaultPriority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Concurrency Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Concurrency Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Max Concurrent Operations</Label>
                <Select
                  value={config.maxConcurrentOperations.toString()}
                  onValueChange={(value) =>
                    setConfig({
                      ...config,
                      maxConcurrentOperations: parseInt(value),
                    })
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-start operations when queued</Label>
                <Switch
                  checked={config.autoStartOnQueue}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, autoStartOnQueue: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Retry Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Retry Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Retry failed tasks</Label>
                <Switch
                  checked={config.retryFailedTasks}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, retryFailedTasks: checked })
                  }
                />
              </div>
              {config.retryFailedTasks && (
                <div className="flex items-center justify-between">
                  <Label>Max retries per task</Label>
                  <Select
                    value={config.maxRetries.toString()}
                    onValueChange={(value) =>
                      setConfig({ ...config, maxRetries: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Notify on completion</Label>
                <Switch
                  checked={config.notifyOnCompletion}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, notifyOnCompletion: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Notify on failure</Label>
                <Switch
                  checked={config.notifyOnFailure}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, notifyOnFailure: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Settings saved</span>
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
