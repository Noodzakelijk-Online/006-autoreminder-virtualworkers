export type PriorityResult = {
  label: string;
  description: string;
  tone: string;
};

export const PRIORITY_CLASSIFIER_QUESTIONS: Array<{ question: string; yes: PriorityResult }> = [
  { question: "Is there legal, housing, court, police, insurance, or irreversible-loss risk?", yes: { label: "P0: Act immediately", description: "Preserve evidence first, then act and document the result.", tone: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" } },
  { question: "Is Robert blocked or waiting for an answer right now?", yes: { label: "P1: Resolve within one hour", description: "Prepare the recommendation, then ask Robert a focused question if needed.", tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300" } },
  { question: "Is the task overdue or due today?", yes: { label: "P1: Stabilize today", description: "Confirm the commitment, correct the due date if needed, and record the next action.", tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300" } },
  { question: "Is a client, contractor, or other external party waiting?", yes: { label: "P2: Resolve today", description: "Reply or provide a useful status update before end of day.", tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" } },
  { question: "Is this blocking another task, person, or delivery?", yes: { label: "P2: Unblock the workflow", description: "Remove the dependency or record the exact escalation needed today.", tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" } },
  { question: "Is it a recurring scheduled task?", yes: { label: "P3: Use its scheduled window", description: "Keep the work in its daily or weekly block.", tone: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300" } },
  { question: "Can it be completed safely in three minutes or less?", yes: { label: "P4: Do it now", description: "Finish the small task without deferring it.", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" } },
];

export const DEFAULT_PRIORITY_RESULT: PriorityResult = {
  label: "P5: Schedule or defer",
  description: "Add it to the right Trello backlog or future work slot after current obligations are stable.",
  tone: "border-border bg-muted/50 text-foreground",
};

export const PRIORITY_MATRIX = [
  { level: "P0", name: "Prevent loss", trigger: "Legal, housing, court, police, insurance, safety, or evidence risk", response: "Preserve evidence and act immediately", tone: "text-red-700 dark:text-red-300" },
  { level: "P1", name: "Stabilize today", trigger: "Robert blocked, overdue work, or a commitment due today", response: "Resolve within one hour or establish a documented recovery", tone: "text-orange-700 dark:text-orange-300" },
  { level: "P2", name: "Unblock delivery", trigger: "An external party or downstream task is waiting", response: "Reply, follow up, or remove the dependency today", tone: "text-amber-700 dark:text-amber-300" },
  { level: "P3", name: "Run the routine", trigger: "Recurring work with a protected schedule", response: "Complete it in the assigned daily or weekly window", tone: "text-blue-700 dark:text-blue-300" },
  { level: "P4", name: "Quick completion", trigger: "A safe task requiring three minutes or less", response: "Complete and document it now", tone: "text-emerald-700 dark:text-emerald-300" },
  { level: "P5", name: "Schedule or defer", trigger: "Useful work without current urgency or dependency impact", response: "Place it in the correct backlog or future plan", tone: "text-muted-foreground" },
] as const;

export const EXECUTION_ORDER = [
  "Prevent irreversible loss and preserve evidence.",
  "Resolve decisions that are actively blocking Robert.",
  "Stabilize overdue and due-today commitments.",
  "Respond to clients, contractors, and external parties waiting.",
  "Remove dependencies blocking other work.",
  "Complete protected recurring routines in their scheduled windows.",
  "Finish safe three-minute tasks, then schedule the remaining backlog.",
] as const;
