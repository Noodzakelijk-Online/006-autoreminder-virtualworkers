import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { runReplyMonitorScan } from "./cronJobs";
import { runTrackedJob } from "./scheduledJobsDb";
import { ownerProcedure as protectedProcedure, router } from "./_core/trpc";
import {
  getActiveUnsignedFlags,
  getActiveVagueReplyFlags,
  getAllReplyThreads,
  getAllUnsignedFlags,
  getAllVagueReplyFlags,
  getPendingReplyThreads,
  getReplyMonitorStatus,
  resolveUnsignedFlag,
  resolveVagueReplyFlag,
} from "./replyMonitorDb";

export const replyMonitorRouter = router({
  getStatus: protectedProcedure.query(() => getReplyMonitorStatus()),

  getPendingThreads: protectedProcedure.query(() => getPendingReplyThreads()),

  getAllThreads: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional() }))
    .query(({ input }) => getAllReplyThreads(input.limit ?? 100)),

  getActiveVagueFlags: protectedProcedure.query(() => getActiveVagueReplyFlags()),

  getAllVagueFlags: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional() }))
    .query(({ input }) => getAllVagueReplyFlags(input.limit ?? 50)),

  resolveVagueFlag: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await resolveVagueReplyFlag(input.id);
      return { success: true };
    }),

  triggerScan: protectedProcedure.mutation(async () => {
    const status = await runTrackedJob({
      jobKey: "reply_monitor",
      trigger: "manual",
      run: async () => {
        await runReplyMonitorScan({ sendNotifications: false });
        const result = await getReplyMonitorStatus();
        if (result.state !== "success") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.errorMessage || "Reply Monitor scan did not complete successfully.",
          });
        }
        return result;
      },
      summarize: (result) => ({
        recordsProcessed: result.threadsScanned,
        detail: `${result.threadsScanned} Trello threads scanned manually`,
      }),
    });
    return {
      success: true,
      message: "Scan completed",
      threadsScanned: status.threadsScanned,
      completedAt: status.lastCompletedAt,
    };
  }),

  getActiveUnsignedFlags: protectedProcedure.query(() => getActiveUnsignedFlags()),

  getAllUnsignedFlags: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional() }))
    .query(({ input }) => getAllUnsignedFlags(input.limit ?? 50)),

  resolveUnsignedFlag: protectedProcedure
    .input(z.object({ id: z.number().int(), note: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      await resolveUnsignedFlag(input.id, input.note);
      return { success: true };
    }),
});
