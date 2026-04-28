import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TrelloChatbotSettings from './TrelloChatbotSettings';
import { NotificationSettings } from './NotificationSettings';
import { AISettings } from './AISettings';

export function IntegrationAutomationSection() {
  const [activeTab, setActiveTab] = useState('trello');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trello">Trello Chatbot</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="ai">AI & Models</TabsTrigger>
            </TabsList>

            <TabsContent value="trello" className="space-y-4 mt-4">
              <TrelloChatbotSettings />
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4 mt-4">
              <NotificationSettings />
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 mt-4">
              <AISettings />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
