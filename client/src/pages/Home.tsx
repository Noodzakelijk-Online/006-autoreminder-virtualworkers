import { toast } from "sonner";
import { InfoTooltip } from "@/components/InfoTooltip";
import TimeTracker from "@/components/TimeTracker";
import WebhookHealthPanel from "@/components/WebhookHealthPanel";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTriageCounts } from "./useTriageCounts";
import { trpc } from "@/lib/trpc";
import { ACTIVE_SECTION_KEY, isAppSection, type AppSection } from "@/lib/navigationState";
import { workQueueSourceFromPlan, type WorkQueueCard, type WorkQueueSourceData } from "@/lib/workQueue";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Clock,
  Mail,
  MessageSquare,
  Briefcase,
  Coffee,
  Utensils,
  Moon,
  Sun,
  Keyboard,
  LogOut,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  TrendingUp,
  Activity,
  Award,
  Zap,
  Flame,
  Timer,
  CalendarDays,
  ArrowRight,
  GitBranch,
  Settings,
  BookOpen,
  Battery,
  Target,
  ChevronDown,
  ChevronUp,
  Shield,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { CSSProperties, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { WorkQueueDashboard } from "@/components/work-queue/WorkQueueDashboard";
import type { DashboardReadiness } from "@/lib/readiness";

const TriagePage = lazy(() => import("./TriagePage"));
const PlanMyDay = lazy(() => import("./PlanMyDay"));
const DecisionsTab = lazy(() => import("./RulesTab"));
const StandardsTab = lazy(() => import("./StandardsTab"));
const PaymentTracker = lazy(() => import("./PaymentTracker"));
const SundayChecklist = lazy(() => import("./SundayChecklist"));
const WeeklyPayCalculator = lazy(() => import("./WeeklyPayCalculator"));
const ComplianceTracker = lazy(() => import("./ComplianceTracker"));

function SectionFallback() {
  return (
    <div className="rounded-md border border-border/60 bg-card p-6 text-sm font-medium text-muted-foreground">
      Loading section...
    </div>
  );
}

// ─── Today's compliance chip for the header ─────────────────────────────────
function TodayComplianceChip() {
  const { data: history = [] } = trpc.compliance.getHistory.useQuery({ limit: 1 });
  const today = new Date().toISOString().slice(0, 10);
  const todayRow = history.find(r => {
    const d = typeof r.snapshotDate === 'string' ? r.snapshotDate : new Date(r.snapshotDate).toISOString().slice(0, 10);
    return d === today;
  });
  if (!todayRow) return <span className="text-xs font-semibold text-muted-foreground">Pending</span>;
  const pct = todayRow.compliancePct;
  const colorClass = pct >= 90
    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
    : pct >= 70
    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
    : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${colorClass}`}>
      {pct}% today
    </span>
  );
}

// ─── Compliance badge for the Performance sidebar item ───────────────────────
function ComplianceBadge() {
  const { data } = trpc.compliance.getRollingAvg.useQuery({ days: 7 });
  const avg = data?.avg;
  if (avg === undefined) return null;
  const color = avg >= 90
    ? "bg-emerald-500"
    : avg >= 70
    ? "bg-amber-500"
    : "bg-red-500";
  return (
    <span className={`ml-auto min-w-[28px] h-[18px] px-1.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none ${color}`}>
      {avg}%
    </span>
  );
}

// ─── No-due-date badge for the Triage sidebar item ───────────────────────────
function NoDueDateBadge({ enabled = true }: { enabled?: boolean }) {
  // Share the same cache entry as ActionAlerts (5 min staleTime) — no extra fetch needed.
  const { data } = trpc.trello.actionAlerts.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
  if (!enabled) return null;
  const count = data?.noDueDateCards?.length ?? 0;
  if (count === 0) return null;
  return (
    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none bg-amber-500">
      {count}
    </span>
  );
}

/** Red badge on the Reply Monitor nav item showing total active flags. */
function ReplyMonitorBadge() {
  // All three share cache with the ReplyMonitor page queries (15 min staleTime).
  // No extra network requests are made when the ReplyMonitor page is already mounted.
  const { data: badgeSetting } = trpc.settings.getReplyMonitorBadge.useQuery(undefined, { staleTime: 5 * 60_000 });
  const { data: pendingThreads } = trpc.replyMonitor.getPendingThreads.useQuery(undefined, { staleTime: 15 * 60_000, enabled: badgeSetting?.enabled !== false });
  const { data: vagueFlags } = trpc.replyMonitor.getActiveVagueFlags.useQuery(undefined, { staleTime: 15 * 60_000, enabled: badgeSetting?.enabled !== false });
  const { data: unsignedFlags } = trpc.replyMonitor.getActiveUnsignedFlags.useQuery(undefined, { staleTime: 15 * 60_000, enabled: badgeSetting?.enabled !== false });

  if (!badgeSetting?.enabled) return null;

  const count = (pendingThreads?.length ?? 0) + (vagueFlags?.length ?? 0) + (unsignedFlags?.length ?? 0);
  if (count === 0) return null;

  return (
    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none bg-red-500">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Combined badge on the Triage sidebar item: shows reply + email counts as two pills. */
function TriageSidebarBadge() {
  const { replyCount, emailCount } = useTriageCounts();
  return (
    <span className="ml-auto flex items-center gap-0.5">
      {replyCount > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none bg-red-500">
          {replyCount > 99 ? '99+' : replyCount}
        </span>
      )}
      {emailCount > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none bg-amber-500">
          {emailCount > 99 ? '99+' : emailCount}
        </span>
      )}
    </span>
  );
}
// ─── Projected pay chip for the sidebar footer ───────────────────────────────
const MERIT_AMOUNTS: Record<string, number> = { meritM1: 5, meritM2: 7.5, meritM3: 1, meritStreak: 10 };
const DEMERIT_AMOUNTS: Record<string, number> = { demeritD1: 5, demeritD2: 10, demeritD3: 5, demeritD4: 5, demeritD5: 10, demeritD6: 5, demeritD7: 5, demeritD8: 10, demeritD9: 15, demeritD10: 15, demeritD11: 15 };

function ProjectedPayChip() {
  // Get the current week start (Monday) and end (Sunday)
  const { weekStart, weekEnd } = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      weekStart: start.toISOString().slice(0, 10),
      weekEnd: end.toISOString().slice(0, 10),
    };
  }, []);
  const utils = trpc.useUtils();
  const { data: payData, isLoading } = trpc.payLog.getByWeek.useQuery({ weekStart }, { staleTime: 5 * 60_000 });
  const createWeekLog = trpc.payLog.upsert.useMutation({
    onSuccess: () => utils.payLog.getByWeek.invalidate({ weekStart }),
  });
  // Auto-create a zero-row for this week so the Weekly Pay Calculator is pre-populated
  useEffect(() => {
    if (!isLoading && payData === null) {
      createWeekLog.mutate({
        weekStart, weekEnd,
        meritM1: 0, meritM2: 0, meritM3: 0, meritStreak: 0,
        demeritD1: 0, demeritD2: 0, demeritD3: 0, demeritD4: 0,
        demeritD5: 0, demeritD6: 0, demeritD7: 0, demeritD8: 0,
        demeritD9: 0, demeritD10: 0, demeritD11: 0,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, payData === null]);
  // Show brief loading indicator; fall back to base $90 if no row exists yet this week
  if (isLoading) return <span className="text-xs text-muted-foreground">…</span>;
  // Calculate projected pay using same formula as WeeklyPayCalculator
  // Base is $90/week; merits add, demerits subtract
  // Use empty object fallback so chip shows $90.00 base when no row exists yet
  const safeData = (payData ?? {}) as Record<string, unknown>;
  const totalMerits = Object.entries(MERIT_AMOUNTS).reduce((sum, [key, amt]) => sum + (Number(safeData[key]) || 0) * amt, 0);
  const totalDemerits = Object.entries(DEMERIT_AMOUNTS).reduce((sum, [key, amt]) => sum + (Number(safeData[key]) || 0) * amt, 0);
  const rawProjected = 90 - totalDemerits + totalMerits;
  const isNegative = rawProjected < 0;
  const isWarning = rawProjected < 90 && rawProjected >= 0;
  return (
    <span className={`text-xs font-semibold tabular-nums ${
      isNegative ? "text-red-600 dark:text-red-400" :
      isWarning ? "text-amber-600 dark:text-amber-400" :
      "text-emerald-600 dark:text-emerald-400"
    }`}>
      {isNegative ? `-$${Math.abs(rawProjected).toFixed(2)}` : `$${rawProjected.toFixed(2)}`}
    </span>
  );
}

// ─── Compliance trend arrow for the Overview ─────────────────────────────────
function ComplianceTrendChip() {
  const { data: history = [] } = trpc.compliance.getHistory.useQuery({ limit: 14 });
  const { data: rollingData } = trpc.compliance.getRollingAvg.useQuery({ days: 7 });
  const avg7 = rollingData?.avg;
  if (avg7 === undefined || history.length < 2) return null;
  // Compare last 7 days avg vs previous 7 days avg
  const sorted = [...history].sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());
  const recent7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);
  const recentAvg = recent7.length ? Math.round(recent7.reduce((s, r) => s + r.compliancePct, 0) / recent7.length) : avg7;
  const prevAvg = prev7.length ? Math.round(prev7.reduce((s, r) => s + r.compliancePct, 0) / prev7.length) : recentAvg;
  const delta = recentAvg - prevAvg;
  const isUp = delta > 0;
  const isFlat = delta === 0;
  const colorClass = avg7 >= 90
    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
    : avg7 >= 70
    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
    : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${colorClass}`}>
      {isFlat ? "→" : isUp ? "↑" : "↓"} {avg7}% 7-day avg
      {!isFlat && <span className="text-[10px] opacity-70">({delta > 0 ? "+" : ""}{delta}%)</span>}
    </span>
  );
}

