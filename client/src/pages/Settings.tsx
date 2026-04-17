import { useState, useRef } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { IntegrationAutomationSection } from '@/components/IntegrationAutomationSection';
import { SchedulingTimeSection } from '@/components/SchedulingTimeSection';
import { PerformanceMonitoringSection } from '@/components/PerformanceMonitoringSection';
import { SettingsSearch, SearchResult } from '@/components/SettingsSearch';
import { useSettingsSearch } from '@/hooks/useSettingsSearch';

export default function Settings() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  
  const searchResults = useSettingsSearch(searchQuery);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const handleSearchResultClick = (result: SearchResult) => {
    setSearchQuery('');
    setSearchOpen(false);
    
    // Scroll to the relevant section
    setTimeout(() => {
      const sectionElement = document.querySelector(
        `[data-settings-section="${result.section}"]`
      );
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
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

      <main className="container py-4 md:py-8 max-w-5xl">
        {/* Header with Search */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Settings</h2>
            <p className="text-muted-foreground text-sm">
              Configure your preferences and integrations
            </p>
          </div>
          
          {/* Global Search Bar */}
          <div ref={searchContainerRef} className="relative w-full md:w-80 flex-shrink-0">
            <SettingsSearch
              searchResults={searchResults}
              onSearchChange={setSearchQuery}
              onResultClick={handleSearchResultClick}
              isOpen={searchOpen}
              onOpenChange={setSearchOpen}
            />
          </div>
        </div>

        {/* Super Tabs */}
        <Tabs defaultValue="integration" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="integration">Integration & Automation</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling & Time</TabsTrigger>
            <TabsTrigger value="performance">Performance & Monitoring</TabsTrigger>
          </TabsList>

          {/* Integration & Automation Tab */}
          <TabsContent value="integration" className="space-y-6">
            <div data-settings-section="Integration & Automation">
              <IntegrationAutomationSection />
            </div>
          </TabsContent>

          {/* Scheduling & Time Tab */}
          <TabsContent value="scheduling" className="space-y-6">
            <div data-settings-section="Scheduling & Time">
              <SchedulingTimeSection />
            </div>
          </TabsContent>

          {/* Performance & Monitoring Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div data-settings-section="Performance & Monitoring">
              <PerformanceMonitoringSection />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
