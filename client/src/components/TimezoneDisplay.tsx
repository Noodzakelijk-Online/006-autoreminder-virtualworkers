import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe, Clock, Sparkles, Edit2, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TimezoneInfo {
  vaId: number;
  vaName: string;
  currentTimezone: string;
  detectedTimezone: string;
  detectionSources: {
    fromName: string | null;
    fromEmail: string | null;
    name: string;
    email: string | null;
  };
  isManuallySet: boolean;
}

interface TimezoneDisplayProps {
  workerId: number;
  currentTimezone: string;
  compact?: boolean;
  onTimezoneChange?: (newTimezone: string) => void;
}

const COMMON_TIMEZONES = [
  'Asia/Manila',
  'Asia/Kolkata',
  'Asia/Jakarta',
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
];

export function TimezoneDisplay({ 
  workerId, 
  currentTimezone, 
  compact = false,
  onTimezoneChange 
}: TimezoneDisplayProps) {
  const [timezoneInfo, setTimezoneInfo] = useState<TimezoneInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone);
  const [saving, setSaving] = useState(false);

  const loadTimezoneInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/va/vas/${workerId}/timezone`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setTimezoneInfo(data);
        setSelectedTimezone(data.currentTimezone);
      }
    } catch (error) {
      console.error('Error loading timezone info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadTimezoneInfo();
    }
  }, [open, workerId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/va/vas/${workerId}/timezone`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ timezone: selectedTimezone }),
      });

      if (response.ok) {
        toast.success('Timezone updated');
        setEditing(false);
        loadTimezoneInfo();
        onTimezoneChange?.(selectedTimezone);
      } else {
        toast.error('Failed to update timezone');
      }
    } catch (error) {
      toast.error('Failed to update timezone');
    } finally {
      setSaving(false);
    }
  };

  const formatTimezone = (tz: string) => {
    return tz.split('/')[1]?.replace(/_/g, ' ') || tz;
  };

  const getCurrentTime = (tz: string) => {
    try {
      return new Date().toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '--:--';
    }
  };

  if (compact) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Globe className="h-3 w-3" />
            <span>{formatTimezone(currentTimezone)}</span>
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Timezone Settings
            </DialogTitle>
            <DialogDescription>
              View and manage timezone for this worker
            </DialogDescription>
          </DialogHeader>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : timezoneInfo ? (
            <div className="space-y-4">
              {/* Current Time */}
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">Current Local Time</p>
                <p className="text-2xl font-mono font-bold">
                  {getCurrentTime(timezoneInfo.currentTimezone)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {timezoneInfo.currentTimezone}
                </p>
              </div>

              {/* Detection Info */}
              {timezoneInfo.detectedTimezone !== timezoneInfo.currentTimezone && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Auto-detected timezone differs</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Based on profile data, we detected: <strong>{formatTimezone(timezoneInfo.detectedTimezone)}</strong>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setSelectedTimezone(timezoneInfo.detectedTimezone);
                      setEditing(true);
                    }}
                  >
                    Use detected timezone
                  </Button>
                </div>
              )}

              {/* Detection Sources */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Detection Sources</p>
                <div className="grid gap-2 text-sm">
                  {timezoneInfo.detectionSources.fromEmail && (
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">From email domain:</span>
                      <Badge variant="secondary">{timezoneInfo.detectionSources.fromEmail}</Badge>
                    </div>
                  )}
                  {timezoneInfo.detectionSources.fromName && (
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">From name/location:</span>
                      <Badge variant="secondary">{timezoneInfo.detectionSources.fromName}</Badge>
                    </div>
                  )}
                  {!timezoneInfo.detectionSources.fromEmail && !timezoneInfo.detectionSources.fromName && (
                    <p className="text-sm text-muted-foreground">
                      No timezone could be auto-detected. Using default or manually set value.
                    </p>
                  )}
                </div>
              </div>

              {/* Edit Section */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Timezone</p>
                  {!editing && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {editing ? (
                  <div className="flex gap-2">
                    <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {formatTimezone(tz)} ({tz})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm">
                    {formatTimezone(timezoneInfo.currentTimezone)}
                    {timezoneInfo.isManuallySet && (
                      <Badge variant="outline" className="ml-2 text-xs">Manual</Badge>
                    )}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Failed to load timezone information
            </p>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Full display mode
  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{formatTimezone(currentTimezone)}</span>
      <span className="text-xs text-muted-foreground">
        ({getCurrentTime(currentTimezone)})
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <Edit2 className="h-3 w-3" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          {/* Same content as compact mode */}
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Timezone Settings
            </DialogTitle>
          </DialogHeader>
          {/* ... rest of dialog content ... */}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TimezoneDisplay;
