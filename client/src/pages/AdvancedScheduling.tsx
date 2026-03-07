import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Calendar, 
  Zap,
  HelpCircle,
  Settings,
  Play,
  RotateCcw
} from 'lucide-react';
import { AdvancedSchedulingCalendar } from '@/components/AdvancedSchedulingCalendar';
import { BatchOperationsQueue } from '@/components/BatchOperationsQueue';
import { useBatchOperations } from '@/hooks/useBatchOperations';
import { getBatchOperationsClient } from '@/lib/batch-operations-client';
import { ConflictDetectionSettings, type ConflictDetectionConfig } from '@/components/scheduling-settings/ConflictDetectionSettings';
import { BatchOperationDefaults, type BatchOperationDefaultsConfig } from '@/components/scheduling-settings/BatchOperationDefaults';
import { KeyboardShortcutsSettings, type KeyboardShortcut } from '@/components/scheduling-settings/KeyboardShortcutsSettings';
import { PerformanceMetrics } from '@/components/scheduling-settings/PerformanceMetrics';

const DEFAULT_SHORTCUTS: (KeyboardShortcut & { isCustom?: boolean })[] = [
  // Navigation
  { action: 'focus-calendar', keys: 'Ctrl+1', description: 'Focus calendar view', category: 'navigation' },
  { action: 'focus-queue', keys: 'Ctrl+2', description: 'Focus batch operations queue', category: 'navigation' },
  { action: 'focus-shortcuts', keys: 'Ctrl+?', description: 'Show keyboard shortcuts', category: 'navigation' },

  // Scheduling
  { action: 'reschedule-task', keys: 'Ctrl+R', description: 'Reschedule selected task', category: 'scheduling' },
  { action: 'undo-reschedule', keys: 'Ctrl+Z', description: 'Undo last reschedule', category: 'scheduling' },
  { action: 'view-history', keys: 'Ctrl+H', description: 'View schedule history', category: 'scheduling' },
  { action: 'next-day', keys: 'Right Arrow', description: 'Move to next day', category: 'scheduling' },
  { action: 'prev-day', keys: 'Left Arrow', description: 'Move to previous day', category: 'scheduling' },

  // Batch Operations
  { action: 'start-batch', keys: 'Ctrl+B', description: 'Start batch operation', category: 'batch' },
  { action: 'cancel-batch', keys: 'Ctrl+X', description: 'Cancel running batch', category: 'batch' },
  { action: 'batch-reanalyze', keys: 'Ctrl+Shift+R', description: 'Batch re-analyze tasks', category: 'batch' },
  { action: 'batch-reschedule', keys: 'Ctrl+Shift+S', description: 'Batch reschedule tasks', category: 'batch' },

  // General
  { action: 'refresh', keys: 'F5', description: 'Refresh all data', category: 'general' },
  { action: 'settings', keys: 'Ctrl+,', description: 'Open settings', category: 'general' },
];

