import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BulkRegistrationProgress } from '@/components/BulkRegistrationProgress';

interface Board {
  id: string;
  name: string;
  url: string;
  isRegistered?: boolean;
}

interface RegistrationResult {
  boardId: string;
  success: boolean;
  webhookId?: string;
  error?: string;
}

interface BulkBoardSelectorProps {
  /** Called with selected board IDs when the user clicks Register */
  onRegister: (selectedBoardIds: string[], boardNames: Record<string, string>) => Promise<RegistrationResult[]>;
  isRegistering?: boolean;
  /** Set of board IDs that already have a registered webhook */
  registeredBoardIds?: Set<string>;
}

export function BulkBoardSelector({
  onRegister,
  isRegistering = false,
  registeredBoardIds = new Set(),
}: BulkBoardSelectorProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Registration results state
  const [registrationResults, setRegistrationResults] = useState<RegistrationResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Fetch boards and registered webhooks on component mount
  useEffect(() => {
    const fetchBoardsAndWebhooks = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch available boards
        const boardsResponse = await fetch('/api/trello-boards');
        if (!boardsResponse.ok) {
          const data = await boardsResponse.json();
          throw new Error(data.error || 'Failed to fetch boards');
        }
        const boardsData = await boardsResponse.json();
        
        // Fetch registered webhooks
        const webhooksResponse = await fetch('/api/trello-webhook/list');
        const webhooksData = webhooksResponse.ok ? await webhooksResponse.json() : { webhooks: [] };
        const registeredIds = new Set((webhooksData.webhooks || []).map((w: any) => w.modelId));
        
        // Mark boards that already have webhooks
        const boardsWithStatus = (boardsData.boards || []).map((board: Board) => ({
          ...board,
          isRegistered: registeredIds.has(board.id)
        }));
        setBoards(boardsWithStatus);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch Trello boards';
        setError(message);
        console.error('[BulkBoardSelector] Error:', message);
      } finally {
        setLoading(false);
      }
    };

    fetchBoardsAndWebhooks();
  }, []);

  // Filter boards based on search term
  const filteredBoards = useMemo(
    () => boards.filter(board => board.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [boards, searchTerm]
  );

  // Derive selectAll from current selection vs filtered list — fixes stale state on search change
  const selectAll = useMemo(
    () =>
      filteredBoards.length > 0 &&
      filteredBoards.every(b => selectedBoardIds.has(b.id)),
    [filteredBoards, selectedBoardIds]
  );

  // Build a boardId → name map for the current board list
  const boardNameMap = useMemo(
    () => Object.fromEntries(boards.map(b => [b.id, b.name])),
    [boards]
  );

  // Batch size matches the server-side limit
  const BATCH_SIZE = 50;

  // Handle individual board selection — no upper limit, auto-batching handles large sets
  const handleBoardToggle = (boardId: string) => {
    const newSelected = new Set(selectedBoardIds);
    if (newSelected.has(boardId)) {
      newSelected.delete(boardId);
    } else {
      newSelected.add(boardId);
    }
    setError(null);
    setSelectedBoardIds(newSelected);
  };

  // Handle select all (scoped to filtered list)
  const handleSelectAll = () => {
    if (selectAll) {
      // Deselect only the currently filtered boards
      const newSelected = new Set(selectedBoardIds);
      filteredBoards.forEach(b => newSelected.delete(b.id));
      setSelectedBoardIds(newSelected);
    } else {
      const combined = new Set([...Array.from(selectedBoardIds), ...filteredBoards.map(b => b.id)]);
      setSelectedBoardIds(combined);
    }
    setError(null);
  };

  // Split an array into chunks of at most `size`
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  // Handle registration — automatically batches >50 boards into sequential requests
  const handleRegister = async (boardIds?: string[]) => {
    const ids = boardIds ?? Array.from(selectedBoardIds);
    if (ids.length === 0) {
      setError('Please select at least one board');
      return;
    }

    setShowResults(true);
    setRegistrationResults([]);

    try {
      const batches = chunkArray(ids, BATCH_SIZE);
      const allResults: RegistrationResult[] = [];

      for (const batch of batches) {
        const batchResults = await onRegister(batch, boardNameMap);
        allResults.push(...batchResults);
        // Show incremental progress as each batch completes
        setRegistrationResults([...allResults]);
      }

      // Clear selection after a successful (even partial) run
      if (!boardIds) {
        setSelectedBoardIds(new Set());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register boards';
      setError(message);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Register Multiple Boards</CardTitle>
          <CardDescription>
            Select multiple Trello boards to register webhooks for all of them at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div>
            <Label htmlFor="bulk-search">Search Boards</Label>
            <Input
              id="bulk-search"
              placeholder="Search by board name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading || isRegistering}
              className="mt-1"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-900">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-600">Loading boards...</span>
            </div>
          )}

          {/* Boards List */}
          {!loading && boards.length > 0 && (
            <div className="space-y-3">
              {/* Select All */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                  disabled={isRegistering || filteredBoards.length === 0}
                />
                <Label htmlFor="select-all" className="flex-1 cursor-pointer font-medium">
                  Select All ({selectedBoardIds.size}/{filteredBoards.length})
                </Label>
              </div>

              {/* Individual Boards */}
              <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-md p-3">
                {filteredBoards.length > 0 ? (
                  filteredBoards.map(board => {
                    const isRegistered = registeredBoardIds.has(board.id);
                    const isSelected = selectedBoardIds.has(board.id);
                    return (
                      <div
                        key={board.id}
                        className={`flex items-start gap-3 p-2 rounded transition-colors ${
                          isRegistered
                            ? 'bg-green-50 opacity-75'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          id={`board-${board.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleBoardToggle(board.id)}
                          disabled={isRegistering || isRegistered}
                        />
                        <Label
                          htmlFor={`board-${board.id}`}
                          className={`flex-1 ${isRegistered ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{board.name}</span>
                            {/* Already-registered badge */}
                            {isRegistered && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                <CheckCircle2 className="h-3 w-3" />
                                Registered
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{board.url}</div>
                        </Label>
                        {isSelected && !isRegistered && (
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No boards match your search
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && boards.length === 0 && !error && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No boards available</p>
            </div>
          )}

          {/* Selection Count */}
          {selectedBoardIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
              <span className="text-sm font-medium text-blue-900">
                {selectedBoardIds.size} board{selectedBoardIds.size !== 1 ? 's' : ''} selected
              </span>
              {selectedBoardIds.size > 50 && (
                <span className="text-xs text-blue-700">
                  Will register in {Math.ceil(selectedBoardIds.size / 50)} batches of 50
                </span>
              )}
            </div>
          )}

          {/* Registration Button */}
          <Button
            onClick={() => handleRegister()}
            disabled={isRegistering || selectedBoardIds.size === 0 || loading}
            className="w-full"
          >
            {isRegistering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering {selectedBoardIds.size} Board{selectedBoardIds.size !== 1 ? 's' : ''}...
              </>
            ) : (
              `Register ${selectedBoardIds.size} Board${selectedBoardIds.size !== 1 ? 's' : ''}`
            )}
          </Button>

          {/* Info Text */}
          <p className="text-xs text-gray-500 text-center">
            Selected: {selectedBoardIds.size} of {filteredBoards.length} board{filteredBoards.length !== 1 ? 's' : ''}
            {registeredBoardIds.size > 0 && (
              <span className="ml-1 text-green-600">
                · {registeredBoardIds.size} already registered
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Results panel — shown after a registration attempt */}
      {showResults && (
        <BulkRegistrationProgress
          results={registrationResults}
          isProcessing={isRegistering}
          boardNames={boardNameMap}
          summary={
            registrationResults.length > 0
              ? {
                  total: registrationResults.length,
                  successful: registrationResults.filter(r => r.success).length,
                  failed: registrationResults.filter(r => !r.success).length,
                }
              : undefined
          }
          onRetryFailed={(failedIds) => handleRegister(failedIds)}
        />
      )}
    </div>
  );
}
