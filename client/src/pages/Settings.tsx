import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { WorkingHoursSettings } from '@/components/WorkingHoursSettings';
import { HolidayManagement } from '@/components/HolidayManagement';
import { PerformanceMetrics } from '@/components/PerformanceMetrics';
import { NotificationSettings } from '@/components/NotificationSettings';
import { TrelloChatbotSettings } from '@/components/TrelloChatbotSettings';

export default function Settings() {
  const [country, setCountry] = useState('US');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-3 md:py-4 flex items-center gap-2 md:gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Settings</h1>
            <p className="text-xs text-muted-foreground">Configure your preferences</p>
          </div>
        </div>
      </header>

      <main className="container py-4 md:py-8 max-w-4xl space-y-4 md:space-y-6">
        <TrelloChatbotSettings />
        <NotificationSettings />
        <PerformanceMetrics />
        <WorkingHoursSettings />
        <HolidayManagement country={country} onCountryChange={setCountry} />
      </main>
    </div>
  );
}
