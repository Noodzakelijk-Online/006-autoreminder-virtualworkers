import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TrelloIntegrationSettings } from './TrelloIntegrationSettings';
import {
  Bot,
  Webhook,
  Settings as SettingsIcon,
  BarChart3,
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
  AlertCircle,
  Tag,
} from 'lucide-react';

interface WebhookItem {
  id: string;
  description: string;
  idModel: string;
  callbackURL: string;
  active: boolean;
}

interface AnalyticsStats {
  totalConversations: number;
  totalCommands: Record<string, number>;
  avgResponseTimeMs: number;
  totalCheckins: number;
  totalResponses: number;
  overallResponseRate: number;
  avgCheckinResponseMinutes: number;
  activeWorkers: number;
  activeCards: number;
  topCommands: Array<{ command: string; count: number }>;
}

interface WebhookStatus {
  callbackUrl: string | null;
  publicUrl: string | null;
  isConfigured: boolean;
  isReachable: boolean;
  recommendation: string;
}

export function TrelloChatbotSettings() {
  const [activeTab, setActiveTab] = useState('setup');
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [modelId, setModelId] = useState('');
  const [description, setDescription] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);

  const callbackUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/trello-webhook` : '';

  // Retry logic with exponential backoff
  const retryFetch = async (url: string, maxRetries = 2, delay = 500) => {
    let lastError: any;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok || response.status !== 503) {
          return response;
        }
        lastError = new Error(`HTTP ${response.status}`);
        if (i < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      } catch (error) {
        lastError = error;
        if (i < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  };

  useEffect(() => {
    loadWebhookStatus();
    const webhooksTimer = setTimeout(() => loadWebhooks(), 300);
    const analyticsTimer = setTimeout(() => loadAnalytics(), 600);
    return () => {
      clearTimeout(webhooksTimer);
      clearTimeout(analyticsTimer);
    };
  }, []);

  const loadWebhookStatus = async () => {
    try {
      const response = await fetch('/api/trello-webhook/status');
      if (response.ok) {
        const data = await response.json();
        setWebhookStatus(data.status);
      }
    } catch (error) {
      console.error('Error loading webhook status:', error);
    }
  };

  const loadWebhooks = async () => {
    setLoading(true);
    try {
      const response = await retryFetch('/api/trello-webhook/list', 2, 500);
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.webhooks || []);
      } else {
        const errorText = await response.text();
        console.error('[TrelloChatbot] Failed to load webhooks:', response.status, errorText);
        if (response.status !== 503) {
          toast.error(`Failed to load webhooks: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('[TrelloChatbot] Error loading webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await retryFetch('/api/chatbot/analytics', 2, 500);
      const responseText = await response.text();

      if (!response.ok) {
        console.error('Analytics API error - status:', response.status);
        if (response.status !== 503) {
          console.error('Response:', responseText.substring(0, 200));
        }
        return;
      }

      try {
        const data = JSON.parse(responseText);
        setAnalytics(data);
      } catch (parseError) {
        console.error('Failed to parse analytics response as JSON:', parseError);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const registerWebhook = async () => {
    if (!modelId) {
      toast.error('Please enter a Model ID (board or workspace ID)');
      return;
    }

    // Extract board ID from Trello URL if full URL is provided
    let boardId = modelId;
    if (modelId.includes('trello.com')) {
      // Extract ID from URL like https://trello.com/b/ckEuBpNz/board-name
      const match = modelId.match(/\/b\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        boardId = match[1];
      } else {
        toast.error('Invalid Trello URL. Please use format: https://trello.com/b/BOARD_ID/board-name');
        return;
      }
    }

    setRegistering(true);
    try {
      const response = await fetch('/api/trello-webhook/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: boardId,
          description: description || 'VA Dashboard Chatbot',
          callbackUrl,
        }),
      });

      if (response.ok) {
        toast.success('Webhook registered successfully!');
        setModelId('');
        setDescription('');
        loadWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to register webhook');
      }
    } catch (error) {
      console.error('Error registering webhook:', error);
      toast.error('Failed to register webhook');
    } finally {
      setRegistering(false);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`/api/trello-webhook/${webhookId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Webhook deleted successfully');
        loadWebhooks();
      } else {
        toast.error('Failed to delete webhook');
      }
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast.error('Failed to delete webhook');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Trello Chatbot Configuration
        </CardTitle>
        <CardDescription>Manage webhooks and monitor analytics</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="setup" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Setup</span>
            </TabsTrigger>
            <TabsTrigger value="labels" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Labels</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* Setup Tab */}
          <TabsContent value="setup" className="space-y-4 mt-4">
            <div className="space-y-4">
              {webhookStatus && (
                <div
                  className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                    webhookStatus.isConfigured
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                  }`}
                >
                  {webhookStatus.isConfigured ? (
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                  )}
                  <span className="font-medium">
                    {webhookStatus.isConfigured ? 'Webhook Configured' : 'Webhook Not Configured'}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label htmlFor="modelId">Trello Board/Workspace ID *</Label>
                  <Input
                    id="modelId"
                    placeholder="e.g., 5f1a2b3c4d5e6f7g8h9i0j"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Find this in your Trello board URL: trello.com/b/{'{id}'}
                  </p>
                </div>

                <div>
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="e.g., Main workspace chatbot"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <Button
                  onClick={registerWebhook}
                  disabled={registering || !modelId}
                  className="w-full"
                >
                  {registering ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    'Register Webhook'
                  )}
                </Button>
              </div>

              {/* Registered Webhooks List */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Registered Webhooks
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : webhooks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Webhook className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No webhooks registered yet</p>
                  </div>
                ) : (
                  webhooks.map((webhook) => (
                    <Card key={webhook.id}>
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-sm">{webhook.description}</h4>
                                <Badge variant={webhook.active ? 'default' : 'secondary'}>
                                  {webhook.active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                ID: {webhook.idModel}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteWebhook(webhook.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="bg-muted p-2 rounded text-xs font-mono break-all">
                            {webhook.callbackURL}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Labels Tab */}
          <TabsContent value="labels" className="space-y-4 mt-4">
            <TrelloIntegrationSettings />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4 mt-4">
            <div className="space-y-4">
              {loadingAnalytics ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : analytics ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold">{analytics.totalConversations}</div>
                        <p className="text-xs text-muted-foreground">Total Conversations</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold">{analytics.totalCheckins}</div>
                        <p className="text-xs text-muted-foreground">Total Check-ins</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold">
                          {(analytics.overallResponseRate * 100).toFixed(0)}%
                        </div>
                        <p className="text-xs text-muted-foreground">Response Rate</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold">{analytics.avgResponseTimeMs}ms</div>
                        <p className="text-xs text-muted-foreground">Avg Response Time</p>
                      </CardContent>
                    </Card>
                  </div>

                  {analytics.topCommands.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Top Commands</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analytics.topCommands.map((cmd) => (
                            <div key={cmd.command} className="flex justify-between items-center">
                              <span className="text-sm font-mono">{cmd.command}</span>
                              <Badge variant="secondary">{cmd.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Button onClick={loadAnalytics} variant="outline" className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Analytics
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No analytics data available yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
