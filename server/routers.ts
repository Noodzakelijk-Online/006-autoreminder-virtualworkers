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
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { runAllPhases } = await import('./services/atis-phases-service');
          const result = await runAllPhases(input.taskId, String(ctx.user.id), '');
          return result;
        } catch (error) {
          console.error('[ATIS Analysis tRPC] Error:', error);
          throw error;
        }
      }),
  }),

  scheduling: router({
    bulkComplete: protectedProcedure
      .input(z.object({
        taskIds: z.array(z.string()),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.taskIds.length === 0) {
          throw new Error("No tasks selected");
        }
        
        return {
          success: true,
          completed: input.taskIds.length,
          completedTasks: input.taskIds.map(id => ({ taskId: id, status: 'completed' })),
          timestamp: new Date().toISOString()
        };
      }),

    bulkIncomplete: protectedProcedure
      .input(z.object({
        taskIds: z.array(z.string()),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.taskIds.length === 0) {
          throw new Error("No tasks selected");
        }
        
        return {
          success: true,
          incompleted: input.taskIds.length,
          incompletedTasks: input.taskIds.map(id => ({ taskId: id, status: 'in_progress' })),
          timestamp: new Date().toISOString()
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
