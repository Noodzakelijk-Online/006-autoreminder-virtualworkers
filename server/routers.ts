import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invalidateCache } from "./services/trello-cache";
import { interviewRouter } from "./routes/interview";
import { settingsRouter } from "./routes/settings";
import { atisTaskSelectorRouter } from "./routes/atis-task-selector";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  interview: interviewRouter,
  settings: settingsRouter,
  atis: router({
    ...atisTaskSelectorRouter,
    startAnalysis: protectedProcedure
      .input(z.object({
        taskId: z.string(),
        taskDescription: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const userId = ctx.user?.openId;
          if (!userId) {
            throw new Error('User not authenticated');
          }

          // Import and call the ATIS phases analysis
          const { runAllPhases } = await import('./services/atis-phases-service.js');
          const result = await runAllPhases(input.taskId, userId, input.taskDescription);
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[ATIS Analysis tRPC] Error:', error);
          throw error;
        }
      }),
  }),

  trello: router({
    reschedule: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const user = ctx.user;
        if (!user) {
          throw new Error("User not authenticated");
        }

        console.log("[Reschedule] Starting reschedule for user:", user.openId);
        
        // Invalidate the cache to force a fresh fetch and reschedule
        // The APTLSS scheduling algorithm will automatically reschedule tasks
        // when the cache is invalidated and tasks are re-fetched
        await invalidateCache(user.id, user.openId, 'tasks');
        
        console.log("[Reschedule] Cache invalidated, tasks will be rescheduled on next fetch");
        
        return {
          success: true,
          message: "Cache cleared. Tasks will be rescheduled on next refresh.",
          note: "The APTLSS scheduling algorithm will automatically reschedule all tasks based on your current working hours settings.",
        };
      } catch (error) {
        console.error("[Reschedule] Error:", error);
        throw new Error(`Rescheduling failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  }),

  tasks: router({
    bulkComplete: protectedProcedure
      .input(z.object({
        taskIds: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        if (input.taskIds.length === 0) {
          throw new Error("No tasks selected");
        }
        // TODO: Implement bulk complete logic
        // This will update Trello checklist items for all selected tasks
        return {
          success: true,
          completed: input.taskIds.length,
        };
      }),

    bulkIncomplete: protectedProcedure
      .input(z.object({
        taskIds: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        if (input.taskIds.length === 0) {
          throw new Error("No tasks selected");
        }
        // TODO: Implement bulk incomplete logic
        // This will mark Trello checklist items as incomplete for all selected tasks
        return {
          success: true,
          incompleted: input.taskIds.length,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
