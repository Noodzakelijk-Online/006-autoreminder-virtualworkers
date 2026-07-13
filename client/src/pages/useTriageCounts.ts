import { trpc } from "@/lib/trpc";

export function useTriageCounts(queriesEnabled = true) {
  const { data } = trpc.system.navigationCounts.useQuery(undefined, {
    enabled: queriesEnabled,
    staleTime: 5 * 60_000,
  });
  const replyCount = data?.replyMonitorEnabled
    ? data.pendingThreads + data.vagueFlags + data.unsignedFlags
    : 0;
  const emailCount = data?.emailCount ?? 0;
  const followUpCount = data?.followUpCount ?? 0;
  const operationalCardCount = data?.operationalCardCount ?? 0;

  return {
    replyCount,
    emailCount,
    followUpCount,
    operationalCardCount,
    total: replyCount + emailCount + followUpCount + operationalCardCount,
  };
}
