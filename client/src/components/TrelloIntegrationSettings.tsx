/*  */import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

interface CompletionLabelConfig {
  labels: string[]; // Array of label IDs
  lastUpdated: string;
}

export function TrelloIntegrationSettings() {
  const [labels, setLabels] = useState<TrelloLabel[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available labels from Trello
  useEffect(() => {
    const fetchLabels = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/trello/labels');
        if (!response.ok) {
          throw new Error('Failed to fetch labels');
        }
        const data = await response.json();
        setLabels(data.labels || []);

        // Fetch current configuration
        const configResponse = await fetch('/api/trello/completion-labels');
        if (configResponse.ok) {
          const config: CompletionLabelConfig = await configResponse.json();
          setSelectedLabels(config.labels || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load labels');
        console.error('Error fetching Trello labels:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLabels();
  }, []);

  const handleLabelToggle = (labelId: string) => {
    setSelectedLabels(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/trello/completion-labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labels: selectedLabels,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      toast.success('Completion labels configuration saved successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration';
      toast.error(errorMessage);
      console.error('Error saving completion labels:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trello Integration</CardTitle>
        <CardDescription>
          Configure which Trello labels represent completed tasks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading labels...</span>
          </div>
        ) : labels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No labels found in your Trello board</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">Select labels that indicate task completion:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {labels.map(label => (
                <div
                  key={label.id}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleLabelToggle(label.id)}
                >
                  <Checkbox
                    id={label.id}
                    checked={selectedLabels.includes(label.id)}
                    onCheckedChange={() => handleLabelToggle(label.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{
                        backgroundColor: label.color || '#cccccc',
                        borderColor: label.color || '#999999',
                      }}
                    />
                    <label
                      htmlFor={label.id}
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {label.name}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading || labels.length === 0}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </div>

        {selectedLabels.length > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>{selectedLabels.length}</strong> label{selectedLabels.length !== 1 ? 's' : ''} selected as completion indicator{selectedLabels.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
