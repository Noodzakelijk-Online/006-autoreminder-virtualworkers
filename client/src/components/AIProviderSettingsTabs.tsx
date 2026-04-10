import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AISettings } from './AISettings';
import { TrelloChatbotSettings } from './TrelloChatbotSettings';
import { PerformanceMetrics } from './PerformanceMetrics';
import { Zap, MessageSquare, Activity } from 'lucide-react';

export function AIProviderSettingsTabs() {
  const [activeTab, setActiveTab] = useState('ai-models');

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          AI Provider Settings
        </CardTitle>
        <CardDescription>
          Configure AI models, Trello integration, and monitor performance metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai-models" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">AI & Models</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="trello-chatbot" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Trello Chatbot</span>
              <span className="sm:hidden">Chatbot</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
              <span className="sm:hidden">Perf</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-models" className="space-y-4 mt-6">
            <div className="space-y-4">
              <AISettings />
            </div>
          </TabsContent>

          <TabsContent value="trello-chatbot" className="space-y-4 mt-6">
            <div className="space-y-4">
              <TrelloChatbotSettings />
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4 mt-6">
            <div className="space-y-4">
              <PerformanceMetrics />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
