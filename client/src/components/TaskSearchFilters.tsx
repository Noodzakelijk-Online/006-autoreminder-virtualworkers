import { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, ChevronDown } from 'lucide-react';

interface Task {
  id: string;
  cardName: string;
  description?: string;
  priorityLevel?: 'CRITICAL' | 'URGENT' | 'HIGH' | 'NORMAL';
  complexity?: 'simple' | 'medium' | 'complex';
  assignedToName?: string;
  date?: string;
}

interface TaskSearchFiltersProps {
  tasks: Task[];
  onFiltered: (filtered: Task[]) => void;
}

export function TaskSearchFilters({ tasks, onFiltered }: TaskSearchFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    priority: [] as string[],
    complexity: [] as string[],
    assignedWorker: [] as string[],
    dateRange: 'all' as 'all' | 'today' | 'week' | 'month',
  });

  // Get unique values for filter options
  const uniqueWorkers = useMemo(() => {
    return Array.from(new Set(tasks.map(t => t.assignedToName).filter(Boolean))) as string[];
  }, [tasks]);

  // Filter tasks based on search and filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search filter (full-text search on cardName and description)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          task.cardName.toLowerCase().includes(query) ||
          (task.description?.toLowerCase().includes(query) ?? false);
        if (!matchesSearch) return false;
      }

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(task.priorityLevel || 'NORMAL')) {
        return false;
      }

      // Assigned worker filter
      if (filters.assignedWorker.length > 0 && !filters.assignedWorker.includes(task.assignedToName || '')) {
        return false;
      }

      // Date range filter
      if (filters.dateRange !== 'all' && task.date) {
        const dueDate = new Date(task.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (filters.dateRange === 'today') {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (dueDate < today || dueDate >= tomorrow) return false;
        } else if (filters.dateRange === 'week') {
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          if (dueDate < today || dueDate >= nextWeek) return false;
        } else if (filters.dateRange === 'month') {
          const nextMonth = new Date(today);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          if (dueDate < today || dueDate >= nextMonth) return false;
        }
      }

      return true;
    });
  }, [tasks, searchQuery, filters]);

  // Update parent component when filters change
  useMemo(() => {
    onFiltered(filteredTasks);
  }, [filteredTasks, onFiltered]);

  const toggleFilter = useCallback((type: string, value: string) => {
    setFilters(prev => {
      const current = prev[type as keyof typeof prev] as string[];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setFilters({
      priority: [],
      complexity: [],
      assignedWorker: [],
      dateRange: 'all',
    });
  }, []);

  const hasActiveFilters = searchQuery || filters.priority.length > 0 || filters.complexity.length > 0 || filters.assignedWorker.length > 0 || filters.dateRange !== 'all';

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search tasks by name or description..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          Advanced Filters
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-red-600 hover:text-red-700"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          {/* Priority Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Priority</label>
            <div className="flex flex-wrap gap-2">
              {['low', 'medium', 'high', 'critical'].map(priority => (
                <button
                  key={priority}
                  onClick={() => toggleFilter('priority', priority)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filters.priority.includes(priority)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Complexity Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Complexity</label>
            <div className="flex flex-wrap gap-2">
              {['simple', 'medium', 'complex'].map(complexity => (
                <button
                  key={complexity}
                  onClick={() => toggleFilter('complexity', complexity)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filters.complexity.includes(complexity)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {complexity.charAt(0).toUpperCase() + complexity.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned Worker Filter */}
          {uniqueWorkers.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Assigned Worker</label>
              <div className="flex flex-wrap gap-2">
                {uniqueWorkers.map(worker => (
                  <button
                    key={worker}
                    onClick={() => toggleFilter('assignedToName', worker)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      filters.assignedWorker.includes(worker)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {worker}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date Range Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Due Date</label>
            <div className="flex flex-wrap gap-2">
              {['all', 'today', 'week', 'month'].map(range => (
                <button
                  key={range}
                  onClick={() => setFilters(prev => ({ ...prev, dateRange: range as any }))}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filters.dateRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {range === 'all' ? 'All' : range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredTasks.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
