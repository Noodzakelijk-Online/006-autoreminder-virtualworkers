import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  TrendingUp,
  DollarSign,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

// ─── MiniBar chart ────────────────────────────────────────────────────────────
function MiniBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-bold ${pctColor(pct)}`}>{pct}%</span>
      <div className="w-6 bg-muted rounded-t-sm overflow-hidden" style={{ height: 40 }}>
        <div
          className={`w-full rounded-t-sm transition-all ${pctBg(pct)}`}
          style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ComplianceTracker() {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const utils = trpc.useUtils();
  const { data: history = [], isLoading } = trpc.compliance.getHistory.useQuery({ limit: 30 });
  const { data: avgData } = trpc.compliance.getRollingAvg.useQuery({ days: 7 });
  const rollingAvg = avgData?.avg ?? 100;

  const recordNow = trpc.compliance.recordNow.useMutation({
    onSuccess: (data) => {
      utils.compliance.getHistory.invalidate();
      utils.compliance.getRollingAvg.invalidate();
      toast.success("Snapshot recorded", {
        description: `Today: ${data.compliancePct}% compliance — ${data.doingTotal} DOING, ${data.onHoldTotal} ON-HOLD${data.d1Instances > 0 ? `, ${data.d1Instances} D1 demerit${data.d1Instances > 1 ? 's' : ''}` : ''}`,
      });
    },
    onError: (err) => toast.error("Snapshot failed", { description: err.message }),
  });

  const displayRows = showAll ? history : history.slice(0, 14);

  // Last 14 days for the mini bar chart (oldest → newest)
  const chartRows = [...history].slice(0, 14).reverse();

  return (
    <Card className="border border-border/60">
      <CardContent className="p-0">
        {/* ── Section header ── */}
        <div className="flex w-full items-center justify-between rounded-t-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Compliance History</p>
              <p className="text-xs text-muted-foreground">Daily ON-HOLD &amp; DOING card review rate</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 7-day rolling avg chip */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              rollingAvg >= 90
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : rollingAvg >= 70
                ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
            }`}>
              <TrendingUp className="w-3 h-3" />
              {rollingAvg}% 7-day avg
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-[11px] gap-1.5 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
              disabled={recordNow.isPending}
              onClick={(e) => { e.stopPropagation(); recordNow.mutate(); }}
            >
              <RefreshCw className={`w-3 h-3 ${recordNow.isPending ? 'animate-spin' : ''}`} />
              {recordNow.isPending ? 'Recording…' : 'Record now'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={expanded ? "Collapse compliance history" : "Expand compliance history"}
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="px-5 pb-5 space-y-4">
            {/* ── Mini bar chart ── */}
            {chartRows.length > 0 && (
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Last {chartRows.length} days</p>
                <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
                  {chartRows.map((row) => (
                    <MiniBar
                      key={row.snapshotDate}
                      pct={row.compliancePct}
                      label={new Date(row.snapshotDate).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Table ── */}
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Loading compliance history…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No snapshots yet. The first snapshot will be recorded automatically at 22:30 EAT.
              </div>
            ) : (
              <div className="space-y-2">
                {displayRows.map((row) => {
                  const total = row.onHoldTotal + row.doingTotal;
                  const done = row.onHoldReviewed + row.doingUpdated;
                  const weekStart = getWeekStart(row.snapshotDate);

                  return (
                    <div
                      key={row.id}
                      className={`rounded-xl border p-4 ${
                        row.compliancePct >= 90
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : row.compliancePct >= 70
                          ? "border-amber-500/20 bg-amber-500/5"
                          : "border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      {/* Row header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {row.compliancePct >= 90 ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          ) : row.compliancePct >= 70 ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-foreground">{formatDate(row.snapshotDate)}</span>
                          {row.source === "manual" && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">manual</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${pctColor(row.compliancePct)}`}>
                            {row.compliancePct}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {done}/{total} cards
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full transition-all ${pctBg(row.compliancePct)}`}
                          style={{ width: `${row.compliancePct}%` }}
                        />
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>ON-HOLD: {row.onHoldReviewed}/{row.onHoldTotal}</span>
                        <span>DOING: {row.doingUpdated}/{row.doingTotal}</span>
                        {row.d1Instances > 0 && (
                          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                            <DollarSign className="w-3 h-3" />
                            {row.d1Instances} D1 demerit{row.d1Instances > 1 ? "s" : ""}
                            {" · "}
                            <span>−${(row.estimatedPenalty).toFixed(2)}</span>
                            {/* → Pay log link */}
                            <a
                              href={`#performance-pay-log-${weekStart}`}
                              onClick={(e) => {
                                e.preventDefault();
                                // Scroll to the pay log section and highlight the week
                                const el = document.getElementById(`pay-log-week-${weekStart}`);
                                if (el) {
                                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                                  el.classList.add("ring-2", "ring-amber-500", "ring-offset-2");
                                  setTimeout(() => el.classList.remove("ring-2", "ring-amber-500", "ring-offset-2"), 3000);
                                }
                              }}
                              className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 hover:underline ml-1"
                            >
                              → Pay log
                            </a>
                          </span>
                        )}
                      </div>

                      {/* Missed cards */}
                      {(row.doingMissedCards.length > 0 || row.onHoldMissedCards.length > 0) && (
                        <div className="mt-3 space-y-1.5">
                          {row.doingMissedCards.slice(0, 5).map((card) => (
                            <a
                              key={card.id}
                              href={card.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                              <span className="truncate">{card.name}</span>
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
                            </a>
                          ))}
                          {row.onHoldMissedCards.slice(0, 3).map((card) => (
                            <a
                              key={card.id}
                              href={card.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                              <span className="truncate">{card.name}</span>
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
                            </a>
                          ))}
                          {(row.doingMissedCards.length > 5 || row.onHoldMissedCards.length > 3) && (
                            <p className="text-[10px] text-muted-foreground">
                              +{Math.max(0, row.doingMissedCards.length - 5) + Math.max(0, row.onHoldMissedCards.length - 3)} more missed cards
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {history.length > 14 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? "Show less" : `Show all ${history.length} days`}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
