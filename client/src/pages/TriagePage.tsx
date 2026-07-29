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
 * - Badge counts are read from useTriageCounts.ts so Home.tsx does not need
 *   to load the full triage workspace just to render the sidebar badge.
 */
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TriageTab from "./TriageTab";
import ActionAlerts from "@/components/ActionAlerts";
import ReplyMonitor from "./ReplyMonitor";
import EmailInbox from "./EmailInbox";
import { Mail, MessageSquare, Zap, Send } from "lucide-react";
import FollowUpDrafts from "./FollowUpDrafts";
import { useTriageCounts } from "./useTriageCounts";
import { TRIAGE_SUB_TABS, TRIAGE_TAB_KEY, type TriageSubTab } from "@/lib/navigationState";

// ─── Shared hook: reply + email + follow-up counts ───────────────────────────
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
    return saved && TRIAGE_SUB_TABS.includes(saved) ? saved : "work-intake";
  });

  const handleTabChange = (value: string) => {
    const tab = value as TriageSubTab;
    setActiveTab(tab);
    localStorage.setItem(TRIAGE_TAB_KEY, tab);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="border-b border-border pb-4"><h1 className="text-xl font-semibold text-foreground">Inbox</h1><p className="mt-1 text-sm text-muted-foreground">Process one intake source at a time; planning and execution stay in Today.</p></div>
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-0">
      {/* Sub-tab bar */}
      <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-0 rounded-none border-b border-border/60 bg-transparent px-0 sm:grid-cols-3 lg:grid-cols-5">
        <TabsTrigger
          value="work-intake"
          className="h-11 min-w-0 gap-1.5 rounded-none border-b-2 border-transparent px-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm"
        >
          <Zap className="w-3.5 h-3.5" />
          Work Intake
        </TabsTrigger>
        <TabsTrigger
          value="reply-monitor"
          data-testid="reply-monitor-tab"
          className="h-11 min-w-0 gap-1.5 rounded-none border-b-2 border-transparent px-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Reply Monitor
          <CountBadge count={replyCount} />
        </TabsTrigger>
        <TabsTrigger
          value="email-inbox"
          className="h-11 min-w-0 gap-1.5 rounded-none border-b-2 border-transparent px-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm"
        >
          <Mail className="w-3.5 h-3.5" />
          Email Inbox
          <CountBadge count={emailCount} color="bg-amber-500" />
        </TabsTrigger>
        <TabsTrigger
          value="follow-up-drafts"
          className="h-11 min-w-0 gap-1.5 rounded-none border-b-2 border-transparent px-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm"
        >
          <Send className="w-3.5 h-3.5" />
          Follow-Up Drafts
          <CountBadge count={followUpCount} color="bg-blue-500" />
        </TabsTrigger>
        <TabsTrigger
          value="day-structurer"
          className="h-11 min-w-0 gap-1.5 rounded-none border-b-2 border-transparent px-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm"
        >
          <Zap className="w-3.5 h-3.5" />
          Routine Guide
        </TabsTrigger>
      </TabsList>

      {/* Tab content */}
      <TabsContent value="work-intake" className="mt-0">
        <ActionAlerts />
      </TabsContent>
      <TabsContent value="day-structurer" className="mt-0">
        <TriageTab />
      </TabsContent>
      <TabsContent value="reply-monitor" className="mt-0">
        <ReplyMonitor />
      </TabsContent>
      <TabsContent value="email-inbox" className="mt-0">
        <EmailInbox />
      </TabsContent>
      <TabsContent value="follow-up-drafts" className="mt-0">
        <FollowUpDrafts />
      </TabsContent>
    </Tabs>
    </div>
  );
}
