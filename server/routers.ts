import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

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

  trello: router({
    reschedule: protectedProcedure.mutation(async () => {
      try {
        // Run the rescheduling script
        console.log("[Reschedule] Starting global reschedule...");
        const { stdout: rescheduleOut, stderr: rescheduleErr } = await execAsync(
          "cd /home/ubuntu && python3 run_fix.py",
          { timeout: 600000 } // 10 min timeout
        );
        
        if (rescheduleErr) {
          console.warn("[Reschedule] stderr:", rescheduleErr);
        }
        console.log("[Reschedule] stdout:", rescheduleOut);
        
        // Regenerate dashboard
        console.log("[Reschedule] Regenerating dashboard...");
        const { stdout: dashOut, stderr: dashErr } = await execAsync(
          "cd /home/ubuntu && python3 regenerate_dashboard_final.py",
          { timeout: 600000 }
        );
        
        if (dashErr) {
          console.warn("[Dashboard] stderr:", dashErr);
        }
        console.log("[Dashboard] stdout:", dashOut);
        
        // Read the updated tasks.json
        const tasksPath = path.join(process.cwd(), "client/src/data/tasks.json");
        const tasksData = await readFile(tasksPath, "utf-8");
        const tasks = JSON.parse(tasksData);
        
        return {
          success: true,
          message: "Rescheduling completed successfully",
          tasksCount: tasks.length,
        };
      } catch (error) {
        console.error("[Reschedule] Error:", error);
        throw new Error(`Rescheduling failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
