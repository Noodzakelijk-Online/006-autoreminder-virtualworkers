import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Clock, Coffee, Utensils } from 'lucide-react';

interface WorkingHoursSettings {
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
  workingDays: string; // Comma-separated day numbers: 0=Sun, 1=Mon, ..., 6=Sat
  timezone: string; // IANA timezone
  country: string; // ISO 3166-1 alpha-2 country code
}

const defaultSettings: WorkingHoursSettings = {
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
  workingDays: '1,2,3,4,5', // Mon-Fri by default
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', // Detect user's timezone
  country: 'US', // Default to US
};

export function WorkingHoursSettings() {
  const [settings, setSettings] = useState<WorkingHoursSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/working-hours/settings');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setSettings({
            ...data,
            enableBreaks: Boolean(data.enableBreaks),
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
      const response = await fetch('/api/working-hours/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Settings saved! Refresh the dashboard to see rescheduled tasks.');
      
      // Trigger automatic rescheduling
      // Tasks will be rescheduled automatically on next fetch because
      // the scheduling algorithm uses the updated user settings
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Clock className="h-5 w-5" />
            Working Hours
          </CardTitle>
          <CardDescription>
            Configure your daily work schedule. Tasks will be automatically scheduled within these hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Work Start Time</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={settings.workStartHour}
                  onChange={(e) => setSettings({ ...settings, workStartHour: parseInt(e.target.value) || 0 })}
                  className="w-20"
                  placeholder="HH"
                />
                <span className="flex items-center">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={settings.workStartMinute}
                  onChange={(e) => setSettings({ ...settings, workStartMinute: parseInt(e.target.value) || 0 })}
                  className="w-20"
                  placeholder="MM"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {formatTime(settings.workStartHour, settings.workStartMinute)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Work End Time</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={settings.workEndHour}
                  onChange={(e) => setSettings({ ...settings, workEndHour: parseInt(e.target.value) || 0 })}
                  className="w-20"
                  placeholder="HH"
                />
                <span className="flex items-center">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={settings.workEndMinute}
                  onChange={(e) => setSettings({ ...settings, workEndMinute: parseInt(e.target.value) || 0 })}
                  className="w-20"
                  placeholder="MM"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {formatTime(settings.workEndHour, settings.workEndMinute)}
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
            Total working hours per day:{' '}
            <span className="font-medium">
              {((settings.workEndHour * 60 + settings.workEndMinute) - 
                (settings.workStartHour * 60 + settings.workStartMinute)) / 60} hours
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Meal Times
          </CardTitle>
          <CardDescription>
            Configure your meal breaks. Tasks will be scheduled around these times.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Breakfast Time</Label>
              <Input
                type="time"
                value={settings.breakfastTime}
                onChange={(e) => setSettings({ ...settings, breakfastTime: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="180"
                  value={settings.breakfastDuration}
                  onChange={(e) => setSettings({ ...settings, breakfastDuration: parseInt(e.target.value) || 0 })}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">mins</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lunch Time</Label>
              <Input
                type="time"
                value={settings.lunchTime}
                onChange={(e) => setSettings({ ...settings, lunchTime: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="180"
                  value={settings.lunchDuration}
                  onChange={(e) => setSettings({ ...settings, lunchDuration: parseInt(e.target.value) || 0 })}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">mins</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dinner Time</Label>
              <Input
                type="time"
                value={settings.dinnerTime}
                onChange={(e) => setSettings({ ...settings, dinnerTime: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="180"
                  value={settings.dinnerDuration}
                  onChange={(e) => setSettings({ ...settings, dinnerDuration: parseInt(e.target.value) || 0 })}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">mins</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Break Settings
          </CardTitle>
          <CardDescription>
            Configure automatic breaks during work hours to maintain productivity.
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
              <div className="space-y-2">
                <Label>Short Break</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Every</span>
                  <Input
                    type="number"
                    min="30"
                    max="300"
                    value={settings.shortBreakInterval}
                    onChange={(e) => setSettings({ ...settings, shortBreakInterval: parseInt(e.target.value) || 120 })}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">mins</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Duration:</span>
                  <Input
                    type="number"
                    min="5"
                    max="30"
                    value={settings.shortBreakDuration}
                    onChange={(e) => setSettings({ ...settings, shortBreakDuration: parseInt(e.target.value) || 10 })}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">mins</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Long Break</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Every</span>
                  <Input
                    type="number"
                    min="120"
                    max="480"
                    value={settings.longBreakInterval}
                    onChange={(e) => setSettings({ ...settings, longBreakInterval: parseInt(e.target.value) || 240 })}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">mins</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Duration:</span>
                  <Input
                    type="number"
                    min="15"
                    max="60"
                    value={settings.longBreakDuration}
                    onChange={(e) => setSettings({ ...settings, longBreakDuration: parseInt(e.target.value) || 30 })}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">mins</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Working Days & Timezone
          </CardTitle>
          <CardDescription>
            Select which days you work and your timezone for accurate scheduling.
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
                      const days = settings.workingDays.split(',').filter(d => d);
                      if (isSelected) {
                        const newDays = days.filter(d => d !== day.value);
                        setSettings({ ...settings, workingDays: newDays.join(',') });
                      } else {
                        const newDays = [...days, day.value].sort();
                        setSettings({ ...settings, workingDays: newDays.join(',') });
                      }
                    }}
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Selected: {settings.workingDays.split(',').filter(d => d).length} days per week
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
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
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Asia/Shanghai">Shanghai (CST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Australia/Sydney">Sydney (AEDT/AEST)</option>
              </optgroup>
            </select>
            <p className="text-sm text-muted-foreground">
              Current time: {new Date().toLocaleTimeString('en-US', { timeZone: settings.timezone })}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
