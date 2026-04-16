import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, Coffee, Utensils, Target } from 'lucide-react';

interface WorkingHoursSettingsShape {
  workStartHour: number;
  workStartMinute: number;
  workEndHour: number;
  workEndMinute: number;
  breakfastTime: string;
  breakfastDuration: number;
  lunchTime: string;
  lunchDuration: number;
  dinnerTime: string;
  dinnerDuration: number;
  enableBreaks: boolean;
  shortBreakInterval: number;
  shortBreakDuration: number;
  longBreakInterval: number;
  longBreakDuration: number;
  workingDays: string;
  timezone: string;
  country: string;
  weeklyHoursMin: number;
  weeklyHoursMax: number;
  dailyHoursMin: number;
  dailyHoursMax: number;
}

const DEFAULT_SETTINGS: WorkingHoursSettingsShape = {
  workStartHour: 9,
  workStartMinute: 0,
  workEndHour: 18,
  workEndMinute: 0,
  breakfastTime: '09:00',
  breakfastDuration: 45,
  lunchTime: '15:00',
  lunchDuration: 45,
  dinnerTime: '20:00',
  dinnerDuration: 120,
  enableBreaks: true,
  shortBreakInterval: 120,
  shortBreakDuration: 10,
  longBreakInterval: 240,
  longBreakDuration: 30,
  workingDays: '1,2,3,4,5',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  country: 'US',
  weeklyHoursMin: 40,
  weeklyHoursMax: 45,
  dailyHoursMin: 8,
  dailyHoursMax: 9,
};

interface WorkingHoursSettingsProps {
  workerId: number | null;
  workerName: string | null;
  workerTimezone: string | null;
}

