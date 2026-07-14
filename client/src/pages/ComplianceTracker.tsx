import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  DollarSign,
  ExternalLink,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Timer,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { toDateOnlyKey } from "@/lib/dateOnly";
import { addDaysToDateKey, weekBoundsFromDateKey } from "@shared/eatTime";
import {
  buildComplianceChartBuckets,
  buildEvidenceSlides,
  COMPLIANCE_RANGES,
  complianceRangeAverage,
  selectComplianceRange,
  summarizeComplianceRange,
  type ComplianceRangeDays,
} from "@/lib/complianceHistory";

type ComplianceRow = inferRouterOutputs<AppRouter>["compliance"]["getHistory"][number];

function formatDate(value: string | Date): string {
  const key = toDateOnlyKey(value);
  if (!key) return "Unknown date";
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function pctColor(pct: number): string {
  if (pct >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function pctBg(pct: number): string {
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function rangeTone(pct: number): string {
  if (pct >= 90) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (pct >= 70) return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";
}

function getWeekStart(dateStr: string): string {
  const dateKey = toDateOnlyKey(dateStr);
  return dateKey ? weekBoundsFromDateKey(dateKey).startDate : "";
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function MiniBar({ pct, label, title }: { pct: number; label: string; title: string }) {
  return (
    <div className="flex min-w-7 flex-col items-center gap-1" title={`${title}: ${pct}%`}>
      <span className={`text-[10px] font-bold ${pctColor(pct)}`}>{pct}%</span>
      <div className="h-10 w-6 overflow-hidden rounded-t-sm bg-muted">
        <div className={`w-full rounded-t-sm transition-all ${pctBg(pct)}`} style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
      </div>
      <span className="max-w-12 truncate text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

const evidenceLabels: Record<string, string> = {
  joyce_comment: "Joyce comment",
  joyce_proxy_comment: "Joyce-attributed comment",
  human_card_update: "Human Trello comment",
  manual_on_hold_check: "Manual ON-HOLD review",
  none: "No qualifying update",
};

function ComplianceEvidenceDetails({ dateKey }: { dateKey: string }) {
  const { data: rows = [], isLoading } = trpc.compliance.getEvidence.useQuery({ dateKey });
  const { data: communication = [], isLoading: communicationLoading } = trpc.compliance.getCommunicationEvidence.useQuery({ dateKey });
  const { data: time, isLoading: timeLoading } = trpc.timer.getDailyEvidence.useQuery({ date: dateKey });
  if (isLoading || communicationLoading || timeLoading) return <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">Loading verified compliance facts...</p>;
  if (rows.length === 0 && communication.length === 0 && !time?.entryCount) return <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">No source evidence was recorded for this date.</p>;

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      {time && time.entryCount > 0 && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Tracked time</p>
            <p className="text-[10px] text-muted-foreground">
              {formatDuration(time.trackedSeconds)} tracked | {formatDuration(time.targetSeconds)} target | {formatDuration(time.overtimeSeconds)} overtime
            </p>
          </div>
          <div className="divide-y divide-border/50 rounded-md border border-border/60">
            {time.entries.map((entry) => (
              <div key={`${entry.id}-${entry.startedAt.toString()}`} className="grid min-w-0 gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-2">
                  <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                  <div className="min-w-0">
                    <a href={entry.cardUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-medium text-foreground hover:underline">{entry.cardName}</a>
                    <p className="truncate text-[10px] text-muted-foreground">{entry.boardName} | {entry.listName}</p>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-[11px] font-medium text-foreground">{formatDuration(entry.allocatedSeconds)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(entry.startedAt).toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" })} EAT{entry.active ? " | active" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {rows.length > 0 && <p className={`mb-2 text-[11px] font-semibold uppercase text-muted-foreground ${time?.entryCount ? "mt-3" : ""}`}>Card maintenance</p>}
      {rows.length > 0 && <div className="divide-y divide-border/50 rounded-md border border-border/60">
        {rows.map((row) => (
          <div key={row.cardId} className="grid min-w-0 gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 items-start gap-2">
              {row.compliant
                ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
              <div className="min-w-0">
                <a href={row.cardUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-medium text-foreground hover:underline">
                  {row.cardName}
                </a>
                <p className="truncate text-[10px] text-muted-foreground">{row.boardName} | {row.listName} | assigned to Joyce</p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className={`text-[11px] font-medium ${row.compliant ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {evidenceLabels[row.evidenceType] ?? row.evidenceType}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {row.evidenceAt
                  ? `${new Date(row.evidenceAt).toLocaleString("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} EAT | ${row.evidenceActionId ?? "recorded check"}`
                  : "Checked through the 23:00 EAT cutoff"}
              </p>
            </div>
          </div>
        ))}
      </div>}
      {communication.length > 0 && (
        <>
          <p className="mb-2 mt-3 text-[11px] font-semibold uppercase text-muted-foreground">Messages and email</p>
          <div className="divide-y divide-border/50 rounded-md border border-border/60">
            {communication.map((fact) => {
              const passed = fact.outcome === "verified";
              const pending = fact.outcome === "needs_clarification";
              const Icon = fact.kind === "email_processing" ? Mail : MessageSquare;
              return (
                <div key={fact.evidenceKey} className="grid min-w-0 gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${passed ? "text-emerald-500" : pending ? "text-amber-500" : "text-red-500"}`} />
                    <div className="min-w-0">
                      {fact.sourceUrl ? <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-medium text-foreground hover:underline">{fact.title}</a> : <p className="truncate text-xs font-medium text-foreground">{fact.title}</p>}
                      <p className="text-[10px] capitalize text-muted-foreground">{fact.channel} | {fact.kind.replaceAll("_", " ")}</p>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className={`text-[11px] font-medium ${passed ? "text-emerald-600 dark:text-emerald-400" : pending ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {pending ? "Joyce update required" : passed ? "Verified complete" : "Deadline missed"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fact.evidenceType.replaceAll("_", " ")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MissedCards({ row }: { row: ComplianceRow }) {
  const cards = [
    ...row.doingMissedCards.map((card) => ({ ...card, category: "DOING", icon: XCircle, color: "text-red-400" })),
    ...row.onHoldMissedCards.map((card) => ({ ...card, category: "ON-HOLD", icon: AlertTriangle, color: "text-amber-400" })),
  ];
  if (cards.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Cards without qualifying evidence</p>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <a key={`${card.category}-${card.id}`} href={card.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <Icon className={`h-3 w-3 shrink-0 ${card.color}`} />
            <span className="w-16 shrink-0 text-[10px] font-medium">{card.category}</span>
            <span className="truncate">{card.name}</span>
            <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
          </a>
        );
      })}
    </div>
  );
}

function DailyEvidenceRow({
  row,
  open,
  evidenceOpen,
  onToggle,
  onToggleEvidence,
}: {
  row: ComplianceRow;
  open: boolean;
  evidenceOpen: boolean;
  onToggle: () => void;
  onToggleEvidence: () => void;
}) {
  const total = row.onHoldTotal + row.doingTotal
    + Math.max(0, row.messageTotal - row.messageNeedsClarification)
    + Math.max(0, row.emailTotal - row.emailNeedsClarification);
  const done = row.onHoldReviewed + row.doingUpdated + row.messageReplied + row.emailCompleted;
  const weekStart = getWeekStart(row.snapshotDate);
  const statusClass = !row.required
    ? "border-sky-500/20 bg-sky-500/5"
    : row.compliancePct >= 90
      ? "border-emerald-500/20 bg-emerald-500/5"
      : row.compliancePct >= 70
        ? "border-amber-500/20 bg-amber-500/5"
        : "border-red-500/20 bg-red-500/5";

  return (
    <div className={`rounded-lg border ${statusClass}`}>
      <button type="button" className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-3 text-left" aria-expanded={open} onClick={onToggle}>
        <div className="flex min-w-0 items-center gap-2">
          {!row.required ? <ShieldCheck className="h-4 w-4 shrink-0 text-sky-500" />
            : row.compliancePct >= 90 ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              : row.compliancePct >= 70 ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                : <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{formatDate(row.snapshotDate)}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.required
                ? `${done}/${total} checks passed | ${formatDuration(row.trackedSeconds)} tracked | ${formatDuration(row.overtimeSeconds)} overtime`
                : `Protected day | ${row.overtimeSeconds > 0 ? `${formatDuration(row.overtimeSeconds)} emergency overtime` : "no time tracked"}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {row.evidenceCount > 0 && (
            <Badge variant="outline" className="hidden border-emerald-500/30 px-1.5 py-0 text-[10px] text-emerald-600 sm:inline-flex dark:text-emerald-400">
              {row.evidenceCount} facts
            </Badge>
          )}
          <span className={`text-sm font-bold ${row.required ? pctColor(row.compliancePct) : "text-sky-600 dark:text-sky-400"}`}>
            {row.required ? `${row.compliancePct}%` : "Off"}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/50 px-3 pb-3 pt-3">
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${row.required ? pctBg(row.compliancePct) : "bg-sky-500"}`} style={{ width: `${row.required ? row.compliancePct : 100}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {!row.required ? (
              <span>Protected day; no review was required. Any tracked time is recorded as overtime.</span>
            ) : (
              <>
                <span>ON-HOLD reviewed: {row.onHoldReviewed}/{row.onHoldTotal}</span>
                <span>DOING updated: {row.doingUpdated}/{row.doingTotal}</span>
                <span>Messages replied: {row.messageReplied}/{row.messageTotal}</span>
                <span>Emails completed: {row.emailCompleted}/{row.emailTotal}</span>
                {row.clarificationOpen > 0 && <span className="font-medium text-amber-600 dark:text-amber-400">Joyce updates required: {row.clarificationOpen}</span>}
                <span>Verification: {row.verificationStatus.replaceAll("_", " ")}</span>
                {row.verifiedAt && <span>Checked: {new Date(row.verifiedAt).toLocaleString("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} EAT</span>}
              </>
            )}
            <span>Time: {formatDuration(row.trackedSeconds)} / {formatDuration(row.scheduledTargetSeconds)} target</span>
            {row.overtimeSeconds > 0 && <span className="font-medium text-amber-600 dark:text-amber-400">Overtime: {formatDuration(row.overtimeSeconds)}</span>}
          </div>

          {row.required && row.d1Instances > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
              <DollarSign className="h-3 w-3" />
              {row.d1Instances} potential D1 exception{row.d1Instances === 1 ? "" : "s"} | ${row.estimatedPenalty.toFixed(2)} review impact
              <a href={`#performance-pay-log-${weekStart}`} onClick={(event) => {
                event.preventDefault();
                const element = document.getElementById(`pay-log-week-${weekStart}`);
                if (!element) return;
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                element.classList.add("ring-2", "ring-amber-500", "ring-offset-2");
                setTimeout(() => element.classList.remove("ring-2", "ring-amber-500", "ring-offset-2"), 3000);
              }} className="ml-1 text-amber-600 hover:underline dark:text-amber-400">Open pay log</a>
            </div>
          )}

          <MissedCards row={row} />

          {row.evidenceCount > 0 && (
            <Button type="button" variant="outline" size="sm" className="mt-3 h-7 gap-1.5 px-2 text-[11px]" aria-expanded={evidenceOpen} onClick={onToggleEvidence}>
              <ShieldCheck className="h-3 w-3" />
              {evidenceOpen ? "Hide evidence" : `Inspect all ${row.evidenceCount} facts`}
              {evidenceOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
          {evidenceOpen && <ComplianceEvidenceDetails dateKey={row.snapshotDate} />}
        </div>
      )}
    </div>
  );
}

export default function ComplianceTracker() {
  const [expanded, setExpanded] = useState(true);
  const [rangeDays, setRangeDays] = useState<ComplianceRangeDays>(7);
  const [slideOffset, setSlideOffset] = useState(0);
  const [expandedDayDate, setExpandedDayDate] = useState<string | null>(null);
  const [expandedEvidenceDate, setExpandedEvidenceDate] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: history = [], isLoading } = trpc.compliance.getHistory.useQuery({ limit: 370 });
  const range = COMPLIANCE_RANGES.find((option) => option.days === rangeDays) ?? COMPLIANCE_RANGES[0];
  const rangeRows = selectComplianceRange(history, rangeDays);
  const rangeAverage = complianceRangeAverage(rangeRows);
  const performance = summarizeComplianceRange(rangeRows);
  const chartBuckets = buildComplianceChartBuckets(rangeRows, range.chartUnit);
  const slides = buildEvidenceSlides(rangeRows, range.slideUnit);
  const safeSlideOffset = Math.min(slideOffset, Math.max(slides.length - 1, 0));
  const activeSlide = slides[safeSlideOffset];
  const visibleSlideStart = Math.max(0, Math.min(safeSlideOffset - 2, Math.max(slides.length - 5, 0)));
  const visibleSlides = slides.slice(visibleSlideStart, visibleSlideStart + 5);
  const rangeEnd = history[0]?.snapshotDate;
  const rangeStart = rangeEnd ? addDaysToDateKey(rangeEnd, -(rangeDays - 1)) : undefined;

  const recordNow = trpc.compliance.recordNow.useMutation({
    onSuccess: (data) => {
      utils.compliance.getHistory.invalidate();
      toast.success("Snapshot recorded", { description: `Today: ${data.compliancePct}% compliance | ${data.doingTotal} DOING | ${data.onHoldTotal} ON-HOLD` });
    },
    onError: (error) => toast.error("Snapshot failed", { description: error.message }),
  });

  const factCheckHistory = trpc.compliance.factCheckHistory.useMutation({
    onSuccess: (data) => {
      utils.compliance.getHistory.invalidate();
      toast.success("Compliance history fact-checked", { description: `${data.daysChecked} days checked, ${data.changedDays} corrected, ${data.evidenceRows} source facts stored.` });
    },
    onError: (error) => toast.error("Fact-check failed", { description: error.message }),
  });

  const selectRange = (days: ComplianceRangeDays) => {
    setRangeDays(days);
    setSlideOffset(0);
    setExpandedDayDate(null);
    setExpandedEvidenceDate(null);
  };

  return (
    <Card className="border border-border/60">
      <CardContent className="p-0">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-t-lg px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
              <ClipboardList className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Compliance History</p>
              <p className="text-xs text-muted-foreground">Source-backed cards, communication, email processing, and overtime</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${rangeTone(rangeAverage)}`}>
              <TrendingUp className="h-3 w-3" />
              {rangeAverage}% {range.label} avg
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-[11px]" disabled={!rangeStart || factCheckHistory.isPending || recordNow.isPending} onClick={() => rangeStart && rangeEnd && factCheckHistory.mutate({ startDate: rangeStart, endDate: rangeEnd })}>
              <ShieldCheck className={`h-3 w-3 ${factCheckHistory.isPending ? "animate-pulse" : ""}`} />
              {factCheckHistory.isPending ? "Fact-checking..." : `Fact-check ${range.label}`}
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 border-violet-300 px-2.5 text-[11px] text-violet-700 dark:border-violet-700 dark:text-violet-400" disabled={recordNow.isPending || factCheckHistory.isPending} onClick={() => recordNow.mutate()}>
              <RefreshCw className={`h-3 w-3 ${recordNow.isPending ? "animate-spin" : ""}`} />
              {recordNow.isPending ? "Recording..." : "Record now"}
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label={expanded ? "Collapse compliance history" : "Expand compliance history"} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
              {expanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-4 px-5 pb-5">
            <div className="flex w-full overflow-x-auto border-b border-border/60" aria-label="Compliance history range">
              {COMPLIANCE_RANGES.map((option) => (
                <button key={option.days} type="button" className={`min-w-max border-b-2 px-4 py-2 text-xs font-medium transition-colors ${option.days === rangeDays ? "border-violet-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} aria-pressed={option.days === rangeDays} onClick={() => selectRange(option.days)}>
                  {option.label}
                </button>
              ))}
            </div>

            {rangeRows.length > 0 && (
              <section className="overflow-hidden rounded-lg border border-border/60" aria-label="Worker performance signals">
                <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 bg-muted/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Worker Performance Signals</p>
                    <p className="text-[11px] text-muted-foreground">Daily card, communication, Gmail, and timer evidence. Unclear outcomes stay provisional until Joyce responds.</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(rangeRows.at(-1)!.snapshotDate)} to {formatDate(rangeRows[0].snapshotDate)}
                  </p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    { label: "Compliance", value: `${performance.average}%`, detail: `${performance.verifiedDays}/${rangeRows.length} days verified`, tone: pctColor(performance.average) },
                    { label: "Response rate", value: `${performance.messageResponseRate}%`, detail: `${performance.messagesReplied}/${performance.messagesExpected} messages`, tone: performance.messageResponseRate >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400" },
                    { label: "Email completion", value: `${performance.emailCompletionRate}%`, detail: `${performance.emailsCompleted}/${performance.emailsExpected} due`, tone: performance.emailCompletionRate >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400" },
                    { label: "Overtime", value: formatDuration(performance.overtimeSeconds), detail: `${performance.overtimeDays} days | ${formatDuration(performance.trackedSeconds)} tracked`, tone: performance.overtimeSeconds === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400" },
                    { label: "Missed checks", value: performance.missingEvidence.toLocaleString(), detail: "source-confirmed misses", tone: performance.missingEvidence === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400" },
                    { label: "Joyce updates", value: performance.openClarifications.toLocaleString(), detail: `${performance.evidenceRecords} source facts`, tone: performance.openClarifications === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400" },
                  ].map((metric) => (
                    <div key={metric.label} className="min-w-0 px-3 py-3">
                      <p className="truncate text-[10px] font-medium uppercase text-muted-foreground">{metric.label}</p>
                      <p className={`mt-1 text-lg font-semibold ${metric.tone}`}>{metric.value}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{metric.detail}</p>
                    </div>
                  ))}
                </div>
                {chartBuckets.length > 0 && (
                  <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-foreground">{range.chartUnit === "day" ? "Daily" : range.chartUnit === "week" ? "Weekly" : "Monthly"} compliance trend</p>
                        <p className="text-[11px] text-muted-foreground">Protected days are excluded from averages. Hover a bar for its period.</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{rangeRows.length} daily records</span>
                    </div>
                    <div className="flex items-end gap-2 overflow-x-auto pb-1">
                      {chartBuckets.map((bucket) => <MiniBar key={bucket.id} pct={bucket.pct} label={bucket.label} title={bucket.title} />)}
                    </div>
                  </div>
                )}
              </section>
            )}

            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading compliance history...</div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No snapshots yet. The first verified snapshot will be recorded automatically at 23:05 EAT.</div>
            ) : activeSlide ? (
              <section className="overflow-hidden rounded-lg border border-border/60" aria-label="Daily evidence explorer">
                <div className="border-b border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Older period" aria-label="Show older evidence period" disabled={safeSlideOffset >= slides.length - 1} onClick={() => { setSlideOffset((value) => Math.min(value + 1, slides.length - 1)); setExpandedDayDate(null); setExpandedEvidenceDate(null); }}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0 text-center">
                      <p className="truncate text-sm font-semibold text-foreground">{activeSlide.label}</p>
                      <p className="text-[11px] text-muted-foreground">{activeSlide.detail} | {activeSlide.average}% average</p>
                    </div>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Newer period" aria-label="Show newer evidence period" disabled={safeSlideOffset === 0} onClick={() => { setSlideOffset((value) => Math.max(value - 1, 0)); setExpandedDayDate(null); setExpandedEvidenceDate(null); }}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5" aria-label="Evidence periods">
                    {visibleSlides.map((slide, visibleIndex) => {
                      const index = visibleSlideStart + visibleIndex;
                      return (
                      <button key={slide.id} type="button" className={`min-w-0 truncate rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${index === safeSlideOffset ? "border-violet-500 bg-violet-500/10 text-foreground" : "border-border/60 bg-background text-muted-foreground hover:text-foreground"}`} aria-pressed={index === safeSlideOffset} title={slide.label} onClick={() => { setSlideOffset(index); setExpandedDayDate(null); setExpandedEvidenceDate(null); }}>
                        {slide.label} <span className={pctColor(slide.average)}>{slide.average}%</span>
                      </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Daily evidence</p>
                      <p className="text-[11px] text-muted-foreground">Open a day for totals, missed cards, verification time, and exact card facts.</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{activeSlide.rows.length} day{activeSlide.rows.length === 1 ? "" : "s"}</Badge>
                  </div>
                  {activeSlide.rows.map((row) => (
                    <DailyEvidenceRow
                      key={row.id}
                      row={row}
                      open={expandedDayDate === row.snapshotDate}
                      evidenceOpen={expandedEvidenceDate === row.snapshotDate}
                      onToggle={() => {
                        setExpandedDayDate((current) => current === row.snapshotDate ? null : row.snapshotDate);
                        if (expandedDayDate === row.snapshotDate) setExpandedEvidenceDate(null);
                      }}
                      onToggleEvidence={() => setExpandedEvidenceDate((current) => current === row.snapshotDate ? null : row.snapshotDate)}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">No daily evidence exists in this range yet. Run the range fact-check to build it.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
