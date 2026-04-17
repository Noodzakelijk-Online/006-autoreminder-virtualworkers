import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export function PerformanceMonitoringSection() {
  const [activeTab, setActiveTab] = useState('cache');
  const [isSaving, setIsSaving] = useState(false);

  // Cache Settings State
  const [cacheSettings, setCacheSettings] = useState({
    ttl: 3600,
    maxSize: 1000,
    enableCompression: true,
    compressionThreshold: 1024,
  });

  // Queue Settings State
  const [queueSettings, setQueueSettings] = useState({
    maxQueueSize: 5000,
    deduplicationEnabled: true,
    deduplicationWindow: 30,
    priorityLevels: 3,
  });

  // WebSocket Settings State
  const [websocketSettings, setWebsocketSettings] = useState({
    connectionTimeout: 30,
    heartbeatInterval: 45,
    maxConnections: 10000,
    enableCompression: true,
  });

  // Request Settings State
  const [requestSettings, setRequestSettings] = useState({
    timeout: 30,
    retryAttempts: 3,
    retryDelay: 1000,
    enableCaching: true,
  });

  const handleSaveSettings = async (settingType: string) => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success(`${settingType} settings saved successfully`);
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="cache">Cache Settings</TabsTrigger>
              <TabsTrigger value="queue">Queue Settings</TabsTrigger>
              <TabsTrigger value="websocket">WebSocket Settings</TabsTrigger>
              <TabsTrigger value="request">Request Settings</TabsTrigger>
            </TabsList>

            {/* Cache Settings Tab */}
            <TabsContent value="cache" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground mb-4">
                Configure cache behavior and performance parameters
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="cache-ttl">Cache TTL (Time To Live) in seconds</Label>
                  <Input
                    id="cache-ttl"
                    type="number"
                    min="60"
                    max="86400"
                    value={cacheSettings.ttl}
                    onChange={(e) => setCacheSettings({ ...cacheSettings, ttl: parseInt(e.target.value) })}
                    placeholder="Enter TTL in seconds"
                  />
                  <p className="text-xs text-muted-foreground">Default: 3600 seconds (1 hour)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cache-size">Max Cache Size (number of items)</Label>
                  <Input
                    id="cache-size"
                    type="number"
                    min="100"
                    max="100000"
                    value={cacheSettings.maxSize}
                    onChange={(e) => setCacheSettings({ ...cacheSettings, maxSize: parseInt(e.target.value) })}
                    placeholder="Enter max cache size"
                  />
                  <p className="text-xs text-muted-foreground">Default: 1000 items</p>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="cache-compression">Enable Cache Compression</Label>
                    <p className="text-xs text-muted-foreground">Compress cached data to reduce memory usage</p>
                  </div>
                  <Switch
                    id="cache-compression"
                    checked={cacheSettings.enableCompression}
                    onCheckedChange={(checked) => setCacheSettings({ ...cacheSettings, enableCompression: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="compression-threshold">Compression Threshold (bytes)</Label>
                  <Input
                    id="compression-threshold"
                    type="number"
                    min="512"
                    max="10240"
                    value={cacheSettings.compressionThreshold}
                    onChange={(e) => setCacheSettings({ ...cacheSettings, compressionThreshold: parseInt(e.target.value) })}
                    placeholder="Enter compression threshold"
                  />
                  <p className="text-xs text-muted-foreground">Compress items larger than this size</p>
                </div>

                <Button onClick={() => handleSaveSettings('Cache')} disabled={isSaving} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Cache Settings'}
                </Button>
              </div>
            </TabsContent>

            {/* Queue Settings Tab */}
            <TabsContent value="queue" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground mb-4">
                Configure request queue and deduplication parameters
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="queue-size">Max Queue Size (requests)</Label>
                  <Input
                    id="queue-size"
                    type="number"
                    min="1000"
                    max="100000"
                    value={queueSettings.maxQueueSize}
                    onChange={(e) => setQueueSettings({ ...queueSettings, maxQueueSize: parseInt(e.target.value) })}
                    placeholder="Enter max queue size"
                  />
                  <p className="text-xs text-muted-foreground">Default: 5000 requests</p>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="dedup-enabled">Enable Request Deduplication</Label>
                    <p className="text-xs text-muted-foreground">Automatically deduplicate identical requests</p>
                  </div>
                  <Switch
                    id="dedup-enabled"
                    checked={queueSettings.deduplicationEnabled}
                    onCheckedChange={(checked) => setQueueSettings({ ...queueSettings, deduplicationEnabled: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dedup-window">Deduplication Window (seconds)</Label>
                  <Input
                    id="dedup-window"
                    type="number"
                    min="5"
                    max="300"
                    value={queueSettings.deduplicationWindow}
                    onChange={(e) => setQueueSettings({ ...queueSettings, deduplicationWindow: parseInt(e.target.value) })}
                    placeholder="Enter deduplication window"
                  />
                  <p className="text-xs text-muted-foreground">Time window to check for duplicate requests</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority-levels">Priority Levels</Label>
                  <Select value={queueSettings.priorityLevels.toString()} onValueChange={(val) => setQueueSettings({ ...queueSettings, priorityLevels: parseInt(val) })}>
                    <SelectTrigger id="priority-levels">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Levels (Low, High)</SelectItem>
                      <SelectItem value="3">3 Levels (Low, Medium, High)</SelectItem>
                      <SelectItem value="5">5 Levels (Very Low to Very High)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Number of priority levels for request processing</p>
                </div>

                <Button onClick={() => handleSaveSettings('Queue')} disabled={isSaving} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Queue Settings'}
                </Button>
              </div>
            </TabsContent>

            {/* WebSocket Settings Tab */}
            <TabsContent value="websocket" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground mb-4">
                Configure WebSocket connection parameters
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="ws-timeout">Connection Timeout (seconds)</Label>
                  <Input
                    id="ws-timeout"
                    type="number"
                    min="5"
                    max="120"
                    value={websocketSettings.connectionTimeout}
                    onChange={(e) => setWebsocketSettings({ ...websocketSettings, connectionTimeout: parseInt(e.target.value) })}
                    placeholder="Enter connection timeout"
                  />
                  <p className="text-xs text-muted-foreground">Default: 30 seconds</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ws-heartbeat">Heartbeat Interval (seconds)</Label>
                  <Input
                    id="ws-heartbeat"
                    type="number"
                    min="10"
                    max="300"
                    value={websocketSettings.heartbeatInterval}
                    onChange={(e) => setWebsocketSettings({ ...websocketSettings, heartbeatInterval: parseInt(e.target.value) })}
                    placeholder="Enter heartbeat interval"
                  />
                  <p className="text-xs text-muted-foreground">Default: 45 seconds</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ws-max-connections">Max Concurrent Connections</Label>
                  <Input
                    id="ws-max-connections"
                    type="number"
                    min="100"
                    max="100000"
                    value={websocketSettings.maxConnections}
                    onChange={(e) => setWebsocketSettings({ ...websocketSettings, maxConnections: parseInt(e.target.value) })}
                    placeholder="Enter max connections"
                  />
                  <p className="text-xs text-muted-foreground">Default: 10000 connections</p>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="ws-compression">Enable WebSocket Compression</Label>
                    <p className="text-xs text-muted-foreground">Compress WebSocket frames to reduce bandwidth</p>
                  </div>
                  <Switch
                    id="ws-compression"
                    checked={websocketSettings.enableCompression}
                    onCheckedChange={(checked) => setWebsocketSettings({ ...websocketSettings, enableCompression: checked })}
                  />
                </div>

                <Button onClick={() => handleSaveSettings('WebSocket')} disabled={isSaving} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save WebSocket Settings'}
                </Button>
              </div>
            </TabsContent>

            {/* Request Settings Tab */}
            <TabsContent value="request" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground mb-4">
                Configure request handling and retry parameters
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="req-timeout">Request Timeout (seconds)</Label>
                  <Input
                    id="req-timeout"
                    type="number"
                    min="5"
                    max="300"
                    value={requestSettings.timeout}
                    onChange={(e) => setRequestSettings({ ...requestSettings, timeout: parseInt(e.target.value) })}
                    placeholder="Enter request timeout"
                  />
                  <p className="text-xs text-muted-foreground">Default: 30 seconds</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retry-attempts">Retry Attempts</Label>
                  <Input
                    id="retry-attempts"
                    type="number"
                    min="0"
                    max="10"
                    value={requestSettings.retryAttempts}
                    onChange={(e) => setRequestSettings({ ...requestSettings, retryAttempts: parseInt(e.target.value) })}
                    placeholder="Enter retry attempts"
                  />
                  <p className="text-xs text-muted-foreground">Default: 3 attempts</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retry-delay">Retry Delay (milliseconds)</Label>
                  <Input
                    id="retry-delay"
                    type="number"
                    min="100"
                    max="10000"
                    value={requestSettings.retryDelay}
                    onChange={(e) => setRequestSettings({ ...requestSettings, retryDelay: parseInt(e.target.value) })}
                    placeholder="Enter retry delay"
                  />
                  <p className="text-xs text-muted-foreground">Default: 1000 ms</p>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="req-caching">Enable Request Caching</Label>
                    <p className="text-xs text-muted-foreground">Cache GET requests for improved performance</p>
                  </div>
                  <Switch
                    id="req-caching"
                    checked={requestSettings.enableCaching}
                    onCheckedChange={(checked) => setRequestSettings({ ...requestSettings, enableCaching: checked })}
                  />
                </div>

                <Button onClick={() => handleSaveSettings('Request')} disabled={isSaving} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Request Settings'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