// ─── Trello Comment Token Settings ──────────────────────────────────────────
function TrelloCommentTokenSettings() {
  const { data: tokenData, refetch } = trpc.trello.getCommentToken.useQuery(undefined, {
    // Token rarely changes; 5-min stale time (was 30 s). Mutation already calls refetch() on save.
    staleTime: 5 * 60_000,
  });
  const setTokenMutation = trpc.trello.setCommentToken.useMutation({
    onSuccess: () => {
      toast.success(tokenInput.trim() ? "Comment token saved — comments will now post as Joyce" : "Comment token cleared — using default board token");
      setTokenInput("");
      setIsEditing(false);
      refetch();
    },
    onError: (e) => toast.error(`Failed to save token: ${e.message}`),
  });

  const [tokenInput, setTokenInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      toast.error("Token cannot be empty. Use Clear to remove the token.");
      return;
    }
    setTokenMutation.mutate({ token: trimmed });
  };

  const handleClear = () => {
    if (!confirm("Remove the custom comment token? Comments will revert to posting as the board owner.")) return;
    setTokenMutation.mutate({ token: null });
  };

  return (
    <div className={`rounded-xl border p-5 ${tokenData?.isSet ? 'border-blue-500/30 bg-blue-500/5' : 'border-amber-500/40 bg-amber-500/10'}`}>
      <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-blue-500" />
        Trello Comment Token
        {!tokenData?.isSet && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
            <AlertTriangle className="w-3 h-3" />
            Action required
          </span>
        )}
      </h3>

      {/* Banner when token is not set */}
      {!tokenData?.isSet && (
        <div className="mb-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          <strong>Comments are currently posting as the board owner.</strong> This means comment detection
          relies on the <code className="font-mono text-[10px] bg-amber-500/20 px-1 rounded">@joyjemimajj1</code> mention workaround.
          Set Joyce's personal token below so comments post directly under her account — this is the most reliable setup.
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-4">
        To get Joyce's token: go to{" "}
        <a
          href="/api/trello/authorize"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          this Trello authorization page
        </a>
        {" "}while logged in as Joyce, click <strong>Allow</strong>, and paste the token below.
      </p>
      <div className="flex items-center gap-3 mb-4">
        {tokenData?.isSet ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Joyce's personal token active — comments post as Joyce
            </span>
            <code className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded font-mono">
              {tokenData.preview}
            </code>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            No personal token — posting as board owner
          </span>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="password"
            placeholder="Paste Joyce's Trello token here…"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="w-full h-9 text-sm border border-border rounded-md bg-background text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSave}
              disabled={setTokenMutation.isPending || !tokenInput.trim()}
            >
              {setTokenMutation.isPending ? "Saving…" : "Save Token"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setIsEditing(false); setTokenInput(""); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            onClick={() => setIsEditing(true)}
          >
            {tokenData?.isSet ? "Replace Token" : "Set Token"}
          </Button>
          {tokenData?.isSet && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10"
              onClick={handleClear}
              disabled={setTokenMutation.isPending}
            >
              Clear Token
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Daily Goal Settings ─────────────────────────────────────────────────────
function DailyGoalSettings() {
  const { data: goalData, refetch } = trpc.settings.getDailyGoal.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const setGoalMutation = trpc.settings.setDailyGoal.useMutation({
    onSuccess: (data) => {
      toast.success(`Daily goal updated to ${data.hours}h`);
      refetch();
    },
    onError: (e) => toast.error(`Failed to save: ${e.message}`),
  });

  const currentHours = goalData?.hours ?? 9;
  const [localHours, setLocalHours] = useState<number>(currentHours);

  useEffect(() => {
    setLocalHours(currentHours);
  }, [currentHours]);

  const handleSave = () => {
    if (localHours < 1 || localHours > 24) {
      toast.error("Daily goal must be between 1 and 24 hours");
      return;
    }
    setGoalMutation.mutate({ hours: localHours });
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <Target className="w-4 h-4 text-emerald-500" />
        Daily Hour Goal
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Choose the daily target that matches Joyce's current agreement and schedule. Progress indicators update automatically, and overtime remains visible.
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="range"
            min={1}
            max={14}
            step={0.5}
            value={localHours}
            onChange={(e) => setLocalHours(parseFloat(e.target.value))}
            className="w-full accent-emerald-500"
            aria-label="Daily hour goal"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1h</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">9–10h recommended</span>
            <span>14h</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
          <input
            type="number"
            min={1}
            max={14}
            step={0.5}
            value={localHours}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) setLocalHours(v);
            }}
            className="w-16 h-9 text-center text-sm font-bold border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            aria-label="Daily hour goal value"
          />
          <span className="text-sm text-muted-foreground">h/day</span>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSave}
            disabled={setGoalMutation.isPending || localHours === currentHours}
          >
            {setGoalMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {localHours !== currentHours && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          Unsaved change: {localHours}h/day (currently {currentHours}h)
        </p>
      )}
    </div>
  );
}

// ─── Daily Schedule Settings ───────────────────────────────────────────────
interface BreakSlot { name: string; startTime: string; durationMinutes: number; icon?: string; }
interface ScheduleSettings { startTime: string; endTime: string; breaks: BreakSlot[]; typingPractice?: boolean; typingPracticeMinutes?: number; }

const BREAK_ICONS = ["☕", "🍽️", "🌙", "🍵", "🥤", "🪴", "🧃", "🍎", "🍪", "🍺"];

function DailyScheduleSettings({ onGoToSchedule }: { onGoToSchedule?: () => void }) {
  const { data: saved, refetch } = trpc.settings.getSchedule.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const setScheduleMutation = trpc.settings.setSchedule.useMutation({
    onSuccess: () => { toast.success("Schedule saved"); refetch(); },
    onError: (e) => toast.error(`Failed to save: ${e.message}`),
  });

  const [local, setLocal] = useState<ScheduleSettings | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState<number | null>(null);

  useEffect(() => {
    if (saved && !local) setLocal(saved as ScheduleSettings);
  }, [saved]);

  const s: ScheduleSettings = local ?? (saved as ScheduleSettings) ?? { startTime: "08:00", endTime: "23:00", breaks: [], typingPractice: true, typingPracticeMinutes: 30 };
  const typingOn = s.typingPractice !== false;
  const typingMins = s.typingPracticeMinutes ?? 30;
  const [startHours, startMinutes] = s.startTime.split(":").map(Number);
  const [endHours, endMinutes] = s.endTime.split(":").map(Number);
  const windowMinutes = Math.max(0, endHours * 60 + endMinutes - (startHours * 60 + startMinutes));
  const protectedMinutes = s.breaks.reduce((sum, item) => sum + item.durationMinutes, 0) + (typingOn ? typingMins : 0);
  const availableMinutes = Math.max(0, windowMinutes - protectedMinutes);

  const updateBreak = (idx: number, field: keyof BreakSlot, value: string | number) => {
    const breaks = [...s.breaks];
    breaks[idx] = { ...breaks[idx], [field]: value };
    setLocal({ ...s, breaks });
  };

  const addBreak = () => setLocal({ ...s, breaks: [...s.breaks, { name: "Break", startTime: "12:00", durationMinutes: 30, icon: "☕" }] });
  const removeBreak = (idx: number) => { setIconPickerOpen(null); setLocal({ ...s, breaks: s.breaks.filter((_, i) => i !== idx) }); };

  const isDirty = JSON.stringify(local) !== JSON.stringify(saved);

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-500" />
          Planning Window
        </h3>
        {onGoToSchedule && (
          <button onClick={onGoToSchedule} className="text-xs text-sky-500 hover:text-sky-400 flex items-center gap-1 transition-colors">
            Open Day Plan <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
          Set Joyce's available planning window and protected breaks. The Day Plan uses these constraints automatically.
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="schedule-work-start" className="text-xs font-medium text-muted-foreground block mb-1">Work Start</label>
            <input id="schedule-work-start" type="time" value={s.startTime} onChange={e => setLocal({ ...s, startTime: e.target.value })}
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
          </div>
          <div>
            <label htmlFor="schedule-log-off" className="text-xs font-medium text-muted-foreground block mb-1">Log Off</label>
            <input id="schedule-log-off" type="time" value={s.endTime} onChange={e => setLocal({ ...s, endTime: e.target.value })}
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
          </div>
        </div>
        <div className={`rounded-md border px-3 py-2 text-xs ${windowMinutes > 12 * 60 ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300" : "border-border bg-background text-muted-foreground"}`}>
          Planning span: {formatHoursValue(windowMinutes / 60)}. After protected time, up to {formatHoursValue(availableMinutes / 60)} remains available. {windowMinutes > 12 * 60 ? "This is a long availability window; the generated plan should still stay within the daily hour goal." : "The generated plan remains capped by the daily hour goal."}
        </div>

        {/* Typing Practice */}
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Keyboard className="w-3.5 h-3.5 text-purple-500" />
              Typing Practice (EOD)
            </label>
            <button
              type="button"
              onClick={() => setLocal({ ...s, typingPractice: !typingOn })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                typingOn ? 'bg-purple-500' : 'bg-muted'
              }`}
              role="switch"
              aria-checked={typingOn}
              aria-label="Enable end-of-day typing practice"
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                typingOn ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          {typingOn && (
            <div className="flex items-center gap-2">
              <label htmlFor="typing-practice-duration" className="text-xs text-muted-foreground">Duration:</label>
              <input id="typing-practice-duration" type="number" min={5} max={120} step={5} value={typingMins}
                onChange={e => setLocal({ ...s, typingPracticeMinutes: parseInt(e.target.value) || 30 })}
                className="w-16 h-7 px-2 text-xs text-center border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/50" />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          )}
        </div>

        {/* Breaks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-foreground">Breaks</label>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addBreak}>+ Add Break</Button>
          </div>
          <div className="space-y-2">
            {s.breaks.map((brk, idx) => (
              <div key={idx} className="space-y-1.5 rounded-md border border-border/60 bg-background/40 p-2 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[32px_minmax(120px,1fr)_110px_92px_32px]">
                  {/* Icon picker trigger */}
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(iconPickerOpen === idx ? null : idx)}
                    className="w-8 h-8 rounded-md border border-border bg-background hover:bg-muted flex items-center justify-center text-base transition-colors"
                    title="Pick icon"
                    aria-label={`Choose icon for ${brk.name}`}
                  >
                    {brk.icon || "☕"}
                  </button>
                  <input type="text" placeholder="Name" value={brk.name}
                    aria-label={`Break ${idx + 1} name`}
                    onChange={e => updateBreak(idx, "name", e.target.value)}
                    className="h-8 px-2 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
                  <input type="time" value={brk.startTime}
                    aria-label={`${brk.name} start time`}
                    onChange={e => updateBreak(idx, "startTime", e.target.value)}
                    className="col-start-2 h-8 w-full px-2 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500/50 sm:col-start-auto" />
                  <div className="col-start-2 flex items-center gap-1 sm:col-start-auto">
                    <input type="number" min={5} max={480} step={5} value={brk.durationMinutes}
                      aria-label={`${brk.name} duration in minutes`}
                      onChange={e => updateBreak(idx, "durationMinutes", parseInt(e.target.value) || 30)}
                      className="w-16 h-8 px-2 text-xs text-center border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                  <Button size="sm" variant="ghost" className="col-start-2 h-8 w-8 justify-self-end p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 sm:col-start-auto" onClick={() => removeBreak(idx)} aria-label={`Remove ${brk.name}`}>
                    <span className="text-sm">×</span>
                  </Button>
                </div>
                {/* Icon picker popover */}
                {iconPickerOpen === idx && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-card border border-border rounded-lg shadow-md">
                    {BREAK_ICONS.map(em => (
                      <button key={em} type="button" aria-label={`Use ${em} for ${brk.name}`} onClick={() => { updateBreak(idx, "icon", em); setIconPickerOpen(null); }}
                        className={`w-8 h-8 text-base rounded-md hover:bg-muted flex items-center justify-center transition-colors ${
                          brk.icon === em ? 'bg-sky-500/20 ring-1 ring-sky-500' : ''
                        }`}>
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {s.breaks.length === 0 && <p className="text-xs text-muted-foreground italic">No breaks configured.</p>}
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white"
            onClick={() => setScheduleMutation.mutate(s)}
            disabled={setScheduleMutation.isPending || !isDirty}>
            {setScheduleMutation.isPending ? "Saving…" : "Save Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Reply Monitor Badge Settings ──────────────────────────────────────────
function ReplyMonitorBadgeSettings() {
  const utils = trpc.useUtils();
  const { data: badgeSetting, isLoading } = trpc.settings.getReplyMonitorBadge.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const setMutation = trpc.settings.setReplyMonitorBadge.useMutation({
    onSuccess: (data) => {
      toast.success(data.enabled ? "Reply Monitor badge enabled" : "Reply Monitor badge disabled");
      utils.settings.getReplyMonitorBadge.invalidate();
    },
    onError: (e) => toast.error(`Failed to update: ${e.message}`),
  });

  const enabled = badgeSetting?.enabled ?? true;

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-red-500" />
            Reply Monitor Sidebar Badge
          </h3>
          <p className="text-xs text-muted-foreground">
            Show a red count badge on the Reply Monitor nav item when there are active unanswered threads, vague flags, or unsigned message flags.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => setMutation.mutate({ enabled: checked })}
          disabled={isLoading || setMutation.isPending}
          aria-label="Toggle Reply Monitor sidebar badge"
        />
      </div>
    </div>
  );
}

// ─── Operational Policies Settings ─────────────────────────────────────────
const POLICY_CATEGORY_LABELS: Record<string, string> = {
  stall: "Stall Detection",
  follow_up: "Auto Follow-Up Drafts",
  escalation: "Escalation Rules",
  autopilot: "Autopilot Level",
  done_gate: "Done Quality Gate",
  scheduling: "Confidence Thresholds",
  default_action: "Default Action Rules (per APTLSS State)",
  general: "General",
};

function OperationalPoliciesSettings() {
  const utils = trpc.useUtils();
  const { data: policies, isLoading } = trpc.aptlss.getPolicies.useQuery(undefined, { staleTime: 60_000 });
  const updateMutation = trpc.aptlss.updatePolicy.useMutation({
    onSuccess: () => { utils.aptlss.getPolicies.invalidate(); toast.success("Policy updated"); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const toggleMutation = trpc.aptlss.togglePolicy.useMutation({
    onSuccess: () => utils.aptlss.getPolicies.invalidate(),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const [editing, setEditing] = useState<Record<string, string>>({});

  if (isLoading) return <div className="rounded-xl border border-border/50 bg-card/50 p-5"><p className="text-xs text-muted-foreground">Loading policies…</p></div>;

  const grouped = (policies ?? []).reduce((acc, p) => {
    const cat = p.category ?? "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, typeof policies>);

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Shield className="w-4 h-4 text-indigo-500" />
        APTLSS Operational Policies
      </h3>
      <p className="text-xs text-muted-foreground -mt-3">
        Configure thresholds, autopilot level, done-gate rules, and follow-up timing. Changes take effect immediately.
      </p>
      {Object.entries(grouped).map(([cat, catPolicies]) => (
        <div key={cat} className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{POLICY_CATEGORY_LABELS[cat] ?? cat}</p>
          {(catPolicies ?? []).map(policy => (
            <div key={policy.ruleKey} className="flex items-start gap-3 bg-background/50 rounded-lg p-3 border border-border/30">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{policy.label}</p>
                {policy.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{policy.description}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="text"
                  value={editing[policy.ruleKey] ?? policy.value ?? ""}
                  onChange={(e) => setEditing(prev => ({ ...prev, [policy.ruleKey]: e.target.value }))}
                  onBlur={() => {
                    const val = editing[policy.ruleKey];
                    if (val !== undefined && val !== policy.value) {
                      updateMutation.mutate({ ruleKey: policy.ruleKey, value: val });
                    }
                  }}
                  className="w-20 text-xs bg-background border border-border rounded px-2 py-1 text-right font-mono focus:outline-none focus:border-indigo-500"
                />
                <Switch
                  checked={policy.enabled === 1}
                  onCheckedChange={(checked) => toggleMutation.mutate({ ruleKey: policy.ruleKey, enabled: checked })}
                  aria-label={`Toggle ${policy.label}`}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Default Action Rules Settings (GAP E) ─────────────────────────────────
const APTLSS_STATES = [
  "NEW_UNTRIAGED", "READY_TO_START", "IN_PROGRESS", "WAITING_FOR_JOYCE",
  "WAITING_FOR_ROBERT", "WAITING_FOR_EXTERNAL_PARTY", "BLOCKED_BY_OTHER_CARD",
  "STALLED", "OVERDUE", "READY_FOR_REVIEW", "READY_FOR_DONE",
  "DONE_CONFIRMED", "NEEDS_RESTRUCTURING", "NEEDS_ARCHIVE",
] as const;

const BUILT_IN_DEFAULT_ACTIONS: Record<string, string> = {
  NEW_UNTRIAGED: "Generate an APTLSS plan to break this card into actionable steps.",
  READY_TO_START: "Pick the highest-priority open step and start working on it.",
  IN_PROGRESS: "Continue the current open step. Update checklist when done.",
  WAITING_FOR_JOYCE: "Answer the pending question in the card comments.",
  WAITING_FOR_ROBERT: "Notify Robert that a decision is needed on this card.",
  WAITING_FOR_EXTERNAL_PARTY: "Check if the follow-up deadline has passed. If yes, send a follow-up message.",
  BLOCKED_BY_OTHER_CARD: "Check the blocking card. If resolved, unblock and resume.",
  STALLED: "Leave a comment explaining why progress has stalled. Escalate if needed.",
  OVERDUE: "Immediately prioritise this card. Notify Robert if it cannot be completed today.",
  READY_FOR_REVIEW: "Ask Robert to review and approve before moving to Done.",
  READY_FOR_DONE: "Verify all done-gate criteria are met, then move the card to Done.",
  DONE_CONFIRMED: "Archive this card at the end of the week.",
  NEEDS_RESTRUCTURING: "Open the card and fix the flagged issue (add description, due date, or split into smaller cards).",
  NEEDS_ARCHIVE: "Mark the card as complete in Trello and move it to the Archive list.",
};

function DefaultActionsSettings() {
  const utils = trpc.useUtils();
  const { data: customActions } = trpc.aptlss.getAllDefaultActions.useQuery(undefined, { staleTime: 60_000 });
  const updateMutation = trpc.aptlss.updatePolicy.useMutation({
    onSuccess: () => { utils.aptlss.getAllDefaultActions.invalidate(); toast.success("Default action updated"); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);

  const customMap = (customActions ?? []).reduce((acc, p) => {
    acc[p.ruleKey] = p.value ?? "";
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-500" />
          Default Action Rules
        </h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded(v => !v)}>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
          {expanded ? "Collapse" : "Expand all 14 states"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Customise the recommended action shown in the Daily Actions banner for each APTLSS state. Leave blank to use the built-in default.
      </p>
      {expanded && (
        <div className="space-y-2">
          {APTLSS_STATES.map(state => {
            const ruleKey = `default_action_${state.toLowerCase()}`;
            const customVal = customMap[ruleKey] ?? "";
            const builtIn = BUILT_IN_DEFAULT_ACTIONS[state] ?? "";
            const displayVal = editing[ruleKey] ?? customVal;
            return (
              <div key={state} className="bg-background/50 rounded-lg p-3 border border-border/30 space-y-1.5">
                <p className="text-xs font-mono font-semibold text-foreground">{state}</p>
                <p className="text-[10px] text-muted-foreground italic">{builtIn}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Custom override (leave blank for built-in default)…"
                    value={displayVal}
                    onChange={(e) => setEditing(prev => ({ ...prev, [ruleKey]: e.target.value }))}
                    onBlur={() => {
                      const val = editing[ruleKey];
                      if (val !== undefined && val !== customVal) {
                        updateMutation.mutate({ ruleKey, value: val });
                      }
                    }}
                    className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:border-violet-500"
                  />
                  {customVal && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-red-500"
                      onClick={() => {
                        setEditing(prev => ({ ...prev, [ruleKey]: "" }));
                        updateMutation.mutate({ ruleKey, value: "" });
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Ready for Done Panel (GAP H) ─────────────────────────────────────────────
function ReadyForDonePanel() {
  const { data: cards } = trpc.aptlss.getReadyForDone.useQuery(undefined, { staleTime: 5 * 60_000 });
  if (!cards || cards.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Ready for Done ({cards.length})</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
        <p className="text-xs text-muted-foreground mb-2">These cards have passed all done-gate checks. Verify and move them to Done in Trello.</p>
        {cards.map(card => (
          <div key={card.cardId} className="flex items-center gap-2 p-2.5 bg-background/50 rounded-lg border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{card.cardName}</p>
              {card.stateReason && <p className="text-[10px] text-muted-foreground">{card.stateReason}</p>}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex-shrink-0">
              {new Date(card.calculatedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Worker Performance Panel ───────────────────────────────────────────────
function WorkerPerformancePanel() {
  const { data: performance, isLoading } = trpc.aptlss.getWorkerPerformance.useQuery(undefined, { staleTime: 5 * 60_000 });
  if (isLoading) return null;
  if (!performance || performance.length === 0) return null;

  const grouped = performance.reduce((acc, p) => {
    if (!acc[p.workerId]) acc[p.workerId] = [];
    acc[p.workerId].push(p);
    return acc;
  }, {} as Record<string, typeof performance>);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Worker Performance Signals</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-3">
        {Object.entries(grouped).map(([workerId, signals]) => {
          const latest = signals[0];
          const score = Math.max(0, 100 - (latest.stalledCardsCount * 10) - (latest.missedDeadlines * 15) - (latest.reworkCount * 8) - (latest.unclearHandovers * 5));
          const scoreColor = score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
          return (
            <div key={workerId} className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">{latest.workerName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Week {latest.weekKey}</span>
                  <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Stalled", value: latest.stalledCardsCount, bad: latest.stalledCardsCount > 2 },
                  { label: "Missed Deadlines", value: latest.missedDeadlines, bad: latest.missedDeadlines > 1 },
                  { label: "Rework", value: latest.reworkCount, bad: latest.reworkCount > 1 },
                  { label: "Escalations", value: latest.robertEscalationsCount, bad: latest.robertEscalationsCount > 2 },
                  { label: "Unclear Handovers", value: latest.unclearHandovers, bad: latest.unclearHandovers > 1 },
                  { label: "Checklist Items", value: latest.checklistItemsCompleted, bad: false },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-2 text-center ${item.bad ? "bg-red-500/10 border border-red-500/30" : "bg-muted/30"}`}>
                    <p className={`text-sm font-bold ${item.bad ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
              {latest.notes && <p className="text-xs text-muted-foreground mt-2 italic">{latest.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weekly Analysis Panel ───────────────────────────────────────────────────
function WeeklyAnalysisPanel() {
  const { data: latestAnalysis, isLoading } = trpc.aptlss.getLatestWeeklyAnalysis.useQuery(undefined, { staleTime: 10 * 60_000 });
  const { data: history } = trpc.aptlss.getWeeklyAnalysisHistory.useQuery(undefined, { staleTime: 10 * 60_000 });
  const { data: liveExceptions } = trpc.trello.actionAlerts.useQuery(undefined, { staleTime: 2 * 60_000 });
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);

  const analysis = selectedWeekKey
    ? (history ?? []).find(h => h.weekKey === selectedWeekKey) ?? latestAnalysis
    : latestAnalysis;

  if (isLoading || !analysis) return null;

  let noProgressCards: { cardId: string; cardName: string; state: string }[] = [];
  let recurringBlockers: { reason: string; count: number; cards: string[] }[] = [];
  let processImprovements: string[] = [];
  try { noProgressCards = JSON.parse(analysis.noProgressCards ?? "[]"); } catch { /* ignore */ }
  try { recurringBlockers = JSON.parse(analysis.recurringBlockers ?? "[]"); } catch { /* ignore */ }
  try { processImprovements = JSON.parse(analysis.processImprovements ?? "[]"); } catch { /* ignore */ }

  const historyList = history ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Historical APTLSS Analysis</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {/* History selector */}
      {historyList.length > 1 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {historyList.map(h => (
            <button
              key={h.weekKey}
              onClick={() => setSelectedWeekKey(h.weekKey === latestAnalysis?.weekKey ? null : h.weekKey)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                (selectedWeekKey === h.weekKey || (!selectedWeekKey && h.weekKey === latestAnalysis?.weekKey))
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300"
                  : "bg-muted/30 border-border/40 text-muted-foreground hover:border-blue-500/30"
              }`}
            >
              {h.weekKey}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-4">
        {liveExceptions && (
          <div className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs sm:grid-cols-3">
            <div><span className="text-muted-foreground">Current Trello overdue</span><p className="mt-1 font-semibold text-red-600 dark:text-red-300">{liveExceptions.overdueCards.length}</p></div>
            <div><span className="text-muted-foreground">Doing updates</span><p className="mt-1 font-semibold text-amber-600 dark:text-amber-300">{liveExceptions.doingCards.filter((card) => !card.updatedToday).length}</p></div>
            <div><span className="text-muted-foreground">On-hold review</span><p className="mt-1 font-semibold text-violet-600 dark:text-violet-300">{liveExceptions.onHoldCards.length}</p></div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Week {analysis.weekKey}</p>
          <span className="text-xs text-muted-foreground">{new Date(analysis.createdAt).toLocaleDateString()}</span>
        </div>
        <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Saved snapshot:</span> {analysis.summary}</p>
        {noProgressCards.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">No-Progress Cards ({noProgressCards.length})</p>
            <div className="space-y-1">
              {noProgressCards.slice(0, 5).map(c => (
                <div key={c.cardId} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  {c.cardName} <span className="text-amber-500">({c.state})</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {recurringBlockers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Recurring Blockers ({recurringBlockers.length})</p>
            <div className="space-y-1">
              {recurringBlockers.map((b, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1" />
                  <span>{b.reason} <span className="text-red-500">({b.count} cards)</span></span>
                </div>
              ))}
            </div>
          </div>
        )}
        {processImprovements.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Process Improvements</p>
            <div className="space-y-1">
              {processImprovements.map((imp, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                  {imp}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Progress color helper ───────────────────────────────────────────────────
function getProgressColor(hours: number) {
  if (hours < 50) return { gradient: "from-red-500 to-red-600", text: "text-red-600 dark:text-red-400", label: "Below Target", bg: "bg-red-500" };
  if (hours < 53) return { gradient: "from-orange-400 to-orange-500", text: "text-orange-600 dark:text-orange-400", label: "On Track", bg: "bg-orange-500" };
  if (hours < 55) return { gradient: "from-yellow-400 to-yellow-500", text: "text-yellow-600 dark:text-yellow-400", label: "Almost There", bg: "bg-yellow-500" };
  return { gradient: "from-emerald-400 to-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Target Met", bg: "bg-emerald-500" };
}

//// ─── Routine Section (Daily Schedule tab) ───────────────────────────────────
type Section = AppSection;

const NAV_ITEMS: {
  id: Section;
  label: string;
  detail: string;
  icon: React.ElementType;
  shortcut: string;
  badge?: "compliance" | "triage";
}[] = [
  { id: "overview", label: "Today", detail: "Now and day plan", icon: Activity, shortcut: "O" },
  { id: "triage", label: "Inbox", detail: "Intake and replies", icon: Zap, shortcut: "T", badge: "triage" },
  { id: "decisions", label: "Decisions", detail: "Prepared choices", icon: GitBranch, shortcut: "D" },
  { id: "performance", label: "Time & Pay", detail: "Hours and payment", icon: Award, shortcut: "P", badge: "compliance" },
  { id: "standards", label: "Standards", detail: "Work rules", icon: BookOpen, shortcut: "R" },
  { id: "settings", label: "Settings", detail: "Controls", icon: Settings, shortcut: "G" },
];

const SIDEBAR_WIDTH_KEY = "joyce-sidebar-width";
const TODAY_MODE_KEY = "joyce-today-mode";
type TodayMode = "queue" | "plan";
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 180;
const MAX_WIDTH = 320;
function formatHoursValue(hours?: number | null) {
  if (hours === undefined || hours === null || Number.isNaN(hours)) return "0h";
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
}

function StatusPill({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red" | "violet";
  onClick?: () => void;
}) {
  const toneClasses = {
    neutral: "text-foreground",
    blue: "text-blue-700 dark:text-blue-300",
    green: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-800 dark:text-amber-300",
    red: "text-red-700 dark:text-red-300",
    violet: "text-violet-700 dark:text-violet-300",
  }[tone];

  return (
    <button
      type="button"
      data-testid={`status-${label.toLowerCase()}`}
      onClick={onClick}
      className={`flex min-h-9 min-w-[98px] items-center gap-2 border-r border-border/60 px-3 py-1.5 text-left transition-colors last:border-r-0 hover:bg-accent ${toneClasses}`}
      aria-label={`Open ${label}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase leading-none text-muted-foreground md:text-[10px]">{label}</p>
        <div className="mt-1 whitespace-nowrap text-[11px] font-semibold leading-none md:text-sm">{value}</div>
      </div>
    </button>
  );
}

function WorkspaceStatusStrip({
  todayHours,
  hoursUnavailable,
  setupWarnings,
  onOpenPlan,
  onNavigate,
}: {
  todayHours: React.ReactNode;
  hoursUnavailable: boolean;
  setupWarnings: number | null;
  onOpenPlan: () => void;
  onNavigate: (section: Section) => void;
}) {
  return (
    <div className="border-b border-border/60 bg-card px-2 lg:px-4">
      <div className="flex overflow-x-auto">
        <StatusPill icon={CalendarDays} label="Plan" value={<DailyPlanStatusChip />} tone="blue" onClick={onOpenPlan} />
        <StatusPill icon={Timer} label="Time" value={hoursUnavailable ? "Setup needed" : todayHours} tone={hoursUnavailable ? "amber" : "neutral"} onClick={() => onNavigate("performance")} />
        <StatusPill icon={GitBranch} label="Decisions" value={<DecisionQueueStatusChip />} tone="violet" onClick={() => onNavigate("decisions")} />
        <StatusPill
          icon={Settings}
          label="Setup"
          value={setupWarnings === null ? "Checking..." : setupWarnings === 0 ? "Ready" : `${setupWarnings} open`}
          tone={setupWarnings === null ? "neutral" : setupWarnings === 0 ? "green" : "amber"}
          onClick={() => onNavigate("settings")}
        />
      </div>
    </div>
  );
}

function TodayHoursChip() {
  const todayDate = useMemo(() => {
    const eatNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return eatNow.toISOString().slice(0, 10);
  }, []);
  const { data: dailySummary = [] } = trpc.timer.getDailySummary.useQuery(
    { date: todayDate },
    { staleTime: 30 * 60_000 }
  );
  const totalSecs = dailySummary.reduce((s, e) => s + e.totalSeconds, 0);
  if (totalSecs === 0) return <span className="text-xs text-muted-foreground">0h today</span>;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const label = h > 0 ? `${h}h ${m}m today` : `${m}m today`;
  return <span className="text-xs font-medium text-foreground">{label}</span>;
}

function TimeAndPaySection() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold text-foreground">Time &amp; Pay</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep daily time, payment administration, and quality history in separate views.</p>
      </div>
      <Tabs defaultValue="time" className="gap-5">
        <div className="border-b border-border">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-none bg-transparent p-0">
            <TabsTrigger value="time" className="h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Time</TabsTrigger>
            <TabsTrigger value="pay" className="h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Pay</TabsTrigger>
            <TabsTrigger value="quality" className="h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Quality history</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="time" className="mt-0 flex flex-col gap-4">
          <TimeTracker />
          <WorkerPerformancePanel />
          <WeeklyAnalysisPanel />
        </TabsContent>
        <TabsContent value="pay" className="mt-0 flex flex-col gap-4">
          <Suspense fallback={<SectionFallback />}><PaymentTracker /></Suspense>
          <Suspense fallback={<SectionFallback />}><WeeklyPayCalculator /></Suspense>
        </TabsContent>
        <TabsContent value="quality" className="mt-0 flex flex-col gap-4">
          <ReadyForDonePanel />
          <Suspense fallback={<SectionFallback />}><ComplianceTracker /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DailyPlanStatusChip() {
  const dateKey = useMemo(() => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10), []);
  const query = trpc.aptlss.getDailyPlan.useQuery({ dateKey }, { retry: false, staleTime: 60_000 });
  if (query.isLoading) return <span className="text-xs text-muted-foreground">Checking...</span>;
  if (query.error) return <span className="text-xs font-medium">Unavailable</span>;
  const plan = query.data?.plan as { planHealth?: { workloadMinutes?: number }; totalScheduledMinutes?: number } | null | undefined;
  if (!plan) return <span className="text-xs font-medium">Generate</span>;
  const focusMinutes = plan.planHealth?.workloadMinutes ?? plan.totalScheduledMinutes ?? 0;
  return <span className="text-xs font-medium">{formatHoursValue(focusMinutes / 60)} focus</span>;
}

function DecisionQueueStatusChip() {
  const query = trpc.aptlss.getDecisionQueue.useQuery(undefined, { retry: false, staleTime: 60_000 });
  if (query.isLoading) return <span className="text-xs text-muted-foreground">Checking...</span>;
  if (query.error) return <span className="text-xs font-medium">Unavailable</span>;
  const count = query.data?.items.length ?? 0;
  return <span className="text-xs font-medium">{count} waiting</span>;
}

// ─── Inner layout (needs useSidebar) ────────────────────────────────────────

function SettingsSection({
  onGoToSchedule,
  readiness,
  readinessError,
}: {
  onGoToSchedule: () => void;
  readiness?: DashboardReadiness;
  readinessError?: { message: string } | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose one configuration area at a time. System health stays separate from workday controls.</p>
      </div>

      <Tabs defaultValue="workday" className="gap-5">
        <div className="border-b border-border">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-none bg-transparent p-0 sm:grid-cols-5">
            <TabsTrigger value="workday" className="h-11 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Workday</TabsTrigger>
            <TabsTrigger value="weekly-reset" className="h-11 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Weekly reset</TabsTrigger>
            <TabsTrigger value="trello" className="h-11 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Trello</TabsTrigger>
            <TabsTrigger value="automation" className="h-11 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Automation</TabsTrigger>
            <TabsTrigger value="system" className="h-11 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">System</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="workday" className="mt-0 grid gap-4 lg:grid-cols-2">
          <DailyGoalSettings />
          <DailyScheduleSettings onGoToSchedule={onGoToSchedule} />
        </TabsContent>

        <TabsContent value="weekly-reset" className="mt-0">
          <Suspense fallback={<SectionFallback />}><SundayChecklist /></Suspense>
        </TabsContent>

        <TabsContent value="trello" className="mt-0 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Trello Power-Up</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Install the custom Power-Up on a Trello board to expose the dashboard timer on cards.</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs font-semibold text-foreground">1. Create the Power-Up</p>
                <a href="https://trello.com/power-ups/admin" target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex text-xs font-medium text-primary hover:underline">Open Trello Power-Up Admin</a>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs font-semibold text-foreground">2. Add the connector URL</p>
                <code className="mt-2 block cursor-pointer select-all break-all rounded-md border border-border bg-muted px-2 py-1.5 text-xs text-foreground" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/powerup/index.html`)} title="Click to copy">{window.location.origin}/powerup/index.html</code>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs font-semibold text-foreground">3. Copy the configured API key</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={async () => {
                  const response = await fetch("/api/powerup/key");
                  const key = await response.text();
                  if (!response.ok || !key.trim()) {
                    toast.error("Power-Up API key is not configured.");
                    return;
                  }
                  await navigator.clipboard.writeText(key.trim());
                  toast.success("Power-Up API key copied.");
                }}>Copy Power-Up key</Button>
              </div>
            </div>
          </section>
          <TrelloCommentTokenSettings />
        </TabsContent>

        <TabsContent value="automation" className="mt-0 grid gap-4 lg:grid-cols-2">
          <ReplyMonitorBadgeSettings />
          <OperationalPoliciesSettings />
          <div className="lg:col-span-2"><DefaultActionsSettings /></div>
        </TabsContent>

        <TabsContent value="system" className="mt-0 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <SettingsStatusPanel readiness={readiness} readinessError={readinessError} />
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Settings className="h-4 w-4 text-primary" />Integration health</h2>
            <div className="mt-4"><WebhookHealthPanel /></div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsStatusPanel({ readiness, readinessError }: { readiness?: DashboardReadiness; readinessError?: { message: string } | null }) {
  const items = readiness?.items.filter((item) => item.status !== "ready") ?? [];
  const statusLabel = readinessError ? "Unavailable" : readiness ? (items.length ? `${items.length} open` : "Ready") : "Checking...";
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Shield className="h-4 w-4 text-primary" />System status</h2>
          <p className="mt-1 text-sm text-muted-foreground">{readinessError ? `Health check failed: ${readinessError.message}` : readiness?.summary ?? "Checking connected services."}</p>
        </div>
        <Badge variant="outline" className={items.length || readinessError ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300" : readiness ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "border-border text-muted-foreground"}>{statusLabel}</Badge>
      </div>
      <div className="mt-4 divide-y divide-border rounded-md border border-border bg-background">
        {!readiness && !readinessError ? <p className="px-3 py-5 text-sm text-muted-foreground">Checking database, Trello, planning, and monitor status.</p> : items.length ? items.map((item) => (
          <div key={item.id} className="px-3 py-3">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-foreground">{item.label}</p><Badge variant="outline" className="shrink-0 text-[10px] capitalize">{item.status}</Badge></div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.message}</p>
            <p className="mt-1 text-xs font-medium text-foreground">{item.action}</p>
          </div>
        )) : <p className="px-3 py-5 text-sm text-muted-foreground">All configured services are ready.</p>}
      </div>
      <Button variant="outline" size="sm" className="mt-4" asChild><a href="/admin"><Shield className="h-3.5 w-3.5" />Open readiness report</a></Button>
    </section>
  );
}

function HomeInner() {
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const utils = trpc.useUtils();
  const { state, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [activeSection, setActiveSection] = useState<Section>(() => {
    const saved = localStorage.getItem(ACTIVE_SECTION_KEY);
    if (saved === "routine") return "overview";
    if (saved === "sunday") return "settings";
    return isAppSection(saved) ? saved : "overview";
  });
  const [todayMode, setTodayMode] = useState<TodayMode>(() => localStorage.getItem(ACTIVE_SECTION_KEY) === "routine" || localStorage.getItem(TODAY_MODE_KEY) === "plan" ? "plan" : "queue");

  const { data: readiness, error: readinessError } = trpc.system.readiness.useQuery(
    { probeDatabase: true, probeTrello: true },
    {
      retry: false,
      staleTime: 2 * 60_000,
      refetchInterval: 5 * 60_000,
    },
  );
  const trelloAccessStatus = readiness?.items.find((item) => item.id === "trello-api-access")?.status;
  const trelloReady = Boolean(
    readiness?.items.find((item) => item.id === "trello-api-key")?.status === "ready" &&
    readiness?.items.find((item) => item.id === "trello-api-token")?.status === "ready" &&
    trelloAccessStatus !== "blocked",
  );
  const readinessResolved = Boolean(readiness || readinessError);
  const databaseReady = readiness?.items.find((item) => item.id === "database")?.status === "ready";
  const trelloQueryEnabled = trelloReady && readinessResolved;
  const trelloUnavailable = readinessResolved && !trelloReady;
  const trelloDisabledReason = trelloUnavailable
    ? "Configure and verify TrelloAPIKey and TrelloAPIToken before live Trello activity can load."
    : undefined;
  const hoursQueryEnabled = readinessResolved && Boolean(databaseReady);
  const hoursUnavailable = readinessResolved && !databaseReady;
  const setupWarnings = readinessResolved
    ? (readiness?.counts.warning ?? 0) + (readiness?.counts.blocked ?? (readinessError ? 1 : 0))
    : null;

  const { data: weeklyHours, isLoading: hoursLoading } = trpc.trello.weeklyHours.useQuery(undefined, {
    enabled: hoursQueryEnabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const { data: actionAlertsData, isLoading: actionAlertsLoading, error: actionAlertsError } = trpc.trello.actionAlerts.useQuery(undefined, {
    enabled: trelloQueryEnabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const { data: activeWaitingReasons = [] } = trpc.aptlss.getActiveWaitingReasons.useQuery(undefined, {
    enabled: readinessResolved && Boolean(databaseReady),
    retry: false,
    staleTime: 60_000,
  });
  const todayDateKey = useMemo(() => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10), []);
  const savedPlanFallback = trpc.aptlss.getDailyPlan.useQuery({ dateKey: todayDateKey }, { retry: false, staleTime: 60_000 });
  const fallbackQueueData = useMemo<WorkQueueSourceData | undefined>(() => {
    if (!actionAlertsError || !savedPlanFallback.data?.plan) return undefined;
    const plan = savedPlanFallback.data.plan as {
      blocks?: Array<{ cardId?: string | null; cardName: string; cardUrl?: string | null; boardName: string; listName: string; flags?: string[] }>;
    };
    return workQueueSourceFromPlan(plan.blocks ?? []);
  }, [actionAlertsError, savedPlanFallback.data?.plan]);
  const workQueueDataNotice = fallbackQueueData
    ? "Live Trello is unavailable. Showing cards from the most recently saved Day Plan."
    : actionAlertsData?.freshness.stale
      ? `Trello is rate-limited or offline. Showing cached cards from ${actionAlertsData.freshness.fetchedAt ? new Date(actionAlertsData.freshness.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "the last successful sync"}.`
      : undefined;
  const preferredPlanCardId = useMemo(() => {
    const plan = savedPlanFallback.data?.plan as { blocks?: Array<{ cardId?: string | null; startTime: string; endTime: string; status?: string }> } | null | undefined;
    const blocks = (plan?.blocks ?? []).filter((block) => block.cardId && (block.status === "planned" || block.status === "active"));
    const eatTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(11, 16);
    const toMinute = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
    const now = toMinute(eatTime);
    const active = blocks.find((block) => block.status === "active");
    const current = blocks.find((block) => toMinute(block.startTime) <= now && toMinute(block.endTime) > now);
    const future = blocks.filter((block) => toMinute(block.startTime) >= now).sort((a, b) => toMinute(a.startTime) - toMinute(b.startTime))[0];
    return active?.cardId ?? current?.cardId ?? future?.cardId ?? null;
  }, [savedPlanFallback.data?.plan]);
  const activeTimer = trpc.timer.getActive.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const startTimer = trpc.timer.start.useMutation({
    onSuccess: async () => {
      await utils.timer.getActive.invalidate();
      toast.success("Timer started");
    },
    onError: (err) => toast.error("Timer failed", { description: err.message }),
  });
  const { data: streakData } = trpc.streak.get.useQuery(undefined, { staleTime: 5 * 60_000 });

  const progressColor = useMemo(() => {
    if (!weeklyHours) return getProgressColor(0);
    return getProgressColor(weeklyHours.totalHours);
  }, [weeklyHours]);

  const handleNav = (id: Section) => {
    setActiveSection(id);
    localStorage.setItem(ACTIVE_SECTION_KEY, id);
    setOpenMobile(false);
  };

  const openTodayMode = (mode: TodayMode) => {
    setTodayMode(mode);
    localStorage.setItem(TODAY_MODE_KEY, mode);
    handleNav("overview");
  };

  const handleWorkQueueStartTimer = (card: WorkQueueCard) => {
    if (!auth.isAuthenticated) {
      toast.error("Sign in required", {
        description: "Starting timers is locked to the signed-in owner.",
      });
      return;
    }
    if (startTimer.isPending) return;
    startTimer.mutate({
      cardId: card.id,
      cardName: card.title,
      cardUrl: card.url,
      boardName: card.boardName,
      listName: card.listName,
    });
  };

  useHotkeys("o", () => handleNav("overview"), { preventDefault: true });
  useHotkeys("t", () => handleNav("triage"), { preventDefault: true });
  useHotkeys("d", () => handleNav("decisions"), { preventDefault: true });
  useHotkeys("s", () => openTodayMode("plan"), { preventDefault: true });
  useHotkeys("p", () => handleNav("performance"), { preventDefault: true });
  useHotkeys("r", () => handleNav("standards"), { preventDefault: true });
  useHotkeys("g", () => handleNav("settings"), { preventDefault: true });

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
        <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
          <div className="flex min-w-0 items-center gap-2.5 px-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <span className="text-sm font-bold">J</span>
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-normal text-sidebar-foreground">Joyce</span>
                <span className="block truncate text-[11px] text-muted-foreground">Work control room</span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 py-3">
          <SidebarMenu className="px-2">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => handleNav(item.id)}
                    tooltip={item.label}
                    className="h-11 rounded-md font-normal"
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm leading-tight">{item.label}</span>
                      {!isCollapsed && isActive && <span className="truncate text-[10px] leading-tight text-muted-foreground">{item.detail}</span>}
                    </span>
                    {item.badge === "compliance" && <ComplianceBadge />}
                    {item.badge === "triage" && (
                      <>
                        <NoDueDateBadge enabled={trelloQueryEnabled} />
                        <TriageSidebarBadge />
                      </>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">J</div>
            {!isCollapsed && <span className="truncate text-sm font-medium text-sidebar-foreground">Joyce</span>}
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="h-8 w-8 rounded-md" />
            <div className="hidden min-w-0 items-center gap-3 md:flex">
              <span className="text-sm font-semibold text-foreground">Joyce Work Control</span>
              <span className="h-4 w-px bg-border" />
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date())}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-md" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <WorkspaceStatusStrip
          todayHours={<TodayHoursChip />}
          hoursUnavailable={hoursUnavailable}
          setupWarnings={setupWarnings}
          onOpenPlan={() => openTodayMode("plan")}
          onNavigate={handleNav}
        />

        <main className="flex-1 overflow-auto bg-muted/20 p-4 lg:p-6">
          {activeSection === "overview" && (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
              <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
                <div><h1 className="text-xl font-semibold text-foreground">Today</h1><p className="mt-1 text-sm text-muted-foreground">Work from one trusted queue, then use the same live context to plan the day.</p></div>
                <Tabs value={todayMode} onValueChange={(value) => { const mode = value as TodayMode; setTodayMode(mode); localStorage.setItem(TODAY_MODE_KEY, mode); }}>
                  <TabsList><TabsTrigger value="queue">Work queue</TabsTrigger><TabsTrigger value="plan" data-testid="today-day-plan">Day plan</TabsTrigger></TabsList>
                </Tabs>
              </div>
              {todayMode === "queue" ? (
                <WorkQueueDashboard
                  trelloDisabledReason={trelloDisabledReason}
                  actionData={trelloQueryEnabled ? actionAlertsData ?? fallbackQueueData : undefined}
                  actionsLoading={!readinessResolved || (trelloQueryEnabled && actionAlertsLoading && !fallbackQueueData)}
                  actionsError={fallbackQueueData ? undefined : actionAlertsError}
                  dataNotice={workQueueDataNotice}
                  activeTimerCardId={activeTimer.data?.cardId ?? null}
                  timerBusy={startTimer.isPending}
                  preferredCardId={preferredPlanCardId}
                  waitingReasons={activeWaitingReasons}
                  onNavigate={handleNav}
                  onStartTimer={handleWorkQueueStartTimer}
                />
              ) : <Suspense fallback={<SectionFallback />}><PlanMyDay /></Suspense>}
            </div>
          )}

          {activeSection === "triage" && <Suspense fallback={<SectionFallback />}><TriagePage /></Suspense>}
          {activeSection === "decisions" && <Suspense fallback={<SectionFallback />}><DecisionsTab /></Suspense>}
          {activeSection === "performance" && <TimeAndPaySection />}

          {activeSection === "standards" && <Suspense fallback={<SectionFallback />}><StandardsTab /></Suspense>}
          {activeSection === "settings" && (
            <SettingsSection
              onGoToSchedule={() => openTodayMode("plan")}
              readiness={readiness}
              readinessError={readinessError}
            />
          )}
        </main>

        <footer className="border-t border-border/50 bg-background px-5 py-3 text-xs text-muted-foreground">Joyce Work Control</footer>
      </SidebarInset>
    </>
  );
}

export default function Home() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const isResizing = useRef(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <HomeInner />
    </SidebarProvider>
  );
}
