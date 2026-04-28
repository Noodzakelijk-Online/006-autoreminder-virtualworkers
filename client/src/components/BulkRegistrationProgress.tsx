import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RegistrationResult {
  boardId: string;
  success: boolean;
  webhookId?: string;
  error?: string;
}

interface BulkRegistrationProgressProps {
  results: RegistrationResult[];
  isProcessing: boolean;
  /** Map of boardId → board name for display */
  boardNames?: Record<string, string>;
  summary?: {
    total: number;
    successful: number;
    failed: number;
  };
  /** Called with the IDs of boards that failed, so the parent can retry them */
  onRetryFailed?: (failedBoardIds: string[]) => void;
}

export function BulkRegistrationProgress({
  results,
  isProcessing,
  boardNames = {},
  summary,
  onRetryFailed,
}: BulkRegistrationProgressProps) {
  if (results.length === 0 && !isProcessing) {
    return null;
  }

  const total = summary?.total ?? results.length;
  const successful = summary?.successful ?? results.filter(r => r.success).length;
  const failed = summary?.failed ?? results.filter(r => !r.success).length;

  const failedResults = results.filter(r => !r.success);

  const getBoardLabel = (boardId: string) =>
    boardNames[boardId] ? `${boardNames[boardId]}` : boardId;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Registration Results</CardTitle>
        <CardDescription>
          {isProcessing ? 'Registering boards with Trello...' : 'Registration complete'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats — replaces the misleading progress bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
            <div className="text-2xl font-bold text-blue-600">{total}</div>
            <div className="text-xs text-blue-700 mt-0.5">Total</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
            <div className="text-2xl font-bold text-green-600">{successful}</div>
            <div className="text-xs text-green-700 mt-0.5">Successful</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
            <div className="text-2xl font-bold text-red-600">{failed}</div>
            <div className="text-xs text-red-700 mt-0.5">Failed</div>
          </div>
        </div>

        {/* Results List — shows board names, not raw IDs */}
        {results.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
            {results.map((result) => (
              <div
                key={result.boardId}
                className={`flex items-start gap-3 p-2 rounded ${
                  result.success ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  {/* Show board name prominently; show raw ID as secondary info */}
                  <div className="font-medium text-sm text-gray-900">
                    {getBoardLabel(result.boardId)}
                  </div>
                  {boardNames[result.boardId] && (
                    <div className="text-xs text-gray-400">{result.boardId}</div>
                  )}
                  {result.error && (
                    <div className="text-xs text-red-700 mt-1">{result.error}</div>
                  )}
                  {result.webhookId && (
                    <div className="text-xs text-green-700 mt-1">
                      Webhook: {result.webhookId.substring(0, 12)}…
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Retry Failed button — only shown when there are failures and we're not processing */}
        {!isProcessing && failedResults.length > 0 && onRetryFailed && (
          <Button
            variant="outline"
            className="w-full flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => onRetryFailed(failedResults.map(r => r.boardId))}
          >
            <RefreshCw className="h-4 w-4" />
            Retry {failedResults.length} Failed Board{failedResults.length !== 1 ? 's' : ''}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
