import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TrelloIntegrationSettings } from './TrelloIntegrationSettings';
import { 
  Bot, 
  Webhook, 
  Settings as SettingsIcon,
  BarChart3,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Trash2,
  AlertCircle,
  Tag,
  Info
} from 'lucide-react';

interface Webhook {
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
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [testing, setTesting] = useState(false);
  const [modelId, setModelId] = useState('');
  const [description, setDescription] = useState('');
  const [testCardId, setTestCardId] = useState('');
  const [testComment, setTestComment] = useState('@bot status');
  const [testResult, setTestResult] = useState<any>(null);
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);

  const callbackUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/trello-webhook`
    : '';

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
          const waitTime = delay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } catch (error) {
        lastError = error;
        if (i < maxRetries) {
          const waitTime = delay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, waitTime));
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
        console.log('[TrelloChatbot] Webhooks response:', data);
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
        console.error('Response text (first 200 chars):', responseText.substring(0, 200));
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

    setRegistering(true);
    try {
      const response = await fetch('/api/trello-webhook/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
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

  const testWebhook = async () => {
    if (!testCardId) {
      toast.error('Please enter a card ID');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/trello-webhook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: testCardId,
          comment: testComment,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult(data);
        toast.success('Test webhook sent successfully');
      } else {
        toast.error('Failed to test webhook');
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error('Failed to test webhook');
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Trello Chatbot Configuration
        </CardTitle>
        <CardDescription>
          Manage webhooks, test functionality, and monitor analytics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="setup" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Setup</span>
            </TabsTrigger>
            <TabsTrigger value="labels" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Labels</span>
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Test</span>
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
                <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                  webhookStatus.isConfigured 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                }`}>
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
                              <p className="text-xs text-muted-foreground mt-1">ID: {webhook.idModel}</p>
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

          {/* Test Tab */}
          <TabsContent value="test" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900">Test Your Chatbot</h3>
                    <p className="text-sm text-blue-800 mt-1">
                      Enter a Trello card ID and test comment to verify the chatbot responds correctly
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="testCardId">Trello Card ID *</Label>
                  <Input
                    id="testCardId"
                    placeholder="e.g., 5f1a2b3c4d5e6f7g8h9i0j"
                    value={testCardId}
                    onChange={(e) => setTestCardId(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="testComment">Test Comment</Label>
                  <Textarea
                    id="testComment"
                    placeholder="@bot status"
                    value={testComment}
                    onChange={(e) => setTestComment(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={testWebhook} 
                  disabled={testing || !testCardId}
                  className="w-full"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Send Test Comment'
                  )}
                </Button>

                {testResult && (
                  <Card className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {testResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className="font-semibold">
                            {testResult.success ? 'Test Successful' : 'Test Failed'}
                          </span>
                        </div>
                        <p className="text-sm">{testResult.message}</p>
                        {testResult.response && (
                          <div className="bg-white p-2 rounded text-xs font-mono break-words mt-2">
                            {JSON.stringify(testResult.response, null, 2)}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
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
                        <div className="text-2xl font-bold">{(analytics.overallResponseRate * 100).toFixed(0)}%</div>
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

                  <Button 
                    onClick={loadAnalytics}
                    variant="outline"
                    className="w-full"
                  >
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
