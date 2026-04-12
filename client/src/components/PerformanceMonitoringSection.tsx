import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PerformanceMetrics } from './PerformanceMetrics';

export function PerformanceMonitoringSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('system-health');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <span>Performance & Monitoring</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor system health, cache performance, and request optimization
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2"
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent>
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
          </CardContent>
        )}
      </Card>
    </div>
  );
}
