import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, SortAsc, SortDesc, X, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface TaskFiltersState {
  filter: 'all' | 'upcoming' | 'overdue' | 'today';
  completionStatus: 'all' | 'completed' | 'incomplete';
  taskType: string | null;
  complexity: 'simple' | 'medium' | 'complex' | null;
  client: string | null;
  sortBy: 'dueDate' | 'estimatedTime' | 'complexity' | 'client';
  sortOrder: 'asc' | 'desc';
}

interface TaskFiltersProps {
  filters: TaskFiltersState;
  onFiltersChange: (filters: TaskFiltersState) => void;
  taskTypes: { taskType: string; count: number }[];
  clients?: { client: string; count: number }[];
  totalTasks: number;
  filteredCount: number;
}

export function TaskFilters({ 
  filters, 
  onFiltersChange, 
  taskTypes,
  clients = [],
  totalTasks,
  filteredCount 
}: TaskFiltersProps) {
  const hasActiveFilters = filters.filter !== 'all' || filters.taskType || filters.complexity || filters.client;
  const selectedFilterValue = filters.client
    ? `client:${filters.client}`
    : filters.taskType
      ? `taskType:${filters.taskType}`
      : filters.complexity
        ? `complexity:${filters.complexity}`
        : "all-filters";

  const clearFilters = () => {
    onFiltersChange({
      filter: 'all',
      completionStatus: 'incomplete',
      taskType: null,
      complexity: null,
      client: null,
      sortBy: 'dueDate',
      sortOrder: 'asc',
    });
  };

  const toggleSortOrder = () => {
    onFiltersChange({
      ...filters,
      sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  };

  const handleFilterChange = (value: string) => {
    if (value === "all-filters") {
      onFiltersChange({
        ...filters,
        client: null,
        taskType: null,
        complexity: null,
      });
      return;
    }

    const [type, rawValue] = value.split(":");
    if (!rawValue) return;

    onFiltersChange({
      ...filters,
      client: type === "client" ? rawValue : null,
      taskType: type === "taskType" ? rawValue : null,
      complexity: type === "complexity" ? rawValue as TaskFiltersState["complexity"] : null,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Due Date Filter */}
        <Select
          value={filters.filter}
          onValueChange={(value) => onFiltersChange({ ...filters, filter: value as TaskFiltersState['filter'] })}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Due date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Due date</SelectItem>
            <SelectItem value="today">Due Today</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        {/* General Filter */}
        <Select
          value={selectedFilterValue}
          onValueChange={handleFilterChange}
        >
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-filters">Filter</SelectItem>
            {taskTypes.map(({ taskType, count }) => (
              <SelectItem key={`taskType:${taskType}`} value={`taskType:${taskType}`}>
                Type: {taskType} ({count})
              </SelectItem>
            ))}
            <SelectItem value="complexity:simple">Complexity: Simple</SelectItem>
            <SelectItem value="complexity:medium">Complexity: Medium</SelectItem>
            <SelectItem value="complexity:complex">Complexity: Complex</SelectItem>
            {clients.map(({ client, count }) => (
              <SelectItem key={`client:${client}`} value={`client:${client}`}>
                Client: {client} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort Order Toggle */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={toggleSortOrder}
          title={filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {filters.sortOrder === 'asc' ? (
            <SortAsc className="h-4 w-4" />
          ) : (
            <SortDesc className="h-4 w-4" />
          )}
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={clearFilters}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" />
          <span>Showing {filteredCount} of {totalTasks} tasks</span>
          <div className="flex gap-1">
            {filters.filter !== 'all' && (
              <Badge variant="secondary" className="text-xs py-0">
                {filters.filter}
              </Badge>
            )}
            {filters.client && (
              <Badge variant="secondary" className="text-xs py-0">
                <Building2 className="h-3 w-3 mr-1" />
                {filters.client}
              </Badge>
            )}
            {filters.taskType && (
              <Badge variant="secondary" className="text-xs py-0 capitalize">
                {filters.taskType}
              </Badge>
            )}
            {filters.complexity && (
              <Badge variant="secondary" className="text-xs py-0 capitalize">
                {filters.complexity}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
