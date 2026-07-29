import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcutAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  callback: () => void;
  description?: string;
  category?: 'navigation' | 'scheduling' | 'batch' | 'general';
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  globalScope?: boolean;
}

/**
 * Hook for managing keyboard shortcuts
 * Handles global keyboard events and triggers callbacks for registered shortcuts
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcutAction[],
  options: UseKeyboardShortcutsOptions = {}
) => {
  const { enabled = true, preventDefault = true, globalScope = true } = options;
  const shortcutsRef = useRef<KeyboardShortcutAction[]>(shortcuts);

  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';

      if (isInputElement && !preventDefault) return;

      // Find matching shortcut
      const matchingShortcut = shortcutsRef.current.find(shortcut => {
        const keyMatches = keyboardEvent.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = (keyboardEvent.ctrlKey || keyboardEvent.metaKey) === (shortcut.ctrl || false);
        const shiftMatches = keyboardEvent.shiftKey === (shortcut.shift || false);
        const altMatches = keyboardEvent.altKey === (shortcut.alt || false);

        return keyMatches && ctrlMatches && shiftMatches && altMatches;
      });

      if (matchingShortcut) {
        if (preventDefault) {
          keyboardEvent.preventDefault();
        }
        matchingShortcut.callback();
      }
    },
    [enabled, preventDefault]
  );

  useEffect(() => {
    const target = globalScope ? window : document;
    const listener = handleKeyDown as EventListener;
    target.addEventListener('keydown', listener);

    return () => {
      target.removeEventListener('keydown', listener);
    };
  }, [handleKeyDown, globalScope]);

  // Helper to format shortcut keys for display
  const formatShortcut = useCallback((shortcut: KeyboardShortcutAction): string => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
  }, []);

  return {
    formatShortcut,
    shortcuts: shortcutsRef.current,
  };
};

/**
 * Predefined scheduling shortcuts
 */
export const SCHEDULING_SHORTCUTS: KeyboardShortcutAction[] = [
  {
    key: '1',
    ctrl: true,
    callback: () => console.log('Focus calendar'),
    description: 'Focus calendar view',
    category: 'navigation',
  },
  {
    key: '2',
    ctrl: true,
    callback: () => console.log('Focus queue'),
    description: 'Focus batch operations queue',
    category: 'navigation',
  },
  {
    key: '?',
    ctrl: true,
    callback: () => console.log('Show shortcuts'),
    description: 'Show keyboard shortcuts',
    category: 'navigation',
  },
  {
    key: 'r',
    ctrl: true,
    callback: () => console.log('Reschedule task'),
    description: 'Reschedule selected task',
    category: 'scheduling',
  },
  {
    key: 'z',
    ctrl: true,
    callback: () => console.log('Undo reschedule'),
    description: 'Undo last reschedule',
    category: 'scheduling',
  },
  {
    key: 'h',
    ctrl: true,
    callback: () => console.log('View history'),
    description: 'View schedule history',
    category: 'scheduling',
  },
  {
    key: 'ArrowRight',
    callback: () => console.log('Next day'),
    description: 'Move to next day',
    category: 'scheduling',
  },
  {
    key: 'ArrowLeft',
    callback: () => console.log('Previous day'),
    description: 'Move to previous day',
    category: 'scheduling',
  },
  {
    key: 'b',
    ctrl: true,
    callback: () => console.log('Start batch'),
    description: 'Start batch operation',
    category: 'batch',
  },
  {
    key: 'p',
    ctrl: true,
    callback: () => console.log('Pause batch'),
    description: 'Pause running batch',
    category: 'batch',
  },
  {
    key: 'p',
    ctrl: true,
    shift: true,
    callback: () => console.log('Resume batch'),
    description: 'Resume paused batch',
    category: 'batch',
  },
  {
    key: 'x',
    ctrl: true,
    callback: () => console.log('Cancel batch'),
    description: 'Cancel running batch',
    category: 'batch',
  },
  {
    key: 'r',
    ctrl: true,
    shift: true,
    callback: () => console.log('Batch reanalyze'),
    description: 'Batch re-analyze tasks',
    category: 'batch',
  },
  {
    key: 's',
    ctrl: true,
    shift: true,
    callback: () => console.log('Batch reschedule'),
    description: 'Batch reschedule tasks',
    category: 'batch',
  },
  {
    key: 'F5',
    callback: () => console.log('Refresh'),
    description: 'Refresh all data',
    category: 'general',
  },
  {
    key: ',',
    ctrl: true,
    callback: () => console.log('Settings'),
    description: 'Open settings',
    category: 'general',
  },
];

export default useKeyboardShortcuts;
