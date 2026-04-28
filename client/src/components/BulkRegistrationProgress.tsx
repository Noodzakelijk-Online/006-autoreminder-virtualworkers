import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface RegistrationResult {
  boardId: string;
  success: boolean;
  webhookId?: string;
  error?: string;
}

interface BulkRegistrationProgressProps {
  results: RegistrationResult[];
  isProcessing: boolean;
  summary?: {
    total: number;
    successful: number;
    failed: number;
  };
}

export function BulkRegistrationProgress({
  results,
  isProcessing,
  summary,
}: BulkRegistrationProgressProps) {
  const [displayResults, setDisplayResults] = useState<RegistrationResult[]>([]);

  useEffect(() => {
    setDisplayResults(results);
  }, [results]);

  if (displayResults.length === 0 && !isProcessing) {
    return null;
  }

  const total = summary?.total || displayResults.length;
  const successful = summary?.successful || displayResults.filter(r => r.success).length;
  const failed = summary?.failed || displayResults.filter(r => !r.success).length;
  const progress = total > 0 ? (displayResults.length / total) * 100 : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Bulk Registration Progress</CardTitle>
        <CardDescription>
          {isProcessing ? 'Processing boards...' : 'Registration complete'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className="text-gray-600">
              {displayResults.length} of {total} boards
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{total}</div>
            <div className="text-xs text-blue-700">Total</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{successful}</div>
            <div className="text-xs text-green-700">Successful</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-600">{failed}</div>
            <div className="text-xs text-red-700">Failed</div>
          </div>
        </div>

        {/* Results List */}
        {displayResults.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
            {displayResults.map((result) => (
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
                  <div className="font-medium text-sm text-gray-900">{result.boardId}</div>
                  {result.error && (
                    <div className="text-xs text-red-700 mt-1">{result.error}</div>
                  )}
                  {result.webhookId && (
                    <div className="text-xs text-green-700 mt-1">
                      Webhook ID: {result.webhookId.substring(0, 12)}...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Clock className="h-4 w-4 text-blue-600 animate-spin" />
            <span className="text-sm text-blue-700">Processing remaining boards...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
