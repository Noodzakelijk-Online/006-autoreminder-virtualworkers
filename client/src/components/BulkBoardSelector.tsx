import { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Board {
  id: string;
  name: string;
  url: string;
}

interface BulkBoardSelectorProps {
  onRegister: (selectedBoardIds: string[]) => Promise<void>;
  isRegistering?: boolean;
}

export function BulkBoardSelector({ onRegister, isRegistering = false }: BulkBoardSelectorProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  // Fetch boards on component mount
  useEffect(() => {
    const fetchBoards = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/trello-boards');
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch boards');
        }
        const data = await response.json();
        setBoards(data.boards || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch Trello boards';
        setError(message);
        console.error('[BulkBoardSelector] Error:', message);
      } finally {
        setLoading(false);
      }
    };

    fetchBoards();
  }, []);

  // Filter boards based on search term
  const filteredBoards = boards.filter(board =>
    board.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle individual board selection
  const handleBoardToggle = (boardId: string) => {
    const newSelected = new Set(selectedBoardIds);
    if (newSelected.has(boardId)) {
      newSelected.delete(boardId);
      setError(null);
    } else {
      if (newSelected.size >= 50) {
        setError('Maximum 50 boards can be selected at once. Please register in batches.');
        return;
      }
      newSelected.add(boardId);
      setError(null);
    }
    setSelectedBoardIds(newSelected);
    setSelectAll(newSelected.size === filteredBoards.length && filteredBoards.length > 0);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedBoardIds(new Set());
      setSelectAll(false);
      setError(null);
    } else {
      const allIds = new Set(filteredBoards.map(b => b.id));
      if (allIds.size > 50) {
        setError(`Only 50 boards can be selected at once. You have ${filteredBoards.length} boards. Please select up to 50 and register in batches.`);
        setSelectAll(false);
        return;
      }
      setSelectedBoardIds(allIds);
      setSelectAll(true);
      setError(null);
    }
  };

  // Handle registration
  const handleRegister = async () => {
    if (selectedBoardIds.size === 0) {
      setError('Please select at least one board');
      return;
    }

    try {
      await onRegister(Array.from(selectedBoardIds));
      setSelectedBoardIds(new Set());
      setSelectAll(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register boards';
      setError(message);
    }
  };

  return (
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
          <Label htmlFor="search">Search Boards</Label>
          <Input
            id="search"
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
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">{error}</p>
            </div>
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
                filteredBoards.map(board => (
                  <div key={board.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded">
                    <Checkbox
                      id={`board-${board.id}`}
                      checked={selectedBoardIds.has(board.id)}
                      onCheckedChange={() => handleBoardToggle(board.id)}
                      disabled={isRegistering}
                    />
                    <Label htmlFor={`board-${board.id}`} className="flex-1 cursor-pointer">
                      <div className="font-medium text-sm">{board.name}</div>
                      <div className="text-xs text-gray-500 truncate">{board.url}</div>
                    </Label>
                    {selectedBoardIds.has(board.id) && (
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                ))
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
            {selectedBoardIds.size >= 45 && (
              <span className="text-xs text-blue-700">Approaching limit (50 max)</span>
            )}
          </div>
        )}

        {/* Registration Button */}
        <Button
          onClick={handleRegister}
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
        </p>
      </CardContent>
    </Card>
  );
}
