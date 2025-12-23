import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, BellOff, Clock, Mail, Smartphone, AlertTriangle, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationPreferences {
  notificationMode: 'disabled' | 'daily_digest' | 'priority_only';
  digestTime: string;
  digestTimezone: string;
  urgentThresholdHours: number;
  emailEnabled: boolean;
  emailAddress: string | null;
  inAppEnabled: boolean;
  lastDigestSent: string | null;
}

const TIMEZONES = [
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
];

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notificationMode: 'priority_only',
    digestTime: '08:00',
    digestTimezone: 'Europe/Amsterdam',
    urgentThresholdHours: 24,
    emailEnabled: true,
    emailAddress: null,
    inAppEnabled: true,
    lastDigestSent: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/notification-preferences', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      }
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        toast.success('Notification preferences saved');
        setHasChanges(false);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save preferences');
      }
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Control how and when you receive task notifications to minimize interruptions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Mode Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Notification Mode</Label>
          <div className="grid gap-3">
            {/* Disabled Option */}
            <div
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                preferences.notificationMode === 'disabled'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
              onClick={() => updatePreference('notificationMode', 'disabled')}
            >
              <div className={`p-2 rounded-full ${
                preferences.notificationMode === 'disabled' ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <BellOff className={`h-5 w-5 ${
                  preferences.notificationMode === 'disabled' ? 'text-primary' : 'text-muted-foreground'
                }`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Disabled</span>
                  {preferences.notificationMode === 'disabled' && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  No automated notifications. Check the dashboard at your own pace.
                </p>
              </div>
            </div>

            {/* Daily Digest Option */}
            <div
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                preferences.notificationMode === 'daily_digest'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
              onClick={() => updatePreference('notificationMode', 'daily_digest')}
            >
              <div className={`p-2 rounded-full ${
                preferences.notificationMode === 'daily_digest' ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <Clock className={`h-5 w-5 ${
                  preferences.notificationMode === 'daily_digest' ? 'text-primary' : 'text-muted-foreground'
                }`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Daily Digest</span>
                  {preferences.notificationMode === 'daily_digest' && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Receive a single daily summary of all tasks and updates at a scheduled time.
                </p>
              </div>
            </div>

            {/* Priority Only Option */}
            <div
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                preferences.notificationMode === 'priority_only'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
              onClick={() => updatePreference('notificationMode', 'priority_only')}
            >
              <div className={`p-2 rounded-full ${
                preferences.notificationMode === 'priority_only' ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <AlertTriangle className={`h-5 w-5 ${
                  preferences.notificationMode === 'priority_only' ? 'text-primary' : 'text-muted-foreground'
                }`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Priority Only</span>
                  {preferences.notificationMode === 'priority_only' && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Only receive immediate notifications for urgent tasks (due within threshold).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Digest Settings */}
        {preferences.notificationMode === 'daily_digest' && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <Label className="text-sm font-medium">Digest Schedule</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="digestTime" className="text-xs text-muted-foreground">
                  Delivery Time
                </Label>
                <Input
                  id="digestTime"
                  type="time"
                  value={preferences.digestTime}
                  onChange={(e) => updatePreference('digestTime', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="digestTimezone" className="text-xs text-muted-foreground">
                  Timezone
                </Label>
                <Select
                  value={preferences.digestTimezone}
                  onValueChange={(value) => updatePreference('digestTimezone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Priority Only Settings */}
        {preferences.notificationMode === 'priority_only' && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <Label className="text-sm font-medium">Urgency Threshold</Label>
            <div className="space-y-2">
              <Label htmlFor="urgentThreshold" className="text-xs text-muted-foreground">
                Notify when task is due within (hours)
              </Label>
              <Select
                value={String(preferences.urgentThresholdHours)}
                onValueChange={(value) => updatePreference('urgentThresholdHours', parseInt(value))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="12">12 hours</SelectItem>
                  <SelectItem value="24">24 hours (1 day)</SelectItem>
                  <SelectItem value="48">48 hours (2 days)</SelectItem>
                  <SelectItem value="72">72 hours (3 days)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tasks due within this time will trigger immediate notifications
              </p>
            </div>
          </div>
        )}

        {/* Notification Channels */}
        {preferences.notificationMode !== 'disabled' && (
          <div className="space-y-4">
            <Label className="text-base font-medium">Notification Channels</Label>
            
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {preferences.emailAddress || 'No email configured'}
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.emailEnabled}
                onCheckedChange={(checked) => updatePreference('emailEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">In-App Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Show notifications in the dashboard
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.inAppEnabled}
                onCheckedChange={(checked) => updatePreference('inAppEnabled', checked)}
              />
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={savePreferences}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
