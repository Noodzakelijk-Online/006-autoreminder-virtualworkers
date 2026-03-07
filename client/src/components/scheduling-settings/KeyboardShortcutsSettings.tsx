import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, RotateCcw } from 'lucide-react';

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
  onSave: (shortcuts: KeyboardShortcut[]) => Promise<void>;
}

export function KeyboardShortcutsSettings({
  open,
  onOpenChange,
  onSave,
}: KeyboardShortcutsSettingsProps) {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(DEFAULT_SHORTCUTS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [editingKeys, setEditingKeys] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('keyboardShortcuts');
    if (saved) {
      try {
        setShortcuts(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse keyboard shortcuts:', e);
      }
    }
  }, [open]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(shortcuts);
      localStorage.setItem('keyboardShortcuts', JSON.stringify(shortcuts));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save keyboard shortcuts:', error);
    } finally {
      setIsSaving(false);
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
      setShortcuts(
        shortcuts.map(s =>
          s.action === editingAction ? { ...s, keys: editingKeys } : s
        )
      );
      setEditingAction(null);
      setEditingKeys('');
    }
  };

  const categories = ['navigation', 'scheduling', 'batch', 'general'] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Customize keyboard shortcuts for common actions
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="navigation" className="w-full py-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="navigation">Navigation</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
            <TabsTrigger value="batch">Batch Ops</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          {categories.map(category => (
            <TabsContent key={category} value={category} className="space-y-4">
              {shortcuts
                .filter(s => s.category === category)
                .map(shortcut => (
                  <Card key={shortcut.action}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{shortcut.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{shortcut.action}</p>
                        </div>
                        {editingAction === shortcut.action ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingKeys}
                              onChange={(e) => setEditingKeys(e.target.value)}
                              placeholder="e.g., Ctrl+K"
                              className="w-32"
                            />
                            <Button
                              size="sm"
                              onClick={handleSaveShortcut}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingAction(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <kbd className="px-3 py-1 bg-secondary border rounded text-sm font-mono">
                              {shortcut.keys}
                            </kbd>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditShortcut(shortcut.action, shortcut.keys)}
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Settings saved</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              title="Reset to default shortcuts"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Shortcuts'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
