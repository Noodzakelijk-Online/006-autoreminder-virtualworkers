import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, SortAsc, SortDesc, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface TaskFiltersState {
  filter: 'all' | 'upcoming' | 'overdue' | 'today';
  taskType: string | null;
  complexity: 'simple' | 'medium' | 'complex' | null;
  sortBy: 'dueDate' | 'estimatedTime' | 'complexity';
  sortOrder: 'asc' | 'desc';
}

interface TaskFiltersProps {
  filters: TaskFiltersState;
  onFiltersChange: (filters: TaskFiltersState) => void;
  taskTypes: { taskType: string; count: number }[];
  totalTasks: number;
  filteredCount: number;
}

export function TaskFilters({ 
  filters, 
  onFiltersChange, 
  taskTypes,
  totalTasks,
  filteredCount 
}: TaskFiltersProps) {
  const hasActiveFilters = filters.filter !== 'all' || filters.taskType || filters.complexity;

  const clearFilters = () => {
    onFiltersChange({
      filter: 'all',
      taskType: null,
      complexity: null,
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
        {/* Status Filter */}
        <Select
          value={filters.filter}
          onValueChange={(value) => onFiltersChange({ ...filters, filter: value as TaskFiltersState['filter'] })}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="today">Due Today</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
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
