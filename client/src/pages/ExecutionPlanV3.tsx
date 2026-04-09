import { useState } from 'react';
import { ExecutionPlanDashboardV3 } from '@/components/ExecutionPlanDashboardV3';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function ExecutionPlanV3Page() {
  const [planId, setPlanId] = useState<string | null>(null);
  const [cardId, setCardId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch plan from Trello
  const fetchPlanMutation = trpc.executionPlan.fetchFromTrello.useMutation();

  // Generate plan via AI
  const generatePlanMutation = trpc.executionPlan.generateFromCard.useMutation();

  // Get plan by card ID
  const getByCardIdQuery = trpc.executionPlan.getByCardId.useQuery(
    { cardId: cardId || '' },
    { enabled: !!cardId && !planId, staleTime: 30000 }
  );

  const handleFetchPlan = async () => {
    if (!cardId) {
      setError('Please enter a Trello card ID');
      return;
    }

    try {
      setError(null);
      setIsGenerating(true);

      const result = await fetchPlanMutation.mutateAsync({ cardId });

      if (result.success && result.planId) {
        setPlanId(result.planId);
      } else {
        setError(result.error || 'Failed to fetch execution plan');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!cardId) {
      setError('Please enter a Trello card ID');
      return;
    }

    try {
      setError(null);
      setIsGenerating(true);

      // TODO: Fetch card details from Trello first
      const result = await generatePlanMutation.mutateAsync({
        cardId,
        cardTitle: 'Trello Card',
        cardDescription: 'Card description'
      });

      if (result.success && result.planId) {
        setPlanId(result.planId);
      } else {
        setError(result.error || 'Failed to generate execution plan');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // If plan is loaded, show dashboard
  if (planId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <ExecutionPlanDashboardV3
            planId={planId}
            onClose={() => {
              setPlanId(null);
              setCardId('');
            }}
          />
        </div>
      </div>
    );
  }

  // Show plan selector
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Execution Plan Dashboard</h1>
          <p className="text-muted-foreground">
            Load or generate an execution plan from a Trello card
          </p>
        </div>

        {error && (
          <Card className="p-4 bg-destructive/10 border-destructive/50 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Error</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </Card>
        )}

        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Trello Card ID</label>
            <Input
              placeholder="Enter Trello card ID (e.g., 507f1f77bcf86cd799439011)"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              You can find the card ID in the URL: trello.com/c/[CARD_ID]/...
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleFetchPlan}
              disabled={!cardId || isGenerating}
              className="flex-1 gap-2"
            >
              {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
              Fetch Existing Plan
            </Button>
            <Button
              onClick={handleGeneratePlan}
              disabled={!cardId || isGenerating}
              variant="outline"
              className="flex-1 gap-2"
            >
              {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate with AI
            </Button>
          </div>
        </Card>

        {/* Info Cards */}
        <div className="grid gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Fetch Existing Plan</h3>
            <p className="text-sm text-muted-foreground">
              Load an execution plan that's already embedded in a Trello card description as JSON.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Generate with AI</h3>
            <p className="text-sm text-muted-foreground">
              Automatically generate a detailed execution plan from the card description using AI.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
