import { useCallback, useMemo, useSyncExternalStore } from "react";
import { dateKeyInEat, dayOfWeekInEat, timeKeyInEat, weekBoundsInEat } from "@shared/eatTime";

let clockNowMs = Date.now();
let clockTimer: number | null = null;
const clockSubscribers = new Map<() => void, number>();

function refreshClock() {
  clockNowMs = Date.now();
  Array.from(clockSubscribers.keys()).forEach((listener) => listener());
}

function restartClockTimer() {
  if (clockTimer !== null) window.clearInterval(clockTimer);
  clockTimer = null;
  if (clockSubscribers.size === 0) return;

  const intervalMs = Math.min(...Array.from(clockSubscribers.values()));
  clockTimer = window.setInterval(refreshClock, intervalMs);
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") refreshClock();
}

function subscribeClock(listener: () => void, intervalMs: number) {
  const wasEmpty = clockSubscribers.size === 0;
  clockSubscribers.set(listener, intervalMs);
  if (wasEmpty) {
    window.addEventListener("focus", refreshClock);
    document.addEventListener("visibilitychange", onVisibilityChange);
    clockNowMs = Date.now();
  }
  restartClockTimer();

  return () => {
    clockSubscribers.delete(listener);
    restartClockTimer();
    if (clockSubscribers.size === 0) {
      window.removeEventListener("focus", refreshClock);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

function getClockSnapshot() {
  return clockNowMs;
}

/** One shared EAT clock keeps every mounted surface synchronized with one timer. */
export function useEatClock(intervalMs = 30_000) {
  const normalizedInterval = Math.max(1_000, intervalMs);
  const subscribe = useCallback(
    (listener: () => void) => subscribeClock(listener, normalizedInterval),
    [normalizedInterval],
  );
  const nowMs = useSyncExternalStore(subscribe, getClockSnapshot, getClockSnapshot);

  return useMemo(() => {
    const dayOfWeek = dayOfWeekInEat(nowMs);
    return {
      nowMs,
      dateKey: dateKeyInEat(nowMs),
      timeKey: timeKeyInEat(nowMs),
      dayOfWeek,
      isSunday: dayOfWeek === 0,
      weekBounds: weekBoundsInEat(nowMs),
    };
  }, [nowMs]);
}