export function WorkingHoursSettings({ workerId, workerName, workerTimezone }: WorkingHoursSettingsProps) {
  const [settings, setSettings] = useState<WorkingHoursSettingsShape>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Re-fetch whenever the selected worker changes
  useEffect(() => {
    fetchSettings();
  }, [workerId]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const url = workerId
        ? `/api/working-hours/settings?workerId=${workerId}`
        : '/api/working-hours/settings';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            enableBreaks: Boolean(data.enableBreaks),
            dailyHoursMin: parseFloat(data.dailyHoursMin) || DEFAULT_SETTINGS.dailyHoursMin,
            dailyHoursMax: parseFloat(data.dailyHoursMax) || DEFAULT_SETTINGS.dailyHoursMax,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching working hours:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = workerId
        ? `/api/working-hours/settings?workerId=${workerId}`
        : '/api/working-hours/settings';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      const label = workerName ? `${workerName}'s settings` : 'Default settings';
      toast.success(`${label} saved successfully.`);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (hour: number, minute: number) =>
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading settings...</div>;
  }

  // When a worker is selected, their timezone comes from their profile (read-only)
  const displayTimezone = workerId ? (workerTimezone ?? settings.timezone) : settings.timezone;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Scope banner */}
      {workerName && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span>
            Editing schedule for <span className="font-semibold">{workerName}</span>
            {workerTimezone && (
              <Badge variant="secondary" className="ml-2 text-xs">{workerTimezone}</Badge>
            )}
          </span>
        </div>
      )}

      {/* Working Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Clock className="h-5 w-5" />
            Working Hours
          </CardTitle>
          <CardDescription>
            Configure the daily work schedule. Tasks will be automatically scheduled within these hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Work Start Time</Label>
              <div className="flex gap-2">
                <Input
                  type="number" min="0" max="23"
                  value={settings.workStartHour}
                  onChange={(e) => setSettings({ ...settings, workStartHour: parseInt(e.target.value) || 0 })}
                  className="w-20" placeholder="HH"
                />
                <span className="flex items-center">:</span>
                <Input
                  type="number" min="0" max="59"
                  value={settings.workStartMinute}
                  onChange={(e) => setSettings({ ...settings, workStartMinute: parseInt(e.target.value) || 0 })}
                  className="w-20" placeholder="MM"
                  disabled={!!workerId}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatTime(settings.workStartHour, settings.workStartMinute)}
                {workerId && <span className="ml-2 text-yellow-600">(minutes not stored per worker)</span>}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Work End Time</Label>
              <div className="flex gap-2">
                <Input
                  type="number" min="0" max="23"
                  value={settings.workEndHour}
                  onChange={(e) => setSettings({ ...settings, workEndHour: parseInt(e.target.value) || 0 })}
                  className="w-20" placeholder="HH"
                />
                <span className="flex items-center">:</span>
                <Input
                  type="number" min="0" max="59"
                  value={settings.workEndMinute}
                  onChange={(e) => setSettings({ ...settings, workEndMinute: parseInt(e.target.value) || 0 })}
                  className="w-20" placeholder="MM"
                  disabled={!!workerId}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatTime(settings.workEndHour, settings.workEndMinute)}
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
            Total working hours per day:{' '}
            <span className="font-medium">
              {(
                (settings.workEndHour * 60 + settings.workEndMinute -
                  (settings.workStartHour * 60 + settings.workStartMinute)) / 60
              ).toFixed(1)}{' '}
              hours
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Meal Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Meal Times
          </CardTitle>
          <CardDescription>
            Configure meal breaks. Tasks will be scheduled around these times.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'breakfastTime', durKey: 'breakfastDuration', label: 'Breakfast Time' },
              { key: 'lunchTime', durKey: 'lunchDuration', label: 'Lunch Time' },
              { key: 'dinnerTime', durKey: 'dinnerDuration', label: 'Dinner Time' },
            ].map(({ key, durKey, label }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type="time"
                  value={(settings as any)[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="0" max="180"
                    value={(settings as any)[durKey]}
                    onChange={(e) =>
                      setSettings({ ...settings, [durKey]: parseInt(e.target.value) || 0 })
                    }
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">mins</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Hours Target — only shown for global defaults */}
      {!workerId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Target className="h-5 w-5" />
              Weekly Hours Target
            </CardTitle>
            <CardDescription>
              Set your target weekly hours and daily flexibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weekly Hours Target (Range)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="20" max="80"
                    value={settings.weeklyHoursMin}
                    onChange={(e) => setSettings({ ...settings, weeklyHoursMin: parseInt(e.target.value) || 40 })}
                    className="w-20" placeholder="Min"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="number" min="20" max="80"
                    value={settings.weeklyHoursMax}
                    onChange={(e) => setSettings({ ...settings, weeklyHoursMax: parseInt(e.target.value) || 45 })}
                    className="w-20" placeholder="Max"
                  />
                  <span className="text-sm text-muted-foreground">hours/week</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Daily Hours Flexibility (Range)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="4" max="16" step="0.5"
                    value={settings.dailyHoursMin}
                    onChange={(e) => setSettings({ ...settings, dailyHoursMin: parseFloat(e.target.value) || 8 })}
                    className="w-20" placeholder="Min"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="number" min="4" max="16" step="0.5"
                    value={settings.dailyHoursMax}
                    onChange={(e) => setSettings({ ...settings, dailyHoursMax: parseFloat(e.target.value) || 9 })}
                    className="w-20" placeholder="Max"
                  />
                  <span className="text-sm text-muted-foreground">hours/day</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Break Settings — only shown for global defaults */}
      {!workerId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5" />
              Break Settings
            </CardTitle>
            <CardDescription>
              Configure automatic breaks during work hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Automatic Breaks</Label>
                <p className="text-sm text-muted-foreground">
                  Schedule short and long breaks between tasks
                </p>
              </div>
              <Switch
                checked={settings.enableBreaks}
                onCheckedChange={(checked) => setSettings({ ...settings, enableBreaks: checked })}
              />
            </div>

            {settings.enableBreaks && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                {[
                  { intervalKey: 'shortBreakInterval', durKey: 'shortBreakDuration', label: 'Short Break' },
                  { intervalKey: 'longBreakInterval', durKey: 'longBreakDuration', label: 'Long Break' },
                ].map(({ intervalKey, durKey, label }) => (
                  <div key={intervalKey} className="space-y-2">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Every</span>
                      <Input
                        type="number" min="30" max="480"
                        value={(settings as any)[intervalKey]}
                        onChange={(e) =>
                          setSettings({ ...settings, [intervalKey]: parseInt(e.target.value) || 120 })
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">mins</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Duration:</span>
                      <Input
                        type="number" min="5" max="60"
                        value={(settings as any)[durKey]}
                        onChange={(e) =>
                          setSettings({ ...settings, [durKey]: parseInt(e.target.value) || 10 })
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">mins</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Working Days & Timezone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Working Days & Timezone
          </CardTitle>
          <CardDescription>
            Select which days are worked and the timezone for accurate scheduling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Working Days</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '0', label: 'Sun' },
                { value: '1', label: 'Mon' },
                { value: '2', label: 'Tue' },
                { value: '3', label: 'Wed' },
                { value: '4', label: 'Thu' },
                { value: '5', label: 'Fri' },
                { value: '6', label: 'Sat' },
              ].map((day) => {
                const isSelected = settings.workingDays.split(',').includes(day.value);
                return (
                  <Button
                    key={day.value}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const days = settings.workingDays.split(',').filter((d) => d);
                      const newDays = isSelected
                        ? days.filter((d) => d !== day.value)
                        : [...days, day.value].sort();
                      setSettings({ ...settings, workingDays: newDays.join(',') });
                    }}
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Selected: {settings.workingDays.split(',').filter((d) => d).length} days per week
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">
              Timezone
              {workerId && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  (managed from employee profile)
                </span>
              )}
            </Label>
            {workerId ? (
              <div className="w-full px-3 py-2 border rounded-md bg-muted text-sm text-muted-foreground">
                {displayTimezone}
              </div>
            ) : (
              <select
                id="timezone"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <optgroup label="Common Timezones">
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Paris (CET/CEST)</option>
                  <option value="Europe/Amsterdam">Amsterdam (CET/CEST)</option>
                  <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                  <option value="Asia/Karachi">Karachi (PKT)</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                  <option value="Australia/Sydney">Sydney (AEDT/AEST)</option>
                </optgroup>
              </select>
            )}
            <p className="text-sm text-muted-foreground">
              Current time:{' '}
              {new Date().toLocaleTimeString('en-US', { timeZone: displayTimezone })}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : workerName ? `Save ${workerName}'s Settings` : 'Save Default Settings'}
        </Button>
      </div>
    </div>
  );
}
