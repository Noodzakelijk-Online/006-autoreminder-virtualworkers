import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, DollarSign, AlertTriangle, History } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { dateOnlyAtNoon, toDateOnlyKey } from "@/lib/dateOnly";
import { differenceInDateKeys } from "@shared/eatTime";
import { useEatClock } from "@/hooks/useEatClock";

function formatDate(d: string | Date | null | undefined): string {
  const date = dateOnlyAtNoon(d);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

/** Returns the number of whole calendar days between now and a target date.
 *  Positive = future, 0 = today, negative = overdue.
 */
function calcDaysUntil(dateValue: string | Date | null | undefined, todayDate: string): number {
  const targetDate = toDateOnlyKey(dateValue);
  return targetDate ? differenceInDateKeys(targetDate, todayDate) : 0;
}

export default function PaymentTracker() {
  const { dateKey: todayDate } = useEatClock(60_000);
  const [showHistory, setShowHistory] = useState(false);

  const utils = trpc.useUtils();

  const { data: currentCycle, isLoading: cycleLoading } = trpc.payment.getCurrentCycle.useQuery();
  const { data: allCycles, isLoading: historyLoading } = trpc.payment.getAllCycles.useQuery();

  const markPaid = trpc.payment.markPaid.useMutation({
    onSuccess: () => {
      utils.payment.getCurrentCycle.invalidate();
      utils.payment.getAllCycles.invalidate();
      toast.success("Payment recorded", { description: "The cycle has been marked as paid and the next cycle has been created." });
    },
    onError: (err) => {
      toast.error("Error", { description: err.message });
    },
  });
  const initializeCurrent = trpc.payment.initializeCurrent.useMutation({
    onSuccess: (cycle) => {
      void utils.payment.getCurrentCycle.invalidate();
      void utils.payment.getAllCycles.invalidate();
      toast.success("Payment cycle ready", { description: `${formatDate(cycle.cycleStart)} through ${formatDate(cycle.cycleEnd)}` });
    },
    onError: (err) => toast.error("Cycle setup failed", { description: err.message }),
  });

  const daysUntil = calcDaysUntil(currentCycle?.cycleEnd, todayDate);
  const isOverdue = daysUntil < 0;
  const isDueToday = daysUntil === 0;
  const isDueSoon = daysUntil > 0 && daysUntil <= 3;

  const statusBadge = isOverdue
    ? { label: `${Math.abs(daysUntil)}d Overdue`, variant: "destructive" as const }
    : isDueToday
    ? { label: "Due Today", variant: "default" as const }
    : isDueSoon
    ? { label: `Due in ${daysUntil}d`, variant: "default" as const }
    : { label: `${daysUntil} days away`, variant: "secondary" as const };

  const paidCycles = allCycles?.filter(c => c.isPaid) ?? [];

  return (
    <div className="space-y-4">
      {/* Current Cycle Card */}
      <Card className="overflow-hidden border border-border shadow-sm">
        <div className="bg-card p-5 text-foreground">
          <div className="flex items-center gap-2.5 mb-3">
            <DollarSign className="w-5 h-5" />
            <h2 className="text-base font-bold">Payment Tracker</h2>
            {currentCycle && (
              <Badge variant={isOverdue ? "destructive" : "secondary"} className="ml-auto text-[10px]">
                {statusBadge.label}
              </Badge>
            )}
          </div>

          {cycleLoading || historyLoading ? (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">Checking payment records...</div>
          ) : currentCycle ? (
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-[10px] opacity-70 uppercase tracking-wide mb-0.5">Cycle Start</p>
                  <p className="font-bold text-sm">{formatDate(currentCycle.cycleStart)}</p>
                </div>
                <div>
                  <p className="text-[10px] opacity-70 uppercase tracking-wide mb-0.5">Pay Date</p>
                  <p className="font-bold text-sm">{formatDate(currentCycle.cycleEnd)}</p>
                </div>
                <div>
                  <p className="text-[10px] opacity-70 uppercase tracking-wide mb-0.5">Base Amount</p>
                  <p className="font-bold text-sm">${Number(currentCycle.baseAmount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] opacity-70 uppercase tracking-wide mb-0.5">Status</p>
                  <p className="font-bold text-sm flex items-center gap-1">
                    {isOverdue ? (
                      <><AlertTriangle className="w-3.5 h-3.5" /> Overdue</>
                    ) : isDueToday ? (
                      <><Clock className="w-3.5 h-3.5" /> Due Today</>
                    ) : (
                      <><Clock className="w-3.5 h-3.5" /> {daysUntil}d remaining</>
                    )}
                  </p>
                </div>
              </div>

              {currentCycle.notes && (
                <p className="mb-3 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">{currentCycle.notes}</p>
              )}

              <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={markPaid.isPending}
                      className="h-9 w-full text-sm font-semibold"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {markPaid.isPending ? "Recording..." : "Mark as Paid"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Payment Received</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to mark this payment cycle as paid? This action cannot be undone.
                        {currentCycle.baseAmount && (
                          <span className="block mt-2 font-medium text-foreground">
                            Base amount: ${Number(currentCycle.baseAmount).toFixed(2)}
                          </span>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => markPaid.mutate({ cycleId: currentCycle.id })}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        Yes, Mark as Paid
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-center">
              {allCycles?.length ? <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" /> : <DollarSign className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />}
              <p className="font-semibold text-sm">{allCycles?.length ? "All recorded cycles are paid" : "No payment cycle configured"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{allCycles?.length ? "There is no unpaid cycle in the payment ledger." : "No payment records exist, so payment status cannot be confirmed here."}</p>
              <Button className="mt-4 h-9" onClick={() => initializeCurrent.mutate()} disabled={initializeCurrent.isPending}>
                <DollarSign className="mr-2 h-4 w-4" />
                {initializeCurrent.isPending ? "Creating cycle..." : allCycles?.length ? "Open current cycle" : "Create current cycle"}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Payment History */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-slate-400 to-slate-600"></div>
              <h2 className="text-base font-bold text-foreground">Payment History</h2>
              <Badge variant="secondary" className="text-[10px]">{paidCycles.length} paid</Badge>
            </div>
            <History className="w-4 h-4 text-muted-foreground" />
          </button>

          {showHistory && (
            <div className="mt-4 space-y-2">
              {historyLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading history...</p>
              ) : paidCycles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No payment history yet.</p>
              ) : (
                [...paidCycles].reverse().map(cycle => (
                  <div key={cycle.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {formatDate(cycle.cycleStart)} – {formatDate(cycle.cycleEnd)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Paid {cycle.paidAt ? formatDate(cycle.paidAt) : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        ${Number(cycle.baseAmount).toFixed(2)}
                      </p>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-700">Paid</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
