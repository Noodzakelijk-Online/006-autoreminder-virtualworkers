import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Sun, 
  Sunset, 
  Moon, 
  Save, 
  RefreshCw, 
  User,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WorkerSchedule {
  vaId: number;
  vaName: string;
  timezone: string;
  morningEnabled: boolean;
  morningTime: string; // HH:MM format
  middayEnabled: boolean;
  middayTime: string;
  eodEnabled: boolean;
  eodTime: string;
}

interface CheckinScheduleSettingsProps {
  className?: string;
}

export function CheckinScheduleSettings({ className }: CheckinScheduleSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workers, setWorkers] = useState<WorkerSchedule[]>([]);
  const [globalSettings, setGlobalSettings] = useState({
    morningEnabled: true,
    morningTime: '09:30',
    middayEnabled: true,
    middayTime: '13:00',
    eodEnabled: true,
    eodTime: '17:30',
  });
  const [useGlobalSettings, setUseGlobalSettings] = useState(true);

  useEffect(() => {
    loadScheduleSettings();
  }, []);

  const loadScheduleSettings = async () => {
    setLoading(true);
    try {
      // Load workers with their schedules
      const response = await fetch('/api/va-management/list', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const workerSchedules: WorkerSchedule[] = (data.profiles || []).map((va: any) => ({
          vaId: va.id,
          vaName: va.name || va.email || 'Unknown',
          timezone: va.timezone || 'UTC',
          morningEnabled: va.morningCheckinEnabled ?? true,
          morningTime: va.morningCheckinTime || '09:30',
          middayEnabled: va.middayCheckinEnabled ?? true,
          middayTime: va.middayCheckinTime || '13:00',
          eodEnabled: va.eodCheckinEnabled ?? true,
          eodTime: va.eodCheckinTime || '17:30',
        }));
        setWorkers(workerSchedules);
      }

      // Load global settings
      const globalResponse = await fetch('/api/trello-webhook/checkin-settings', {
        credentials: 'include',
      });
      
      if (globalResponse.ok) {
        const globalData = await globalResponse.json();
        if (globalData.settings) {
          setGlobalSettings(globalData.settings);
          setUseGlobalSettings(globalData.useGlobal ?? true);
        }
      }
    } catch (error) {
      console.error('Error loading schedule settings:', error);
      toast.error('Failed to load schedule settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Save global settings
      const response = await fetch('/api/trello-webhook/checkin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          useGlobal: useGlobalSettings,
          settings: globalSettings,
          workerSettings: useGlobalSettings ? null : workers,
        }),
      });

      if (response.ok) {
        toast.success('Check-in schedule saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateWorkerSetting = (vaId: number, field: keyof WorkerSchedule, value: any) => {
    setWorkers(prev => prev.map(w => 
      w.vaId === vaId ? { ...w, [field]: value } : w
    ));
  };

  const TimeInput = ({ 
    value, 
    onChange, 
    disabled 
  }: { 
    value: string; 
    onChange: (v: string) => void; 
    disabled?: boolean;
  }) => (
    <Input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-28"
    />
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Scheduled Check-ins
        </CardTitle>
        <CardDescription>
          Configure when the bot sends automatic progress check-ins to workers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global vs Per-Worker Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <Label className="text-base font-medium">Use Global Settings</Label>
            <p className="text-sm text-muted-foreground">
              Apply the same schedule to all workers
            </p>
          </div>
          <Switch
            checked={useGlobalSettings}
            onCheckedChange={setUseGlobalSettings}
          />
        </div>

        {/* Global Settings */}
        {useGlobalSettings && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Global Schedule
            </h4>
            
            {/* Morning Check-in */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Sun className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <Label className="font-medium">Morning Check-in</Label>
                  <p className="text-sm text-muted-foreground">
                    Start of day progress question
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <TimeInput
                  value={globalSettings.morningTime}
                  onChange={(v) => setGlobalSettings(prev => ({ ...prev, morningTime: v }))}
                  disabled={!globalSettings.morningEnabled}
                />
                <Switch
                  checked={globalSettings.morningEnabled}
                  onCheckedChange={(v) => setGlobalSettings(prev => ({ ...prev, morningEnabled: v }))}
                />
              </div>
            </div>

            {/* Midday Check-in */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Sunset className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <Label className="font-medium">Midday Check-in</Label>
                  <p className="text-sm text-muted-foreground">
                    Mid-day progress question
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <TimeInput
                  value={globalSettings.middayTime}
                  onChange={(v) => setGlobalSettings(prev => ({ ...prev, middayTime: v }))}
                  disabled={!globalSettings.middayEnabled}
                />
                <Switch
                  checked={globalSettings.middayEnabled}
                  onCheckedChange={(v) => setGlobalSettings(prev => ({ ...prev, middayEnabled: v }))}
                />
              </div>
            </div>

            {/* EOD Check-in */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Moon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <Label className="font-medium">End of Day Summary</Label>
                  <p className="text-sm text-muted-foreground">
                    Daily progress summary
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <TimeInput
                  value={globalSettings.eodTime}
                  onChange={(v) => setGlobalSettings(prev => ({ ...prev, eodTime: v }))}
                  disabled={!globalSettings.eodEnabled}
                />
                <Switch
                  checked={globalSettings.eodEnabled}
                  onCheckedChange={(v) => setGlobalSettings(prev => ({ ...prev, eodEnabled: v }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Per-Worker Settings */}
        {!useGlobalSettings && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Per-Worker Schedules
            </h4>
            
            {workers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No workers found</p>
                <p className="text-sm">Add VA profiles to configure their schedules</p>
              </div>
            ) : (
              workers.map((worker) => (
                <div key={worker.vaId} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{worker.vaName}</p>
                        <Badge variant="outline" className="text-xs">
                          {worker.timezone}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Morning */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-yellow-600" />
                        <Label className="text-sm">Morning</Label>
                        <Switch
                          checked={worker.morningEnabled}
                          onCheckedChange={(v) => updateWorkerSetting(worker.vaId, 'morningEnabled', v)}
                          className="ml-auto scale-75"
                        />
                      </div>
                      <TimeInput
                        value={worker.morningTime}
                        onChange={(v) => updateWorkerSetting(worker.vaId, 'morningTime', v)}
                        disabled={!worker.morningEnabled}
                      />
                    </div>

                    {/* Midday */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sunset className="h-4 w-4 text-orange-600" />
                        <Label className="text-sm">Midday</Label>
                        <Switch
                          checked={worker.middayEnabled}
                          onCheckedChange={(v) => updateWorkerSetting(worker.vaId, 'middayEnabled', v)}
                          className="ml-auto scale-75"
                        />
                      </div>
                      <TimeInput
                        value={worker.middayTime}
                        onChange={(v) => updateWorkerSetting(worker.vaId, 'middayTime', v)}
                        disabled={!worker.middayEnabled}
                      />
                    </div>

                    {/* EOD */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4 text-indigo-600" />
                        <Label className="text-sm">EOD</Label>
                        <Switch
                          checked={worker.eodEnabled}
                          onCheckedChange={(v) => updateWorkerSetting(worker.vaId, 'eodEnabled', v)}
                          className="ml-auto scale-75"
                        />
                      </div>
                      <TimeInput
                        value={worker.eodTime}
                        onChange={(v) => updateWorkerSetting(worker.vaId, 'eodTime', v)}
                        disabled={!worker.eodEnabled}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={loadScheduleSettings} disabled={saving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Schedule
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default CheckinScheduleSettings;
