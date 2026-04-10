import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Info,
  Sparkles,
  Globe
} from 'lucide-react';

type AIProvider = 'groq' | 'together' | 'openrouter' | 'ollama';

interface AIModel {
  id: string;
  name: string;
  description: string;
  released: string;
  tier?: 'fast' | 'quality'; // For ExecutionPlan two-tier validation
}

interface AIConfig {
  provider: AIProvider;
  model: string;
  groqApiKey: string | null;
  togetherApiKey: string | null;
  openrouterApiKey: string | null;
  ollamaUrl: string;
}

// Available models per provider (Apr 2026)
// Tier classification for ExecutionPlan: 'fast' for initial analysis, 'quality' for fact-checking
const AVAILABLE_MODELS: Record<AIProvider, AIModel[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Latest Meta model, excellent all-around', released: 'Dec 2024', tier: 'quality' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fast, lightweight model - ideal for initial analysis', released: 'Jul 2024', tier: 'fast' },
    { id: 'qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Strong multilingual support', released: 'Nov 2024', tier: 'quality' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Efficient mixture of experts', released: 'Dec 2023', tier: 'fast' }
  ],
  together: [
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3.2', description: 'Matches GPT-5 performance - best for fact-checking', released: 'Dec 2025', tier: 'quality' },
    { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', description: 'Advanced reasoning model', released: 'Nov 2025', tier: 'quality' },
    { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', description: 'Fast Qwen variant - good for initial analysis', released: 'Nov 2024', tier: 'fast' },
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', description: 'Optimized Llama 3.3 - best all-around', released: 'Dec 2024', tier: 'quality' }
  ],
  openrouter: [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3.2', description: 'Latest DeepSeek via OpenRouter - best for fact-checking', released: 'Dec 2025', tier: 'quality' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: "Alibaba's latest - good for initial analysis", released: 'Nov 2024', tier: 'fast' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: "Meta's latest open model - best all-around", released: 'Dec 2024', tier: 'quality' },
    { id: 'mistralai/mistral-large-2411', name: 'Mistral Large', description: "Mistral's flagship - good for initial analysis", released: 'Nov 2024', tier: 'fast' }
  ],
  ollama: [
    { id: 'qwen2.5:72b', name: 'Qwen 2.5 72B', description: 'Full Qwen 2.5 locally - best all-around', released: 'Nov 2024', tier: 'quality' },
    { id: 'qwen2.5:32b', name: 'Qwen 2.5 32B', description: 'Balanced Qwen variant - good for initial analysis', released: 'Nov 2024', tier: 'fast' },
    { id: 'llama3.3:70b', name: 'Llama 3.3 70B', description: 'Latest Llama locally - best all-around', released: 'Dec 2024', tier: 'quality' },
    { id: 'deepseek-v3:latest', name: 'DeepSeek V3', description: 'DeepSeek locally (when available) - best for fact-checking', released: 'Dec 2025', tier: 'quality' },
    { id: 'mistral:latest', name: 'Mistral', description: 'Lightweight and fast - good for initial analysis', released: '2024', tier: 'fast' }
  ]
};

const PROVIDER_INFO: Record<AIProvider, { name: string; icon: typeof Zap; color: string; badge: string; description: string; url: string }> = {
  together: {
    name: 'Together.ai',
    icon: Sparkles,
    color: 'text-purple-500',
    badge: 'DeepSeek V3.2',
    description: 'Access DeepSeek V3.2 (Dec 2025) - matches GPT-5 performance. Recommended for quality fact-checking. Free tier available.',
    url: 'https://api.together.xyz'
  },
  groq: {
    name: 'Groq',
    icon: Zap,
    color: 'text-yellow-500',
    badge: 'Fast',
    description: 'Ultra-fast inference with Llama 3.3 & Qwen 2.5. Recommended for initial analysis. Free tier available.',
    url: 'https://console.groq.com'
  },
  openrouter: {
    name: 'OpenRouter',
    icon: Globe,
    color: 'text-green-500',
    badge: 'Multi-model',
    description: 'Access multiple providers through one API. Pay-per-use pricing.',
    url: 'https://openrouter.ai'
  },
  ollama: {
    name: 'Ollama',
    icon: Server,
    color: 'text-blue-500',
    badge: 'Self-hosted',
    description: 'Run models locally on your own server. Completely free, full privacy.',
    url: 'https://ollama.ai'
  }
};

export function AISettings() {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'together',
    model: 'deepseek-ai/DeepSeek-V3',
    groqApiKey: null,
    togetherApiKey: null,
    openrouterApiKey: null,
    ollamaUrl: 'http://localhost:11434',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // API key inputs (separate from config to avoid overwriting)
  const [apiKeys, setApiKeys] = useState({
    groq: '',
    together: '',
    openrouter: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  // Update model when provider changes
  useEffect(() => {
    const models = AVAILABLE_MODELS[config.provider];
    if (models && models.length > 0 && !models.find(m => m.id === config.model)) {
      setConfig(prev => ({ ...prev, model: models[0].id }));
    }
  }, [config.provider]);

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
          model: config.model,
          groqApiKey: apiKeys.groq || undefined,
          togetherApiKey: apiKeys.together || undefined,
          openrouterApiKey: apiKeys.openrouter || undefined,
          ollamaUrl: config.ollamaUrl,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setTestResult({ success: true, message: 'Settings saved successfully!' });
        loadSettings();
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

  const currentModels = AVAILABLE_MODELS[config.provider] || [];
  const currentModel = currentModels.find(m => m.id === config.model);

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
          Configure the AI service that powers intelligent chatbot responses. Using latest Q4 2025 open-source models.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">AI Provider</Label>
          <RadioGroup
            value={config.provider}
            onValueChange={(value) => setConfig({ ...config, provider: value as AIProvider })}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((provider) => {
              const info = PROVIDER_INFO[provider];
              const Icon = info.icon;
              return (
                <div key={provider} className="relative">
                  <RadioGroupItem value={provider} id={provider} className="peer sr-only" />
                  <Label
                    htmlFor={provider}
                    className="flex flex-col items-start gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${info.color}`} />
                      <span className="font-semibold">{info.name}</span>
                      <Badge variant={provider === 'together' ? 'default' : 'secondary'} className="text-xs">
                        {info.badge}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {info.description}
                    </p>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        {/* Model Selection */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Model</Label>
          <Select
            value={config.model}
            onValueChange={(value) => setConfig({ ...config, model: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {currentModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs text-muted-foreground">({model.released})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentModel && (
            <p className="text-sm text-muted-foreground">
              {currentModel.description}
            </p>
          )}
        </div>

        {/* Provider-specific settings */}
        {config.provider === 'together' && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <Label className="font-medium">Together.ai Configuration</Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="togetherApiKey">API Key</Label>
              <Input
                id="togetherApiKey"
                type="password"
                placeholder={config.togetherApiKey ? '••••••••••••••••' : 'Enter your Together.ai API key'}
                value={apiKeys.together}
                onChange={(e) => setApiKeys({ ...apiKeys, together: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Get a free API key at{' '}
                <a 
                  href="https://api.together.xyz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  api.together.xyz
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {config.togetherApiKey && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>API Key Configured</AlertTitle>
                <AlertDescription>
                  Your Together.ai API key is saved. Enter a new key above to update it.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

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
                value={apiKeys.groq}
                onChange={(e) => setApiKeys({ ...apiKeys, groq: e.target.value })}
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

        {config.provider === 'openrouter' && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-green-500" />
              <Label className="font-medium">OpenRouter Configuration</Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="openrouterApiKey">API Key</Label>
              <Input
                id="openrouterApiKey"
                type="password"
                placeholder={config.openrouterApiKey ? '••••••••••••••••' : 'Enter your OpenRouter API key'}
                value={apiKeys.openrouter}
                onChange={(e) => setApiKeys({ ...apiKeys, openrouter: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Get an API key at{' '}
                <a 
                  href="https://openrouter.ai/keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  openrouter.ai
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {config.openrouterApiKey && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>API Key Configured</AlertTitle>
                <AlertDescription>
                  Your OpenRouter API key is saved. Enter a new key above to update it.
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
                {' '}and run <code className="bg-muted px-1 rounded">ollama pull {config.model.split(':')[0]}</code>
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
