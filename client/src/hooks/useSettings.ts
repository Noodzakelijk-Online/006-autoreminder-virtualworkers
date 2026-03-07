import { useCallback, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

/**
 * Hook for managing conflict detection settings with tRPC
 */
export function useConflictDetectionSettings() {
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading, error, refetch } = trpc.settings.getConflictDetectionSettings.useQuery(undefined);

  const saveMutation = trpc.settings.saveConflictDetectionSettings.useMutation({
    onSuccess: () => {
      toast.success('Conflict detection settings saved');
      refetch();
    },
    onError: (error: any) => {
      toast.error('Failed to save settings: ' + error.message);
    },
  });

  const save = useCallback(async (data: any) => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(data);
    } finally {
      setIsSaving(false);
    }
  }, [saveMutation]);

  return {
    settings,
    isLoading,
    error,
    isSaving,
    save,
    refetch,
  };
}

/**
 * Hook for managing batch operation defaults with tRPC
 */
export function useBatchOperationDefaults() {
  const [isSaving, setIsSaving] = useState(false);

  const { data: defaults, isLoading, error, refetch } = trpc.settings.getBatchOperationSettings.useQuery(undefined);

  const saveMutation = trpc.settings.saveBatchOperationSettings.useMutation({
    onSuccess: () => {
      toast.success('Batch operation defaults saved');
      refetch();
    },
    onError: (error: any) => {
      toast.error('Failed to save defaults: ' + error.message);
    },
  });

  const save = useCallback(async (data: any) => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(data);
    } finally {
      setIsSaving(false);
    }
  }, [saveMutation]);

  return {
    defaults,
    isLoading,
    error,
    isSaving,
    save,
    refetch,
  };
}

/**
 * Hook for managing keyboard shortcuts with tRPC
 */
export function useKeyboardShortcuts() {
  const [isSaving, setIsSaving] = useState(false);

  const { data: shortcuts, isLoading, error, refetch } = trpc.settings.getKeyboardShortcuts.useQuery(undefined);

  const saveMutation = trpc.settings.saveKeyboardShortcuts.useMutation({
    onSuccess: () => {
      toast.success('Keyboard shortcuts saved');
      refetch();
    },
    onError: (error: any) => {
      toast.error('Failed to save shortcuts: ' + error.message);
    },
  });

  const save = useCallback(async (data: any) => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(data);
    } finally {
      setIsSaving(false);
    }
  }, [saveMutation]);

  return {
    shortcuts,
    isLoading,
    error,
    isSaving,
    save,
    refetch,
  };
}

/**
 * Hook for managing performance metrics with tRPC
 */
export function usePerformanceMetrics() {
  const [isSaving, setIsSaving] = useState(false);

  const { data: metrics, isLoading, error, refetch } = trpc.settings.getPerformanceMetrics.useQuery(undefined);

  const saveMutation = trpc.settings.savePerformanceMetrics.useMutation({
    onSuccess: () => {
      toast.success('Performance metrics saved');
      refetch();
    },
    onError: (error: any) => {
      toast.error('Failed to save metrics: ' + error.message);
    },
  });

  const save = useCallback(async (data: any) => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(data);
    } finally {
      setIsSaving(false);
    }
  }, [saveMutation]);

  return {
    metrics,
    isLoading,
    error,
    isSaving,
    save,
    refetch,
  };
}

/**
 * Hook for getting all settings at once
 */
export function useAllSettings() {
  const { data: allSettings, isLoading, error, refetch } = trpc.settings.getAllSettings.useQuery(undefined);

  return {
    allSettings,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for resetting all settings to defaults
 */
export function useResetSettings() {
  const [isResetting, setIsResetting] = useState(false);

  const resetMutation = trpc.settings.resetAllSettings.useMutation({
    onSuccess: () => {
      toast.success('All settings reset to defaults');
    },
    onError: (error: any) => {
      toast.error('Failed to reset settings: ' + error.message);
    },
  });

  const reset = useCallback(async () => {
    setIsResetting(true);
    try {
      await resetMutation.mutateAsync(undefined);
    } finally {
      setIsResetting(false);
    }
  }, [resetMutation]);

  return {
    isResetting,
    reset,
  };
}

/**
 * Hook for checking settings sync status
 */
export function useSettingsSyncStatus() {
  const { data: syncLog, isLoading, error: syncError, refetch } = trpc.settings.getSyncLog.useQuery({ limit: 100 });

  return {
    syncLog,
    isLoading,
    error: syncError,
    refetch,
    lastSyncTime: syncLog?.[0]?.createdAt,
  };
}
