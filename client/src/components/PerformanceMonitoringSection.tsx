import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PerformanceMetrics } from './PerformanceMetrics';

export function PerformanceMonitoringSection() {
  const [activeTab, setActiveTab] = useState('system-health');

  return (
    <div className="space-y-4 ">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="system-health">System Health</TabsTrigger>
          <TabsTrigger value="cache">Cache Performance</TabsTrigger>
          <TabsTrigger value="queue">Request Queue</TabsTrigger>
          <TabsTrigger value="websocket">WebSocket Status</TabsTrigger>
        </TabsList>

        <TabsContent value="system-health" className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground mb-4">
            Overall system health and recommendations
          </div>
          <PerformanceMetrics showSection="health" />
        </TabsContent>

        <TabsContent value="cache" className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground mb-4">
            Database caching performance and hit rates
          </div>
          <PerformanceMetrics showSection="cache" />
        </TabsContent>

        <TabsContent value="queue" className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground mb-4">
            Request deduplication and queue performance
          </div>
          <PerformanceMetrics showSection="queue" />
        </TabsContent>

        <TabsContent value="websocket" className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground mb-4">
            Real-time WebSocket connection status
          </div>
          <PerformanceMetrics showSection="websocket" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
