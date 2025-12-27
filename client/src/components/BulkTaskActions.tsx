import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, Trash2, Users, Calendar, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkTaskActionsProps {
  selectedCount: number;
  onMarkComplete: () => Promise<void>;
  onReassign: (vaId: string) => Promise<void>;
  onReschedule: (date: string) => Promise<void>;
  onClearSelection: () => void;
  workers: Array<{ id: string; name: string; email: string }>;
  isLoading?: boolean;
}

export function BulkTaskActions({
  selectedCount,
  onMarkComplete,
  onReassign,
  onReschedule,
  onClearSelection,
  workers,
  isLoading = false,
}: BulkTaskActionsProps) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedCount === 0) return null;

  const handleMarkComplete = async () => {
    setIsProcessing(true);
    try {
      await onMarkComplete();
      toast.success(`Marked ${selectedCount} task(s) as complete`);
      setShowCompleteDialog(false);
      onClearSelection();
    } catch (error) {
      toast.error('Failed to mark tasks as complete');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedWorker) {
      toast.error('Please select a worker');
      return;
    }
    setIsProcessing(true);
    try {
      await onReassign(selectedWorker);
      toast.success(`Reassigned ${selectedCount} task(s)`);
      setShowReassignDialog(false);
      setSelectedWorker('');
      onClearSelection();
    } catch (error) {
      toast.error('Failed to reassign tasks');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }
    setIsProcessing(true);
    try {
      await onReschedule(selectedDate);
      toast.success(`Rescheduled ${selectedCount} task(s)`);
      setShowRescheduleDialog(false);
      setSelectedDate('');
      onClearSelection();
    } catch (error) {
      toast.error('Failed to reschedule tasks');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border shadow-lg z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-base px-3 py-1">
            {selectedCount} selected
          </Badge>
          <span className="text-sm text-muted-foreground">
            {selectedCount === 1 ? '1 task' : `${selectedCount} tasks`} selected
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Mark Complete */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCompleteDialog(true)}
            disabled={isProcessing || isLoading}
            className="gap-2"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Mark Complete
          </Button>

          {/* Reassign */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReassignDialog(true)}
            disabled={isProcessing || isLoading}
            className="gap-2"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Reassign
          </Button>

          {/* Reschedule */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRescheduleDialog(true)}
            disabled={isProcessing || isLoading}
            className="gap-2"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            Reschedule
          </Button>

          {/* Clear Selection */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            disabled={isProcessing || isLoading}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Mark Complete Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Complete?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark {selectedCount} task{selectedCount !== 1 ? 's' : ''} as complete. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkComplete} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Mark Complete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassign Dialog */}
      <AlertDialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Reassign {selectedCount} task{selectedCount !== 1 ? 's' : ''} to a worker
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger>
                <SelectValue placeholder="Select a worker..." />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.name} ({worker.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReassign} disabled={isProcessing || !selectedWorker}>
                {isProcessing ? 'Processing...' : 'Reassign'}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <AlertDialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reschedule Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Reschedule {selectedCount} task{selectedCount !== 1 ? 's' : ''} to a new date
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReschedule} disabled={isProcessing || !selectedDate}>
                {isProcessing ? 'Processing...' : 'Reschedule'}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BulkTaskActions;
