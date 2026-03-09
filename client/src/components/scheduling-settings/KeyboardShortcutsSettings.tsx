import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, RotateCcw, Loader2 } from 'lucide-react';
import { useKeyboardShortcuts } from '@/hooks/useSettings';
import { useDebounce } from '@/hooks/useDebounce';
import { AutoSaveIndicator, type AutoSaveStatus } from './AutoSaveIndicator';

export interface KeyboardShortcut {
  action: string;
  keys: string;
  description: string;
  category: 'navigation' | 'scheduling' | 'batch' | 'general';
  isCustom?: boolean;
}

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
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

interface KeyboardShortcutsSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsSettings({
  open,
  onOpenChange,
}: KeyboardShortcutsSettingsProps) {
  const { shortcuts: savedShortcuts, isLoading, isSaving, save } = useKeyboardShortcuts();
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(DEFAULT_SHORTCUTS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [editingKeys, setEditingKeys] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const debouncedShortcuts = useDebounce(shortcuts, 500);

  useEffect(() => {
    if (savedShortcuts && Array.isArray(savedShortcuts)) {
      setShortcuts(savedShortcuts);
    }
  }, [savedShortcuts, open]);

  // Auto-save on debounced shortcuts changes
  useEffect(() => {
    if (!open || editingAction) return; // Don't auto-save when dialog is closed or editing

    const autoSave = async () => {
      try {
        setAutoSaveStatus('saving');
        await save(debouncedShortcuts);
        setAutoSaveStatus('saved');
        // Reset to idle after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Failed to auto-save keyboard shortcuts:', error);
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      }
    };

    autoSave();
  }, [debouncedShortcuts, open, editingAction, save]);

  const handleSave = async () => {
    try {
      await save(shortcuts);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save keyboard shortcuts:', error);
    }
  };

  const handleReset = () => {
    setShortcuts(DEFAULT_SHORTCUTS);
  };

  const handleEditShortcut = (action: string, currentKeys: string) => {
    setEditingAction(action);
    setEditingKeys(currentKeys);
  };

  const handleSaveShortcut = () => {
    if (editingAction && editingKeys) {
      setShortcuts(shortcuts.map(s =>
        s.action === editingAction ? { ...s, keys: editingKeys } : s
      ));
      setEditingAction(null);
      setEditingKeys('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Customize keyboard shortcuts for common actions
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <Tabs defaultValue="navigation" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="navigation">Navigation</TabsTrigger>
                <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
                <TabsTrigger value="batch">Batch</TabsTrigger>
                <TabsTrigger value="general">General</TabsTrigger>
              </TabsList>

              {['navigation', 'scheduling', 'batch', 'general'].map(category => (
                <TabsContent key={category} value={category} className="space-y-4">
                  {shortcuts
                    .filter(s => s.category === category)
                    .map(shortcut => (
                      <Card key={shortcut.action}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{shortcut.description}</p>
                              <p className="text-sm text-muted-foreground">{shortcut.action}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <kbd className="px-3 py-1 bg-secondary border rounded text-sm font-mono">
                                {shortcut.keys}
                              </kbd>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditShortcut(shortcut.action, shortcut.keys)}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </TabsContent>
              ))}
            </Tabs>

            {editingAction && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle className="text-base">Edit Shortcut</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>New Keyboard Shortcut</Label>
                    <Input
                      value={editingKeys}
                      onChange={(e) => setEditingKeys(e.target.value)}
                      placeholder="e.g., Ctrl+Shift+S"
                      className="mt-2"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveShortcut}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAction(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2 justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <div className="flex items-center gap-4">
            <AutoSaveIndicator status={autoSaveStatus} />
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
