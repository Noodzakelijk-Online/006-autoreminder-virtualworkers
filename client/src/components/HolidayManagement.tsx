import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar, RefreshCw, Check, X, Users } from 'lucide-react';

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

interface Worker {
  id: number;
  name: string;
  timezone: string;
  email?: string;
}

interface HolidayManagementProps {
  country: string;
  onCountryChange: (country: string) => void;
}

export function HolidayManagement({ country, onCountryChange }: HolidayManagementProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCountries, setFetchingCountries] = useState(true);
  const [fetchingWorkers, setFetchingWorkers] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectionMode, setSelectionMode] = useState<'general' | 'worker'>('general');

  // Fetch countries and workers on mount
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

    const fetchWorkers = async () => {
      try {
        const response = await fetch('/api/holidays/workers');
        if (response.ok) {
          const data = await response.json();
          setWorkers(data);
        }
      } catch (error) {
        console.error('Error fetching workers:', error);
      } finally {
        setFetchingWorkers(false);
      }
    };

    fetchCountries();
    fetchWorkers();
  }, []);

  // Fetch user's holidays on mount
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const response = await fetch('/api/holidays/list');
        if (response.ok) {
          const data = await response.json();
          setHolidays(data);
        }
      } catch (error) {
        console.error('Error fetching holidays:', error);
      }
    };

    fetchHolidays();
  }, []);

  const handleFetchHolidaysGeneral = async () => {
    if (!country) {
      toast.error('Please select a country first');
      return;
    }

    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const response = await fetch(`/api/holidays/fetch/${country}/${currentYear}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch holidays');
      }

      const data = await response.json();
      setHolidays(data.holidays);
      toast.success(`Loaded ${data.count} holidays for ${country}`);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to fetch holidays. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchHolidaysByWorker = async () => {
    if (!selectedWorker) {
      toast.error('Please select a worker first');
      return;
    }

    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const response = await fetch(`/api/holidays/by-timezone/${selectedWorker.timezone}/${currentYear}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch holidays');
      }

      const data = await response.json();
      setHolidays(data.holidays);
      toast.success(`Loaded ${data.count} holidays for ${selectedWorker.name} (${selectedWorker.timezone})`);
    } catch (error: any) {
      console.error('Error fetching holidays by timezone:', error);
      toast.error(error.message || 'Failed to fetch holidays. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHoliday = async (holidayId: number) => {
    try {
      const response = await fetch(`/api/holidays/toggle/${holidayId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to toggle holiday');
      }

      const data = await response.json();
      
      // Update local state
      setHolidays(holidays.map(h => 
        h.id === holidayId ? { ...h, isActive: data.isActive } : h
      ));

      toast.success(data.isActive === 1 ? 'Holiday enabled' : 'Holiday disabled');
    } catch (error) {
      console.error('Error toggling holiday:', error);
      toast.error('Failed to update holiday');
    }
  };

  const activeHolidays = holidays.filter(h => h.isActive === 1);
  const inactiveHolidays = holidays.filter(h => h.isActive === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <Calendar className="h-5 w-5" />
          Holiday Calendar
        </CardTitle>
        <CardDescription>
          Automatically mark public holidays as non-working days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4">
        {/* Selection Mode Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setSelectionMode('general')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              selectionMode === 'general'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setSelectionMode('worker')}
            className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              selectionMode === 'worker'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            By Worker
          </button>
        </div>

        {/* General Mode */}
        {selectionMode === 'general' && (
          <div className="space-y-2">
            <Label htmlFor="country" className="text-sm md:text-base">Country</Label>
            <div className="flex flex-col md:flex-row gap-2">
              <select
                id="country"
                value={country}
                onChange={(e) => onCountryChange(e.target.value)}
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
                onClick={handleFetchHolidaysGeneral}
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

        {/* Worker Mode */}
        {selectionMode === 'worker' && (
          <div className="space-y-2">
            <Label htmlFor="worker" className="text-sm md:text-base">Select Worker</Label>
            <div className="flex flex-col md:flex-row gap-2">
              <select
                id="worker"
                value={selectedWorker?.id || ''}
                onChange={(e) => {
                  const workerId = parseInt(e.target.value);
                  const worker = workers.find(w => w.id === workerId) || null;
                  setSelectedWorker(worker);
                }}
                className="flex-1 px-3 py-2 border rounded-md bg-background"
                disabled={fetchingWorkers || workers.length === 0}
              >
                <option value="">Select a worker...</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.timezone})
                  </option>
                ))}
              </select>
              <Button
                onClick={handleFetchHolidaysByWorker}
                disabled={loading || !selectedWorker}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Fetch Holidays'}
              </Button>
            </div>
            {selectedWorker && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Showing holidays for:</strong> {selectedWorker.name} ({selectedWorker.timezone})
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {workers.length === 0 
                ? 'No workers found. Create workers from the Founder Dashboard.'
                : holidays.length > 0 
                  ? `${activeHolidays.length} active holidays, ${inactiveHolidays.length} disabled`
                  : 'No holidays loaded. Select a worker and click "Fetch Holidays".'}
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
                      <div className="font-medium">{holiday.name}</div>
                      <div className="text-sm text-muted-foreground">
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
                        <>
                          <Check className="h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3" />
                          Disabled
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
