import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface LabelAutocompleteSearchProps {
  value: string;
  onChange: (value: string) => void;
  allLabels: string[];
  placeholder?: string;
}

export function LabelAutocompleteSearch({
  value,
  onChange,
  allLabels,
  placeholder = 'Search tasks or labels...',
}: LabelAutocompleteSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredLabels, setFilteredLabels] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter labels based on input
  useEffect(() => {
    if (value.trim() === '') {
      setFilteredLabels([]);
      setIsOpen(false);
      return;
    }

    const query = value.toLowerCase();
    
    // Sort: exact matches first, then partial matches
    const exactMatches = allLabels.filter(label => label.toLowerCase() === query);
    const partialMatches = allLabels.filter(
      label => label.toLowerCase().includes(query) && label.toLowerCase() !== query
    );
    
    setFilteredLabels([...exactMatches, ...partialMatches]);
    setHighlightedIndex(-1);
    setIsOpen(true);
  }, [value, allLabels]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredLabels.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredLabels.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredLabels.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelectLabel(filteredLabels[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Handle label selection
  const handleSelectLabel = (label: string) => {
    onChange(label);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.trim() !== '' && filteredLabels.length > 0 && setIsOpen(true)}
          className="pl-10 pr-8"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown suggestions */}
      {isOpen && filteredLabels.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          {filteredLabels.map((label, index) => (
            <button
              key={label}
              onClick={() => handleSelectLabel(label)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors ${
                index === highlightedIndex ? 'bg-accent' : ''
              }`}
            >
              <Badge variant="secondary" className="text-xs">
                {label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {allLabels.filter(l => l.toLowerCase() === label.toLowerCase()).length} task(s)
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && value.trim() !== '' && filteredLabels.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-md shadow-lg z-50 px-3 py-2 text-sm text-muted-foreground">
          No labels match "{value}"
        </div>
      )}
    </div>
  );
}
