import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Board {
  id: string;
  name: string;
  url: string;
}

interface TrelloBoardSelectorProps {
  value?: string;
  onSelect: (boardId: string, boardName: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TrelloBoardSelector({
  value,
  onSelect,
  placeholder = 'Select a Trello board...',
  disabled = false,
}: TrelloBoardSelectorProps) {
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);

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
        console.error('[TrelloBoardSelector] Error:', message);
      } finally {
        setLoading(false);
      }
    };

    fetchBoards();
  }, []);

  // Update selected board when value changes
  useEffect(() => {
    if (value) {
      const board = boards.find(b => b.id === value);
      setSelectedBoard(board || null);
    }
  }, [value, boards]);

  const handleSelect = (board: Board) => {
    setSelectedBoard(board);
    onSelect(board.id, board.name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading boards...
            </>
          ) : selectedBoard ? (
            <>
              <span className="truncate">{selectedBoard.name}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          ) : (
            <>
              <span className="text-muted-foreground">{placeholder}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search boards..." />
          <CommandEmpty>
            {error ? (
              <div className="p-4 text-sm text-destructive">
                <p className="font-semibold mb-1">Error loading boards:</p>
                <p>{error}</p>
                <p className="text-xs mt-2 text-muted-foreground">
                  Make sure your Trello API credentials are configured correctly.
                </p>
              </div>
            ) : (
              'No boards found.'
            )}
          </CommandEmpty>
          <CommandList>
            <CommandGroup>
              {boards.map(board => (
                <CommandItem
                  key={board.id}
                  value={board.id}
                  onSelect={() => handleSelect(board)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedBoard?.id === board.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{board.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {board.url}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
