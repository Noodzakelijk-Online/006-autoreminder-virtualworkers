import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, SortAsc, SortDesc, X, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface TaskFiltersState {
  filter: 'all' | 'upcoming' | 'overdue' | 'today' | 'on-hold';
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Due Date Filter */}
        <Select
          value={filters.filter}
          onValueChange={(value) => onFiltersChange({ ...filters, filter: value as TaskFiltersState['filter'] })}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Due date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="today">Due Today</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="on-hold">On-Hold</SelectItem>
          </SelectContent>
        </Select>

        {/* Filter */}
        {clients.length > 0 && (
          <Select
            value={filters.client || "all-clients"}
            onValueChange={(value) => onFiltersChange({ ...filters, client: value === "all-clients" ? null : value })}
          >
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-clients">All Clients</SelectItem>
              {clients.map(({ client, count }) => (
                <SelectItem key={client} value={client}>
                  {client} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Sort By */}
        <Select
          value={filters.sortBy}
          onValueChange={(value) => onFiltersChange({ ...filters, sortBy: value as TaskFiltersState['sortBy'] })}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dueDate">Due Date</SelectItem>
            <SelectItem value="estimatedTime">Duration</SelectItem>
            <SelectItem value="complexity">Complexity</SelectItem>
            <SelectItem value="client">Client</SelectItem>
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
            <Badge variant="secondary" className="text-xs py-0">
              active only
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
