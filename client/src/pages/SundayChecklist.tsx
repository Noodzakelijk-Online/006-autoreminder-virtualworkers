import { useEffect, useRef, useState } from "react";
import { Battery, CheckCircle2, Circle, Clock, FolderOpen, Laptop, ListTodo, Mail, MessageSquare, Monitor, Target } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/InfoTooltip";

function getRelevantSunday() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + diff);
  return sunday.toISOString().slice(0, 10);
}

type ChecklistKey =
  | "trelloArchived" | "trelloLabels" | "trelloDeadlines" | "trelloTimers"
  | "emailInbox" | "whatsappCleared" | "upworkArchived"
  | "downloadsCleared" | "desktopCleared" | "browserTabsClosed"
  | "weekReviewed" | "nextWeekPlanned";

type ChecklistState = Record<ChecklistKey, boolean>;

type ChecklistItem = {
  key: ChecklistKey;
  icon: React.ElementType;
  title: string;
  description: string;
  group: string;
};

const ITEMS: ChecklistItem[] = [
  { key: "trelloArchived", icon: CheckCircle2, title: "Archive completed cards", description: "Move completed cards out of active lists.", group: "Trello maintenance" },
  { key: "trelloLabels", icon: CheckCircle2, title: "Review labels", description: "Remove outdated labels and correct active ones.", group: "Trello maintenance" },
  { key: "trelloDeadlines", icon: Clock, title: "Review due dates", description: "Update stale deadlines only when the new date is known.", group: "Trello maintenance" },
  { key: "trelloTimers", icon: Clock, title: "Review time logs", description: "Check that this week's tracked time is attached to the right cards.", group: "Trello maintenance" },
  { key: "emailInbox", icon: Mail, title: "Review imported email", description: "Confirm that no imported email still requires action.", group: "Communication" },
  { key: "whatsappCleared", icon: MessageSquare, title: "Review WhatsApp", description: "Check for unresolved work messages without clearing personal conversations.", group: "Communication" },
  { key: "upworkArchived", icon: MessageSquare, title: "Review Upwork conversations", description: "Archive only conversations that are conclusively inactive.", group: "Communication" },
  { key: "downloadsCleared", icon: FolderOpen, title: "Review Downloads", description: "Move useful files before removing disposable files.", group: "Workspace" },
  { key: "desktopCleared", icon: Laptop, title: "Organize desktop", description: "Move work files to their correct project folders.", group: "Workspace" },
  { key: "browserTabsClosed", icon: Monitor, title: "Review browser tabs", description: "Save useful references before closing tabs.", group: "Workspace" },
  { key: "weekReviewed", icon: ListTodo, title: "Review the week", description: "Capture completed work, unresolved risks, and lessons.", group: "Weekly review" },
  { key: "nextWeekPlanned", icon: Target, title: "Prepare next week", description: "Choose three priorities without scheduling Sunday work.", group: "Weekly review" },
];

const GROUPS = ["Trello maintenance", "Communication", "Workspace", "Weekly review"];

const DEFAULT_STATE: ChecklistState = {
  trelloArchived: false,
  trelloLabels: false,
  trelloDeadlines: false,
  trelloTimers: false,
  emailInbox: false,
  whatsappCleared: false,
  upworkArchived: false,
  downloadsCleared: false,
  desktopCleared: false,
  browserTabsClosed: false,
  weekReviewed: false,
  nextWeekPlanned: false,
};

export default function SundayChecklist() {
  const sundayDate = getRelevantSunday();
  const [state, setState] = useState<ChecklistState>(DEFAULT_STATE);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedState = trpc.sunday.getByDate.useQuery({ date: sundayDate });
  const upsert = trpc.sunday.upsert.useMutation();

  useEffect(() => {
    if (!savedState.data) return;
    setState({
      trelloArchived: savedState.data.trelloArchived ?? false,
      trelloLabels: savedState.data.trelloLabels ?? false,
      trelloDeadlines: savedState.data.trelloDeadlines ?? false,
      trelloTimers: savedState.data.trelloTimers ?? false,
      emailInbox: savedState.data.emailInbox ?? false,
      whatsappCleared: savedState.data.whatsappCleared ?? false,
      upworkArchived: savedState.data.upworkArchived ?? false,
      downloadsCleared: savedState.data.downloadsCleared ?? false,
      desktopCleared: savedState.data.desktopCleared ?? false,
      browserTabsClosed: savedState.data.browserTabsClosed ?? false,
      weekReviewed: savedState.data.weekReviewed ?? false,
      nextWeekPlanned: savedState.data.nextWeekPlanned ?? false,
    });
  }, [savedState.data]);

  function toggle(key: ChecklistKey) {
    setState((current) => {
      const next = { ...current, [key]: !current[key] };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => upsert.mutate({ sundayDate, ...next }), 800);
      return next;
    });
  }

  const completedCount = Object.values(state).filter(Boolean).length;
  const allDone = completedCount === ITEMS.length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Battery className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Weekly reset</h2>
                <Badge variant="outline">Optional</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Sunday remains Joyce's protected day off. Open only the area that is genuinely useful; unfinished items do not become overdue work.
              </p>
            </div>
          </div>
          <Badge variant={allDone ? "default" : "secondary"}>{completedCount}/{ITEMS.length} complete</Badge>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completedCount / ITEMS.length) * 100}%` }} />
        </div>
      </section>

      {savedState.error ? (
        <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-muted-foreground">
          Weekly reset history is unavailable. Checklist changes are not confirmed as saved.
        </section>
      ) : (
        <Accordion type="multiple" className="rounded-lg border border-border bg-card px-4 shadow-sm">
          {GROUPS.map((group) => {
            const items = ITEMS.filter((item) => item.group === group);
            const completed = items.filter((item) => state[item.key]).length;
            return (
              <AccordionItem key={group} value={group}>
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex flex-1 items-center justify-between gap-3 pr-2"><span>{group}</span><Badge variant="secondary">{completed}/{items.length}</Badge></span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-2">
                  {items.map((item) => {
                    const done = state[item.key];
                    const Icon = item.icon;
                    return (
                      <button key={item.key} type="button" onClick={() => toggle(item.key)} className="flex w-full items-center gap-3 rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-accent">
                        {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className={`flex-1 text-sm font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.title}</span>
                        <InfoTooltip content={item.description} side="left" />
                      </button>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
