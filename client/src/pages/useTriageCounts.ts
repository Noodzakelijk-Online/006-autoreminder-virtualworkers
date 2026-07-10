import { trpc } from "@/lib/trpc";

export function useTriageCounts() {
  const { data: badgeSetting } = trpc.settings.getReplyMonitorBadge.useQuery(undefined, { staleTime: 5 * 60_000 });
  const enabled = badgeSetting?.enabled !== false;
  const { data: pendingThreads } = trpc.replyMonitor.getPendingThreads.useQuery(undefined, { staleTime: 15 * 60_000, enabled });
  const { data: vagueFlags } = trpc.replyMonitor.getActiveVagueFlags.useQuery(undefined, { staleTime: 15 * 60_000, enabled });
  const { data: unsignedFlags } = trpc.replyMonitor.getActiveUnsignedFlags.useQuery(undefined, { staleTime: 15 * 60_000, enabled });
  const { data: emailData } = trpc.emailInbox.getPendingCount.useQuery(undefined, { staleTime: 5 * 60_000 });
  const { data: followUpData } = trpc.aptlss.getPendingFollowUps.useQuery(undefined, { staleTime: 5 * 60_000 });

  const replyCount = enabled
    ? (pendingThreads?.length ?? 0) + (vagueFlags?.length ?? 0) + (unsignedFlags?.length ?? 0)
    : 0;
  const emailCount = emailData?.count ?? 0;
  const followUpCount = followUpData?.length ?? 0;

  return { replyCount, emailCount, followUpCount, total: replyCount + emailCount + followUpCount };
}
