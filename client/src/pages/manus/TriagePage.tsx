/**
 * TriagePage — wraps the four triage-related views as sub-tabs:
 *   1. Day Structurer (existing TriageTab)
 *   2. Reply Monitor
 *   3. Email Inbox
 *   4. Plan My Day (AI-generated cross-card daily schedule)
 *
 * - Last active sub-tab is persisted to localStorage so returning to Triage
 *   always reopens the tab Joyce was last on.
 * - Badge counts are shown inline on the sub-tab triggers.
 * - useTriageCounts() is exported so Home.tsx can show a combined badge on
 *   the Triage sidebar item.
 */
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import TriageTab from "./TriageTab";
import ReplyMonitor from "./ReplyMonitor";
import EmailInbox from "./EmailInbox";
import PlanMyDay from "./PlanMyDay";
import { Mail, MessageSquare, Zap, CalendarDays, Send } from "lucide-react";
import FollowUpDrafts from "./FollowUpDrafts";

const TRIAGE_TAB_KEY = "joyce-triage-active-tab";
type TriageSubTab = "day-structurer" | "reply-monitor" | "email-inbox" | "plan-my-day" | "follow-up-drafts";
const VALID_TABS: TriageSubTab[] = ["day-structurer", "reply-monitor", "email-inbox", "plan-my-day", "follow-up-drafts"];

// ─── Shared hook: reply + email + follow-up counts ───────────────────────────
export function useTriageCounts() {
  const { data: badgeSetting } = trpc.settings.getReplyMonitorBadge.useQuery(undefined, { staleTime: 5 * 60_000 });
  const enabled = badgeSetting?.enabled !== false;
  const { data: pendingThreads } = trpc.replyMonitor.getPendingThreads.useQuery(undefined, { staleTime: 15 * 60_000, enabled });
  const { data: vagueFlags } = trpc.replyMonitor.getActiveVagueFlags.useQuery(undefined, { staleTime: 15 * 60_000, enabled });
  const { data: unsignedFlags } = trpc.replyMonitor.getActiveUnsignedFlags.useQuery(undefined, { staleTime: 15 * 60_000, enabled });
  const { data: emailData } = trpc.emailInbox.getPendingCount.useQuery(undefined, { staleTime: 5 * 60_000 });

  const replyCount = enabled
    ? (pendingThreads?.length ?? 0) + (vagueFlags?.length ?? 0) + (unsignedFlags?.length ?? 0)
    : 0;
  const emailCount = emailData?.count ?? 0;
  const { data: followUpData } = trpc.aptlss.getPendingFollowUps.useQuery(undefined, { staleTime: 5 * 60_000 });
  const followUpCount = followUpData?.length ?? 0;

  return { replyCount, emailCount, followUpCount, total: replyCount + emailCount + followUpCount };
}

// ─── Badge pill ───────────────────────────────────────────────────────────────
function CountBadge({ count, color = "bg-red-500" }: { count: number; color?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={`ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none ${color}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TriagePage() {
  const { replyCount, emailCount, followUpCount } = useTriageCounts();

  // Persist last active sub-tab
  const [activeTab, setActiveTab] = useState<TriageSubTab>(() => {
    const saved = localStorage.getItem(TRIAGE_TAB_KEY) as TriageSubTab | null;
    return saved && VALID_TABS.includes(saved) ? saved : "day-structurer";
  });

  const handleTabChange = (value: string) => {
    const tab = value as TriageSubTab;
    setActiveTab(tab);
    localStorage.setItem(TRIAGE_TAB_KEY, tab);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-0">
      {/* Sub-tab bar */}
      <TabsList className="w-full justify-start rounded-none border-b border-border/60 bg-transparent h-11 px-0 mb-4 gap-0">
        <TabsTrigger
          value="day-structurer"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-11 px-4 text-sm font-medium gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" />
          Day Structurer
        </TabsTrigger>
        <TabsTrigger
          value="reply-monitor"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-11 px-4 text-sm font-medium gap-1.5"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Reply Monitor
          <CountBadge count={replyCount} />
        </TabsTrigger>
        <TabsTrigger
          value="email-inbox"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-11 px-4 text-sm font-medium gap-1.5"
        >
          <Mail className="w-3.5 h-3.5" />
          Email Inbox
          <CountBadge count={emailCount} color="bg-amber-500" />
        </TabsTrigger>
        <TabsTrigger
          value="plan-my-day"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-11 px-4 text-sm font-medium gap-1.5"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Plan My Day
        </TabsTrigger>
        <TabsTrigger
          value="follow-up-drafts"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-11 px-4 text-sm font-medium gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          Follow-Up Drafts
          <CountBadge count={followUpCount} color="bg-blue-500" />
        </TabsTrigger>
      </TabsList>

      {/* Tab content */}
      <TabsContent value="day-structurer" className="mt-0">
        <TriageTab />
      </TabsContent>
      <TabsContent value="reply-monitor" className="mt-0">
        <ReplyMonitor />
      </TabsContent>
      <TabsContent value="email-inbox" className="mt-0">
        <EmailInbox />
      </TabsContent>
      <TabsContent value="plan-my-day" className="mt-0">
        <PlanMyDay />
      </TabsContent>
      <TabsContent value="follow-up-drafts" className="mt-0">
        <FollowUpDrafts />
      </TabsContent>
    </Tabs>
  );
}
