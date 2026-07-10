import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

// Expandable comment preview — shows 1 line by default, expands on click
function ExpandableComment({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 80;
  return (
    <div
      className="text-[10px] text-muted-foreground/60 italic cursor-pointer select-none"
      onClick={e => { e.preventDefault(); e.stopPropagation(); if (isLong) setExpanded(v => !v); }}
      title={isLong ? (expanded ? "Click to collapse" : "Click to expand") : undefined}
    >
      <span className={expanded ? "" : "line-clamp-1"}>
        "{text}"
      </span>
      {isLong && !expanded && (
        <span className="ml-1 text-primary/60 not-italic font-medium">more</span>
      )}
    </div>
  );
}

type UpdateFilter = "all" | "comments" | "moves" | "created";

type UpdateItem = {
  id: string;
  type: string;
  date: string;
  cardName: string;
  cardUrl: string;
  text?: string | null;
  memberName: string;
  listBefore?: string | null;
  listAfter?: string | null;
  boardName?: string | null;
};

const COLLAPSED_KEY = "joyce-recent-updates-collapsed";

function getActionMeta(type: string, listAfter?: string | null) {
  const isComment = type === "commentCard";
  const isCreate = type === "createCard";
  const isMove = type === "updateCard" && !!listAfter;
  const isCheck = type === "updateCheckItemStateOnCard";
  const label = isComment
    ? "commented"
    : isCreate
    ? "created"
    : isMove
    ? "moved"
    : type === "addMemberToCard"
    ? "added member"
    : type === "removeMemberFromCard"
    ? "removed member"
    : type.replace(/([A-Z])/g, " $1").toLowerCase();
  const badgeClass = isComment
    ? "bg-blue-500/15 text-blue-400 border-blue-500/25"
    : isCreate
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
    : isMove
    ? "bg-violet-500/15 text-violet-400 border-violet-500/25"
    : "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return { isComment, isCreate, isMove, isCheck, label, badgeClass };
}

function relativeTime(dateStr: string) {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecentUpdatesWidget({
  updates,
  isLoading,
  disabledReason,
}: {
  updates: UpdateItem[];
  isLoading: boolean;
  disabledReason?: string;
}) {
  const [filter, setFilter] = useState<UpdateFilter>("comments");
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  });

  function toggleCollapsed() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, String(next));
  }

  // Exclude checked-item noise from all views
  const visibleUpdates = updates.filter(
    (u) => u.type !== "updateCheckItemStateOnCard"
  );

  const FILTERS: { key: UpdateFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: visibleUpdates.length },
    {
      key: "comments",
      label: "Comments",
      count: visibleUpdates.filter((u) => u.type === "commentCard").length,
    },
    {
      key: "moves",
      label: "Moves",
      count: visibleUpdates.filter((u) => u.type === "updateCard" && !!u.listAfter)
        .length,
    },
    {
      key: "created",
      label: "Created",
      count: visibleUpdates.filter((u) => u.type === "createCard").length,
    },
  ];

  const filtered = visibleUpdates
    .filter((u) => {
      if (filter === "all") return true;
      if (filter === "comments") return u.type === "commentCard";
      if (filter === "moves") return u.type === "updateCard" && !!u.listAfter;
      if (filter === "created") return u.type === "createCard";
      return true;
    })
    .slice(0, 14);

  // Summary counts for collapsed state
  const commentCount = visibleUpdates.filter((u) => u.type === "commentCard").length;
  const totalCount = visibleUpdates.length;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        {/* Header — always visible, click to collapse/expand */}
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-between mb-0 group"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand Recent Updates" : "Collapse Recent Updates"}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-sm text-foreground">
                Recent Updates
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isCollapsed
                  ? `${commentCount} comment${commentCount !== 1 ? "s" : ""} · ${totalCount} total`
                  : "Latest Trello activity"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && !isCollapsed && (
              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
            )}
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/60 group-hover:text-foreground group-hover:bg-muted/50 transition-all">
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </div>
          </div>
        </button>

        {/* Collapsible body */}
        {!isCollapsed && (
          <div className="mt-3">
            {/* Filter chips */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    filter === f.key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span
                    className={`text-[10px] tabular-nums ${
                      filter === f.key ? "opacity-80" : "opacity-60"
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Grid */}
            {disabledReason ? (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-6 text-center">
                <Activity className="w-6 h-6 text-amber-500/70 mx-auto mb-2" />
                <p className="text-xs font-medium text-foreground">Recent Trello updates unavailable</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{disabledReason}</p>
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[320px] overflow-y-auto pr-1">
                {filtered.map((update) => {
                  const { isMove, label, badgeClass } = getActionMeta(
                    update.type,
                    update.listAfter
                  );
                  const timeStr = relativeTime(update.date);
                  return (
                    <a
                      key={update.id}
                      href={update.cardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col gap-1 p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/50 hover:border-border/70 transition-all group"
                    >
                      {/* Row 1: badge + time + link icon */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeClass} uppercase tracking-wide flex-shrink-0`}
                        >
                          {label}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                            {timeStr}
                          </span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                        </div>
                      </div>

                      {/* Row 2: card name */}
                      <p className="font-semibold text-xs text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {update.cardName}
                      </p>

                      {/* Row 3: move arrow OR comment preview */}
                      {isMove && update.listBefore && update.listAfter ? (
                        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                          <span className="truncate max-w-[80px]">
                            {update.listBefore}
                          </span>
                          <span className="flex-shrink-0">→</span>
                          <span className="truncate max-w-[80px] text-violet-400">
                            {update.listAfter}
                          </span>
                        </p>
                      ) : update.text ? (
                        <ExpandableComment text={update.text} />
                      ) : null}

                      {/* Row 4: board chip + member */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {update.boardName && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/60 text-muted-foreground/70 border border-border/30 truncate max-w-[120px]">
                            {update.boardName}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/50">
                          {update.memberName}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              !isLoading && (
                <div className="bg-muted/40 rounded-lg p-6 text-center">
                  <Activity className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {visibleUpdates.length > 0
                      ? `No ${filter} found`
                      : "No recent updates"}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
