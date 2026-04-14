import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInfiniteScroll } from '../useInfiniteScroll';

describe('useInfiniteScroll', () => {
  let mockContainer: HTMLDivElement;
  let scrollEventListeners: Map<string, Function[]>;

  beforeEach(() => {
    // Create mock container
    mockContainer = document.createElement('div');
    scrollEventListeners = new Map();

    // Mock addEventListener and removeEventListener
    mockContainer.addEventListener = vi.fn((event: string, listener: any) => {
      if (!scrollEventListeners.has(event)) {
        scrollEventListeners.set(event, []);
      }
      scrollEventListeners.get(event)!.push(listener);
    });

    mockContainer.removeEventListener = vi.fn((event: string, listener: any) => {
      const listeners = scrollEventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    });

    // Mock scroll properties
    Object.defineProperty(mockContainer, 'scrollTop', {
      writable: true,
      value: 0,
    });
    Object.defineProperty(mockContainer, 'scrollHeight', {
      writable: true,
      value: 1000,
    });
    Object.defineProperty(mockContainer, 'clientHeight', {
      writable: true,
      value: 500,
    });
  });

  it('should return a ref', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll({ onLoadMore: vi.fn() })
    );
    expect(result.current).toBeDefined();
    expect(result.current.current).toBeNull();
  });

  it('should call onLoadMore when scrolling near bottom', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        threshold: 500,
        onLoadMore,
        hasMore: true,
      })
    );

    act(() => {
      result.current.current = mockContainer;
    });

    // Simulate scroll near bottom
    act(() => {
      mockContainer.scrollTop = 300; // 300 + 500 = 800, which is > 1000 - 500 = 500
      const listeners = scrollEventListeners.get('scroll') || [];
      listeners.forEach(listener => listener());
    });

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('should not call onLoadMore when not near bottom', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        threshold: 500,
        onLoadMore,
        hasMore: true,
      })
    );

    act(() => {
      result.current.current = mockContainer;
    });

    // Simulate scroll far from bottom
    act(() => {
      mockContainer.scrollTop = 0;
      const listeners = scrollEventListeners.get('scroll') || [];
      listeners.forEach(listener => listener());
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should not call onLoadMore when isLoading is true', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        threshold: 500,
        onLoadMore,
        isLoading: true,
        hasMore: true,
      })
    );

    act(() => {
      result.current.current = mockContainer;
    });

    // Simulate scroll near bottom
    act(() => {
      mockContainer.scrollTop = 300;
      const listeners = scrollEventListeners.get('scroll') || [];
      listeners.forEach(listener => listener());
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should not call onLoadMore when hasMore is false', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        threshold: 500,
        onLoadMore,
        hasMore: false,
      })
    );

    act(() => {
      result.current.current = mockContainer;
    });

    // Simulate scroll near bottom
    act(() => {
      mockContainer.scrollTop = 300;
      const listeners = scrollEventListeners.get('scroll') || [];
      listeners.forEach(listener => listener());
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should respect threshold parameter', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        threshold: 200,
        onLoadMore,
        hasMore: true,
      })
    );

    act(() => {
      result.current.current = mockContainer;
    });

    // Simulate scroll with distance 300 from bottom (should trigger with threshold 200)
    act(() => {
      mockContainer.scrollTop = 200; // 200 + 500 = 700, distance = 1000 - 700 = 300
      const listeners = scrollEventListeners.get('scroll') || [];
      listeners.forEach(listener => listener());
    });

    expect(onLoadMore).toHaveBeenCalled();
  });

  it('should debounce multiple scroll events', async () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({
        threshold: 500,
        onLoadMore,
        hasMore: true,
      })
    );

    act(() => {
      result.current.current = mockContainer;
    });

    // Simulate multiple rapid scroll events
    act(() => {
      mockContainer.scrollTop = 300;
      const listeners = scrollEventListeners.get('scroll') || [];
      listeners.forEach(listener => listener());
      listeners.forEach(listener => listener());
      listeners.forEach(listener => listener());
    });

    // Should only call once due to debouncing
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