export default function AdvancedScheduling() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(DEFAULT_SHORTCUTS);
  const [isLoadingShortcuts, setIsLoadingShortcuts] = useState(false);
  const [showConflictSettings, setShowConflictSettings] = useState(false);
  const [showBatchDefaults, setShowBatchDefaults] = useState(false);
  const [showKeyboardSettings, setShowKeyboardSettings] = useState(false);
  const [showPerformanceMetrics, setShowPerformanceMetrics] = useState(false);

  const {
    operations,
    isLoading: isLoadingOps,
    error: opsError,
    startBatchOperation,
    cancelBatchOperation,
    loadOperations,
  } = useBatchOperations({ autoLoad: true, pollInterval: 5000 });

  const client = getBatchOperationsClient();

  // Load keyboard shortcuts
  const loadShortcuts = useCallback(async () => {
    try {
      setIsLoadingShortcuts(true);
      const loaded = await client.getKeyboardShortcuts();
      // Merge loaded shortcuts with defaults
      const merged = DEFAULT_SHORTCUTS.map(def => ({
        ...def,
        keys: loaded[def.action] || def.keys,
      }));
      setShortcuts(merged);
    } catch (err) {
      console.error('Failed to load shortcuts:', err);
      // Keep defaults on error
    } finally {
      setIsLoadingShortcuts(false);
    }
  }, [client]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;

      // Find matching shortcut
      const shortcut = shortcuts.find(s => s.keys === key);
      if (!shortcut) return;

      e.preventDefault();

      switch (shortcut.action) {
        case 'focus-calendar':
          setActiveTab('calendar');
          break;
        case 'focus-queue':
          setActiveTab('queue');
          break;
        case 'focus-shortcuts':
          setShowShortcutsHelp(!showShortcutsHelp);
          break;
        case 'refresh':
          loadOperations();
          break;
        default:
          console.log('Shortcut triggered:', shortcut.action);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, showShortcutsHelp, loadOperations]);

  const runningOps = operations.filter(op => op.status === 'running');
  const pendingOps = operations.filter(op => op.status === 'pending');

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Advanced Scheduling</h1>
            <p className="text-muted-foreground">
              Manage task schedules with drag-and-drop calendar and batch operations
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              title="Keyboard shortcuts (Ctrl+?)"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={loadOperations}
              disabled={isLoadingOps}
            >
              {isLoadingOps ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex gap-4">
          {runningOps.length > 0 && (
            <Badge variant="default" className="bg-green-600">
              <Zap className="h-3 w-3 mr-1" />
              {runningOps.length} Running
            </Badge>
          )}
          {pendingOps.length > 0 && (
            <Badge variant="secondary">
              <Calendar className="h-3 w-3 mr-1" />
              {pendingOps.length} Pending
            </Badge>
          )}
          {opsError && (
            <Badge variant="destructive">
              Error: {opsError.message}
            </Badge>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      {showShortcutsHelp && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-lg">Keyboard Shortcuts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['navigation', 'scheduling', 'batch', 'general'].map(category => (
                <div key={category}>
                  <h3 className="font-semibold mb-3 capitalize">{category}</h3>
                  <div className="space-y-2">
                    {shortcuts
                      .filter(s => s.category === category)
                      .map(s => (
                        <div key={s.action} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{s.description}</span>
                          <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">
                            {s.keys}
                          </kbd>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Batch Queue
            {runningOps.length > 0 && (
              <Badge variant="default" className="ml-2 text-xs">
                {runningOps.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <AdvancedSchedulingCalendar 
            tasks={[]} 
            onTaskReschedule={async () => {}} 
            onUndo={async () => {}}
          />
        </TabsContent>

        {/* Batch Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          <BatchOperationsQueue
            operations={operations as any}
            onCancel={cancelBatchOperation}
            isLoading={isLoadingOps}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduling Settings</CardTitle>
              <CardDescription>Configure advanced scheduling options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Conflict Detection */}
              <div className="space-y-2">
                <h3 className="font-semibold">Conflict Detection</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically detect and warn about scheduling conflicts
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowConflictSettings(true)}
                >
                  Configure
                </Button>
              </div>

              {/* Batch Operation Defaults */}
              <div className="space-y-2">
                <h3 className="font-semibold">Batch Operation Defaults</h3>
                <p className="text-sm text-muted-foreground">
                  Set default options for batch operations
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowBatchDefaults(true)}
                >
                  Configure
                </Button>
              </div>

              {/* Keyboard Shortcuts */}
              <div className="space-y-2">
                <h3 className="font-semibold">Keyboard Shortcuts</h3>
                <p className="text-sm text-muted-foreground">
                  Customize keyboard shortcuts for common actions
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowKeyboardSettings(true)}
                >
                  Customize Shortcuts
                </Button>
              </div>

              {/* Performance Metrics */}
              <div className="space-y-2">
                <h3 className="font-semibold">Performance Metrics</h3>
                <p className="text-sm text-muted-foreground">
                  View scheduling performance and optimization suggestions
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowPerformanceMetrics(true)}
                >
                  View Metrics
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialogs */}
      <ConflictDetectionSettings
        open={showConflictSettings}
        onOpenChange={setShowConflictSettings}
      />

      <BatchOperationDefaults
        open={showBatchDefaults}
        onOpenChange={setShowBatchDefaults}
        onSave={async (config: BatchOperationDefaultsConfig) => {
          console.log('Batch operation defaults saved:', config);
        }}
      />

      <KeyboardShortcutsSettings
        open={showKeyboardSettings}
        onOpenChange={setShowKeyboardSettings}
        onSave={async (shortcuts: KeyboardShortcut[]) => {
          setShortcuts(shortcuts);
          console.log('Keyboard shortcuts saved:', shortcuts);
        }}
      />

      <PerformanceMetrics
        open={showPerformanceMetrics}
        onOpenChange={setShowPerformanceMetrics}
        onExport={async () => {
          console.log('Exporting performance metrics');
        }}
      />
    </div>
  );
}
