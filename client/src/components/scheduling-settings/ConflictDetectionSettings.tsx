import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useConflictDetectionSettings } from '@/hooks/useSettings';
import { useDebounce } from '@/hooks/useDebounce';
import { AutoSaveIndicator, type AutoSaveStatus } from './AutoSaveIndicator';

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
}

export function ConflictDetectionSettings({
  open,
  onOpenChange,
}: ConflictDetectionSettingsProps) {
  const { settings, isLoading, isSaving, save } = useConflictDetectionSettings();
  const [config, setConfig] = useState<ConflictDetectionConfig>(DEFAULT_CONFIG);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const debouncedConfig = useDebounce(config, 500);

  useEffect(() => {
    if (settings) {
      const conflictTypesArray = Array.isArray(settings.conflictTypes) 
        ? settings.conflictTypes 
        : [];
      setConfig({
        enabled: Boolean(settings.enabled),
        warningThresholdMinutes: Number(settings.warningThresholdMinutes),
        autoResolve: Boolean(settings.autoResolve),
        notifyOnConflict: Boolean(settings.notifyOnConflict),
        conflictTypes: {
          timeOverlap: conflictTypesArray.includes('timeOverlap'),
          resourceConflict: conflictTypesArray.includes('resourceConflict'),
          dependencyConflict: conflictTypesArray.includes('dependencyConflict'),
        },
      });
    }
  }, [settings, open]);

  // Auto-save on debounced config changes
  useEffect(() => {
    if (!open) return; // Don't auto-save when dialog is closed

    const autoSave = async () => {
      try {
        setAutoSaveStatus('saving');
        await save({
          enabled: debouncedConfig.enabled,
          warningThresholdMinutes: debouncedConfig.warningThresholdMinutes,
          autoResolve: debouncedConfig.autoResolve,
          notifyOnConflict: debouncedConfig.notifyOnConflict,
          conflictTypes: Object.entries(debouncedConfig.conflictTypes)
            .filter(([, enabled]) => enabled)
            .map(([type]) => type),
        });
        setAutoSaveStatus('saved');
        // Reset to idle after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Failed to auto-save conflict detection settings:', error);
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      }
    };

    autoSave();
  }, [debouncedConfig, open, save]);

  const handleSave = async () => {
    try {
      await save({
        enabled: config.enabled,
        warningThresholdMinutes: config.warningThresholdMinutes,
        autoResolve: config.autoResolve,
        notifyOnConflict: config.notifyOnConflict,
        conflictTypes: Object.entries(config.conflictTypes)
          .filter(([, enabled]) => enabled)
          .map(([type]) => type),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save conflict detection settings:', error);
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
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
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

          {!isLoading && (
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
          <div className="flex items-center justify-between w-full">
            <AutoSaveIndicator status={autoSaveStatus} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
