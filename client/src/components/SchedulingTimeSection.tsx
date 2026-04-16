import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import { WorkingHoursSettings } from './WorkingHoursSettings';
import { HolidayManagement } from './HolidayManagement';

interface Worker {
  id: number;
  name: string;
  timezone: string;
  email?: string;
}

export function SchedulingTimeSection() {
  const [activeTab, setActiveTab] = useState('working-hours');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  useEffect(() => {
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
        setLoadingWorkers(false);
      }
    };
    fetchWorkers();
  }, []);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Employee selector */}
          <div className="space-y-1.5">
            <Label htmlFor="employee-select" className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Employee
            </Label>
            <select
              id="employee-select"
              value={selectedWorkerId ?? ''}
              onChange={(e) =>
                setSelectedWorkerId(e.target.value === '' ? null : parseInt(e.target.value))
              }
              disabled={loadingWorkers}
              className="w-full md:w-72 px-3 py-2 border rounded-md bg-background text-sm"
            >
              <option value="">Default (All Employees)</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {w.timezone}
                </option>
              ))}
            </select>
            {selectedWorker && (
              <p className="text-xs text-muted-foreground">
                Timezone: <span className="font-medium">{selectedWorker.timezone}</span>
                {selectedWorker.email && (
                  <> · {selectedWorker.email}</>
                )}
              </p>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
              <TabsTrigger value="holidays">Holidays & Days Off</TabsTrigger>
            </TabsList>

            <TabsContent value="working-hours" className="space-y-4 mt-4">
              <WorkingHoursSettings
                workerId={selectedWorkerId}
                workerName={selectedWorker?.name ?? null}
                workerTimezone={selectedWorker?.timezone ?? null}
              />
            </TabsContent>

            <TabsContent value="holidays" className="space-y-4 mt-4">
              <HolidayManagement
                workerId={selectedWorkerId}
                workerTimezone={selectedWorker?.timezone ?? null}
                workerName={selectedWorker?.name ?? null}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
