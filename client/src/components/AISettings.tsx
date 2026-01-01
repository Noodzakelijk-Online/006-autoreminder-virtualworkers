import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Settings, 
  Zap, 
  Server, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ExternalLink,
  Info
} from 'lucide-react';

interface AIConfig {
  provider: 'groq' | 'ollama';
  groqApiKey: string | null;
  ollamaUrl: string;
  ollamaModel: string;
}

export function AISettings() {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'groq',
    groqApiKey: null,
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [groqApiKey, setGroqApiKey] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/trello-webhook/ai-settings');
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/trello-webhook/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          groqApiKey: groqApiKey || undefined,
          ollamaUrl: config.ollamaUrl,
          ollamaModel: config.ollamaModel,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setTestResult({ success: true, message: 'Settings saved successfully!' });
        loadSettings(); // Reload to get updated state
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/trello-webhook/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        setTestResult({ success: true, message: `AI responded: "${data.response}"` });
      } else {
        setTestResult({ success: false, message: data.error || 'Test failed' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to test AI connection' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle>AI Provider Settings</CardTitle>
        </div>
        <CardDescription>
          Configure the AI service that powers intelligent chatbot responses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">AI Provider</Label>
          <RadioGroup
            value={config.provider}
            onValueChange={(value) => setConfig({ ...config, provider: value as 'groq' | 'ollama' })}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Groq Option */}
            <div className="relative">
              <RadioGroupItem value="groq" id="groq" className="peer sr-only" />
              <Label
                htmlFor="groq"
                className="flex flex-col items-start gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold">Groq</span>
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Free tier available. Fast inference with Llama & Mixtral models.
                </p>
              </Label>
            </div>

            {/* Ollama Option */}
            <div className="relative">
              <RadioGroupItem value="ollama" id="ollama" className="peer sr-only" />
              <Label
                htmlFor="ollama"
                className="flex flex-col items-start gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold">Ollama</span>
                  <Badge variant="outline" className="text-xs">Self-hosted</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Run locally on your own server. Completely free, full privacy.
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Provider-specific settings */}
        {config.provider === 'groq' && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <Label className="font-medium">Groq Configuration</Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="groqApiKey">API Key</Label>
              <Input
                id="groqApiKey"
                type="password"
                placeholder={config.groqApiKey ? '••••••••••••••••' : 'Enter your Groq API key'}
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get a free API key at{' '}
                <a 
                  href="https://console.groq.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  console.groq.com
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {config.groqApiKey && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>API Key Configured</AlertTitle>
                <AlertDescription>
                  Your Groq API key is saved. Enter a new key above to update it.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {config.provider === 'ollama' && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-500" />
              <Label className="font-medium">Ollama Configuration</Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ollamaUrl">Server URL</Label>
              <Input
                id="ollamaUrl"
                placeholder="http://localhost:11434"
                value={config.ollamaUrl}
                onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ollamaModel">Model</Label>
              <Input
                id="ollamaModel"
                placeholder="llama3.2"
                value={config.ollamaModel}
                onChange={(e) => setConfig({ ...config, ollamaModel: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Recommended models: llama3.2, mistral, mixtral
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Self-hosted Setup</AlertTitle>
              <AlertDescription>
                Install Ollama from{' '}
                <a 
                  href="https://ollama.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  ollama.ai
                </a>
                {' '}and run <code className="bg-muted px-1 rounded">ollama pull llama3.2</code>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <Alert variant={testResult.success ? 'default' : 'destructive'}>
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>{testResult.success ? 'Success' : 'Error'}</AlertTitle>
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
          <Button variant="outline" onClick={testConnection} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Bot className="mr-2 h-4 w-4" />
                Test Connection
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default AISettings;
