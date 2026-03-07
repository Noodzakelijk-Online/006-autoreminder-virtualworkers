import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle } from 'lucide-react';

export interface ConflictDetectionConfig {
  enabled: boolean;
  warningThresholdMinutes: number;
  autoResolve: boolean;
  notifyOnConflict: boolean;
  conflictTypes: {
    timeOverlap: boolean;
    resourceConflict: boolean;
    dependencyConflict: boolean;
  };
}

const DEFAULT_CONFIG: ConflictDetectionConfig = {
  enabled: true,
  warningThresholdMinutes: 15,
  autoResolve: false,
  notifyOnConflict: true,
  conflictTypes: {
    timeOverlap: true,
    resourceConflict: true,
    dependencyConflict: true,
  },
};

interface ConflictDetectionSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: ConflictDetectionConfig) => Promise<void>;
}

export function ConflictDetectionSettings({
  open,
  onOpenChange,
  onSave,
}: ConflictDetectionSettingsProps) {
  const [config, setConfig] = useState<ConflictDetectionConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Load saved configuration from localStorage
    const saved = localStorage.getItem('conflictDetectionConfig');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse conflict detection config:', e);
      }
    }
  }, [open]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(config);
      localStorage.setItem('conflictDetectionConfig', JSON.stringify(config));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save conflict detection settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conflict Detection Settings</DialogTitle>
          <DialogDescription>
            Configure how the system detects and handles scheduling conflicts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-semibold">Enable Conflict Detection</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Automatically scan for scheduling conflicts
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, enabled: checked })
              }
            />
          </div>

          {config.enabled && (
            <>
              {/* Warning Threshold */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Warning Threshold</CardTitle>
                  <CardDescription>
                    Alert when tasks are scheduled within this time window
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="5"
                      max="120"
                      value={config.warningThresholdMinutes}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          warningThresholdMinutes: parseInt(e.target.value),
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Notifications</Label>
                <div className="flex items-center justify-between p-3 border rounded">
                  <span className="text-sm">Notify on conflict detection</span>
                  <Switch
                    checked={config.notifyOnConflict}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, notifyOnConflict: checked })
                    }
                  />
                </div>
              </div>

              {/* Auto-Resolve */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50 dark:bg-amber-950">
                <div>
                  <Label className="text-base font-semibold">Auto-Resolve Conflicts</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically suggest resolutions for detected conflicts
                  </p>
                </div>
                <Switch
                  checked={config.autoResolve}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, autoResolve: checked })
                  }
                />
              </div>

              {/* Conflict Types */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Conflict Types to Detect</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Time Overlap Conflicts</span>
                    <Switch
                      checked={config.conflictTypes.timeOverlap}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          conflictTypes: {
                            ...config.conflictTypes,
                            timeOverlap: checked,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Resource Conflicts</span>
                    <Switch
                      checked={config.conflictTypes.resourceConflict}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          conflictTypes: {
                            ...config.conflictTypes,
                            resourceConflict: checked,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Dependency Conflicts</span>
                    <Switch
                      checked={config.conflictTypes.dependencyConflict}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          conflictTypes: {
                            ...config.conflictTypes,
                            dependencyConflict: checked,
                          },
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
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
