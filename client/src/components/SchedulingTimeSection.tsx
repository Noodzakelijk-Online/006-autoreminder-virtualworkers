import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkingHoursSettings } from './WorkingHoursSettings';
import { HolidayManagement } from './HolidayManagement';

export function SchedulingTimeSection() {
  const [activeTab, setActiveTab] = useState('working-hours');
  const [country, setCountry] = useState('US');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
              <TabsTrigger value="holidays">Holidays & Days Off</TabsTrigger>
            </TabsList>

            <TabsContent value="working-hours" className="space-y-4 mt-4">
              <WorkingHoursSettings />
            </TabsContent>

            <TabsContent value="holidays" className="space-y-4 mt-4">
              <HolidayManagement country={country} onCountryChange={setCountry} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
