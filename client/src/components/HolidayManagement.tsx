import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardWithTooltip } from '@/components/CardWithTooltip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Calendar, RefreshCw, Check, X, Info } from 'lucide-react';

interface Holiday {
  id: number;
  date: string;
  name: string;
  country: string;
  isActive: number;
}

interface Country {
  countryCode: string;
  name: string;
}

interface HolidayManagementProps {
  workerId: number | null;
  workerTimezone: string | null;
  workerName: string | null;
}

export function HolidayManagement({ workerId, workerTimezone, workerName }: HolidayManagementProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingCountries, setFetchingCountries] = useState(true);

  // Fetch countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch('/api/holidays/countries');
        if (response.ok) {
          const data = await response.json();
          setCountries(data);
        }
      } catch (error) {
        console.error('Error fetching countries:', error);
      } finally {
        setFetchingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  // Reload holidays when workerId changes
  useEffect(() => {
    fetchStoredHolidays();
  }, [workerId]);

  const fetchStoredHolidays = async () => {
    try {
      const url = workerId
        ? `/api/holidays/list?workerId=${workerId}`
        : '/api/holidays/list';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setHolidays(data);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const handleFetchHolidays = async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();

      if (workerId && workerTimezone) {
        // Fetch by worker timezone
        const encodedTimezone = encodeURIComponent(workerTimezone);
        const url = `/api/holidays/by-timezone/${encodedTimezone}/${currentYear}?workerId=${workerId}`;
        const response = await fetch(url);
        const responseText = await response.text();

        if (!response.ok) {
          const err = (() => { try { return JSON.parse(responseText); } catch { return {}; } })();
          throw new Error(err.error || `Failed to fetch holidays (${response.status})`);
        }

        const data = JSON.parse(responseText);
        setHolidays(data.holidays || []);
        toast.success(
          `Loaded ${data.count} holidays for ${workerName ?? 'worker'} (${workerTimezone})`
        );
      } else {
        // General mode — fetch by selected country
        if (!country) {
          toast.error('Please select a country first');
          setLoading(false);
          return;
        }
        const url = `/api/holidays/fetch/${country}/${currentYear}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch holidays');
        const data = await response.json();
        setHolidays(data.holidays || []);
        toast.success(`Loaded ${data.count} holidays for ${country}`);
      }
    } catch (error: any) {
      console.error('Error fetching holidays:', error);
      toast.error(error.message || 'Failed to fetch holidays. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHoliday = async (holidayId: number) => {
    try {
      const url = workerId
        ? `/api/holidays/toggle/${holidayId}?workerId=${workerId}`
        : `/api/holidays/toggle/${holidayId}`;
      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) throw new Error('Failed to toggle holiday');

      const data = await response.json();
      setHolidays((prev) =>
        prev.map((h) => (h.id === holidayId ? { ...h, isActive: data.isActive } : h))
      );
      toast.success(data.isActive === 1 ? 'Holiday enabled' : 'Holiday disabled');
    } catch (error) {
      console.error('Error toggling holiday:', error);
      toast.error('Failed to update holiday');
    }
  };

  const activeHolidays = holidays.filter((h) => h.isActive === 1);
  const inactiveHolidays = holidays.filter((h) => h.isActive === 0);

  return (
    <CardWithTooltip
      title="Holiday Calendar"
      tooltipContent={workerName
        ? `Managing holidays for ${workerName} — automatically fetched from their timezone`
        : 'Automatically mark public holidays as non-working days'}
      icon={<Calendar className="h-5 w-5" />}
    >
      <div className="space-y-3 md:space-y-4">

        {/* Worker mode: show timezone badge + fetch button */}
        {workerId && workerTimezone ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Timezone:</span>
                <Badge variant="secondary">{workerTimezone}</Badge>
              </div>
              <Button
                onClick={handleFetchHolidays}
                disabled={loading}
                className="flex items-center gap-2"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Fetch Holidays'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {holidays.length > 0
                ? `${activeHolidays.length} active, ${inactiveHolidays.length} disabled`
                : `No holidays loaded yet. Click "Fetch Holidays" to load holidays for ${workerName ?? 'this worker'}.`}
            </p>
          </div>
        ) : (
          /* General mode: country selector */
          <div className="space-y-2">
            <Label htmlFor="country" className="text-sm md:text-base">Country</Label>
            <div className="flex flex-col md:flex-row gap-2">
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md bg-background"
                disabled={fetchingCountries}
              >
                <option value="">Select a country...</option>
                {countries.map((c) => (
                  <option key={c.countryCode} value={c.countryCode}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleFetchHolidays}
                disabled={loading || !country}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Fetch Holidays'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {holidays.length > 0
                ? `${activeHolidays.length} active holidays, ${inactiveHolidays.length} disabled`
                : 'No holidays loaded. Select a country and click "Fetch Holidays".'}
            </p>
          </div>
        )}

        {/* Holidays List */}
        {holidays.length > 0 && (
          <div className="space-y-2">
            <Label>Holidays ({new Date().getFullYear()})</Label>
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <div className="divide-y">
                {holidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-2 md:p-3 hover:bg-accent/50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{holiday.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <Button
                      variant={holiday.isActive === 1 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleToggleHoliday(holiday.id)}
                      className="flex items-center gap-1"
                    >
                      {holiday.isActive === 1 ? (
                        <><Check className="h-3 w-3" /> Active</>
                      ) : (
                        <><X className="h-3 w-3" /> Disabled</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </CardWithTooltip>
  );
}
