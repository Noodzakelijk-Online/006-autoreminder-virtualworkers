import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Trash2, BarChart3 } from 'lucide-react';
import { TrelloBoardSelector } from '@/components/TrelloBoardSelector';
import { BulkBoardSelector } from '@/components/BulkBoardSelector';

interface WebhookStatus {
  callbackUrl: string;
  publicUrl: string;
  isConfigured: boolean;
  isReachable: boolean;
  recommendation: string;
}

interface Webhook {
  id: string;
  trelloWebhookId: string;
  modelId: string;
  isActive: number;
  createdAt?: string;
}

interface Analytics {
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

const retryFetch = async (url: string, retries: number = 2, delay: number = 500) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    } catch (error) {
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
      else throw error;
    }
  }
  throw new Error('Max retries exceeded');
};

export default function TrelloChatbotSettings() {
  const toast = {
    error: (msg: string) => console.error(msg),
    success: (msg: string) => console.log(msg),
  };
  const [modelId, setModelId] = useState('');
  const [description, setDescription] = useState('');
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const callbackUrl = `${window.location.origin}/api/trello-webhook`;

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
      toast.error('Please select a Trello board from the dropdown');
      return;
    }

    // Board ID is already validated by the selector, use it directly
    const boardId = modelId.trim();

    setRegistering(true);
    try {
      const response = await fetch('/api/trello-webhook/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: boardId,
          description: description || 'Trello Chatbot',
          callbackUrl,
        }),
      });

      if (response.ok) {
        console.log('[TrelloChatbotSettings] Webhook registered successfully');
        setModelId('');
        setDescription('');
        loadWebhooks();
      } else {
        const error = await response.json();
        console.error('[TrelloChatbotSettings] Webhook registration failed:', error);
      }
    } catch (error) {
      console.error('Error registering webhook:', error);
      toast.error('Failed to register webhook');
    } finally {
      setRegistering(false);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              T
            </div>
            Trello Chatbot Configuration
          </CardTitle>
          <CardDescription>Manage webhooks and monitor analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="labels">Labels</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Setup Tab */}
            <TabsContent value="setup" className="space-y-4 mt-4">
              <div className="space-y-4">
                {webhooks && webhooks.length > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg text-sm bg-green-50 border border-green-200 text-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="font-medium">Webhook Configured ({webhooks.length})</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="modelId">Select Trello Board *</Label>
                    <TrelloBoardSelector
                      value={modelId}
                      onSelect={(boardId, boardName) => {
                        setModelId(boardId);
                        if (!description) {
                          setDescription(`Chatbot for ${boardName}`);
                        }
                      }}
                      placeholder="Search and select a board..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Select a board from your Trello account. The list is automatically fetched.
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
                    disabled={registering}
                    className="w-full"
                  >
                    {registering ? 'Registering...' : 'Register Webhook'}
                  </Button>
                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="font-semibold mb-3">Bulk Registration</h3>
                  <BulkBoardSelector
                    onRegister={async (selectedBoardIds) => {
                      try {
                        const response = await fetch('/api/trello-webhook/bulk', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            boardIds: selectedBoardIds,
                            callbackUrl: webhookStatus?.callbackUrl,
                          }),
                        });
                        if (!response.ok) throw new Error('Bulk registration failed');
                        const result = await response.json();
                        console.log('Bulk registration result:', result);
                        await loadWebhooks();
                        alert(`Successfully registered ${result.summary.successful} board(s)`);
                      } catch (error) {
                        console.error('Bulk registration error:', error);
                        throw error;
                      }
                    }}
                    isRegistering={registering}
                  />
                </div>

                {webhooks.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Registered Webhooks
                    </h3>
                    <div className="space-y-2">
                      {webhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                        >
                          <div>
                            <p className="font-medium text-sm">{webhook.modelId}</p>
                            <p className="text-xs text-gray-500">
                              {webhook.isActive ? 'Active' : 'Inactive'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteWebhook(webhook.trelloWebhookId)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Labels Tab */}
            <TabsContent value="labels" className="space-y-4 mt-4">
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600">Label management coming soon</p>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-4 mt-4">
              {loadingAnalytics ? (
                <div className="p-4 text-center text-gray-500">Loading analytics...</div>
              ) : analytics ? (
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total Conversations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{analytics.totalConversations}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Avg Response Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{analytics.avgResponseTimeMs}ms</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Active Cards</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{analytics.activeCards}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Active Workers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{analytics.activeWorkers}</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">No analytics data available</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
