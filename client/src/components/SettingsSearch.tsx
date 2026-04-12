import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface SearchResult {
  section: string;
  tab: string;
  title: string;
  description?: string;
  category: 'setting' | 'tab' | 'section';
}

interface SettingsSearchProps {
  searchResults: SearchResult[];
  onSearchChange: (query: string) => void;
  onResultClick: (result: SearchResult) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSearch({
  searchResults,
  onSearchChange,
  onResultClick,
  isOpen,
  onOpenChange,
}: SettingsSearchProps) {
  const [query, setQuery] = useState('');

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    onSearchChange(value);
  }, [onSearchChange]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearchChange('');
  }, [onSearchChange]);

  const getSectionColor = (section: string) => {
    const colors: Record<string, string> = {
      'Integration & Automation': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Scheduling & Time': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Performance & Monitoring': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return colors[section] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  // Group results by section
  const groupedResults = Array.from(new Set(searchResults.map(r => r.section))).map(section => ({
    section,
    results: searchResults.filter(r => r.section === section),
  }));

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search settings, tabs, features..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => onOpenChange(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Results */}
      {isOpen && query && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {searchResults.length > 0 ? (
            <div className="p-2 space-y-3">
              {groupedResults.map(({ section, results }) => (
                <div key={section}>
                  {/* Section Header with Match Count */}
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {section}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {results.length}
                    </Badge>
                  </div>

                  {/* Results for this section */}
                  <div className="space-y-1">
                    {results.map((result, index) => (
                      <button
                        key={`${section}-${index}`}
                        onClick={() => {
                          onResultClick(result);
                          setQuery('');
                          onOpenChange(false);
                        }}
                        className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors ml-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{result.title}</p>
                            {result.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {result.description}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {result.tab}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No settings found matching "{query}"
            </div>
          )}
        </div>
      )}

      {/* Search Summary */}
      {query && searchResults.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Found <span className="font-semibold">{searchResults.length}</span> result
          {searchResults.length !== 1 ? 's' : ''} for "<span className="font-medium">{query}</span>"
        </div>
      )}
    </div>
  );
}
