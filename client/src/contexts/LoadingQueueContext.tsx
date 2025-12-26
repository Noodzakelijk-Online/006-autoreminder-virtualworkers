import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface LoadingOperation {
  id: string;
  label: string;
  progress: number; // 0-100
  total?: number;
  current?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
}

interface LoadingQueueContextType {
  operations: LoadingOperation[];
  addOperation: (id: string, label: string) => void;
  updateOperation: (id: string, updates: Partial<LoadingOperation>) => void;
  removeOperation: (id: string) => void;
  clearCompleted: () => void;
  hasActiveOperations: boolean;
}

const LoadingQueueContext = createContext<LoadingQueueContextType | null>(null);

export function LoadingQueueProvider({ children }: { children: ReactNode }) {
  const [operations, setOperations] = useState<LoadingOperation[]>([]);

  const addOperation = useCallback((id: string, label: string) => {
    setOperations(prev => {
      // Remove existing operation with same id if exists
      const filtered = prev.filter(op => op.id !== id);
      return [...filtered, {
        id,
        label,
        progress: 0,
        status: 'running',
        startedAt: new Date(),
      }];
    });
  }, []);

  const updateOperation = useCallback((id: string, updates: Partial<LoadingOperation>) => {
    setOperations(prev => prev.map(op => 
      op.id === id ? { ...op, ...updates } : op
    ));
  }, []);

  const removeOperation = useCallback((id: string) => {
    setOperations(prev => prev.filter(op => op.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setOperations(prev => prev.filter(op => op.status === 'running'));
  }, []);

  const hasActiveOperations = operations.some(op => op.status === 'running');

  return (
    <LoadingQueueContext.Provider value={{
      operations,
      addOperation,
      updateOperation,
      removeOperation,
      clearCompleted,
      hasActiveOperations,
    }}>
      {children}
    </LoadingQueueContext.Provider>
  );
}

export function useLoadingQueue() {
  const context = useContext(LoadingQueueContext);
  if (!context) {
    throw new Error('useLoadingQueue must be used within a LoadingQueueProvider');
  }
  return context;
}
