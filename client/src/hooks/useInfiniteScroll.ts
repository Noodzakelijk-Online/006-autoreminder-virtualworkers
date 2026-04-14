import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number; // Distance from bottom to trigger load (default: 500px)
  onLoadMore?: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
}

/**
 * Hook to detect when user scrolls near the bottom of a scrollable container
 * and trigger a callback to load more items
 */
export function useInfiniteScroll({
  threshold = 500,
  onLoadMore,
  isLoading = false,
  hasMore = true,
}: UseInfiniteScrollOptions) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastLoadRef = useRef<number>(0);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isLoading || !hasMore) return;

    const container = scrollContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    // Check if user scrolled near bottom and enough time has passed since last load
    const now = Date.now();
    if (distanceFromBottom < threshold && now - lastLoadRef.current > 500) {
      lastLoadRef.current = now;
      onLoadMore?.();
    }
  }, [threshold, onLoadMore, isLoading, hasMore]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return scrollContainerRef;
}
