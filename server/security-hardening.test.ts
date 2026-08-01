import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import handoffRoutes from "./routes/handoff";
import communicationRoutes from "./routes/communication";
import metricsRoutes from "./routes/metrics";
import { getRequestBodyLimit, securityHeaders } from "./middleware/security";

describe("HTTP security defaults", () => {
  it("uses a bounded request body by default and accepts an explicit override", () => {
    expect(getRequestBodyLimit({} as NodeJS.ProcessEnv)).toBe("2mb");
    expect(getRequestBodyLimit({ REQUEST_BODY_LIMIT: "4mb" } as NodeJS.ProcessEnv)).toBe("4mb");
    expect(getRequestBodyLimit({ REQUEST_BODY_LIMIT: "unbounded" } as NodeJS.ProcessEnv)).toBe("2mb");
  });

  it("sets baseline browser security headers", async () => {
    const app = express();
    app.use(securityHeaders);
    app.get("/", (_req, res) => res.json({ ok: true }));

    const response = await request(app).get("/").expect(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["permissions-policy"]).toContain("camera=()");
  });

  it("rejects unauthenticated legacy worker mutations", async () => {
    const app = express();
    app.use(express.json());
    app.use("/handoff", handoffRoutes);
    app.use("/communication", communicationRoutes);

    await request(app).post("/handoff/notes").send({ taskId: "card", workerId: 1, notes: "note" }).expect(401);
    await request(app).post("/communication/ask-founder").send({ taskId: "card", workerId: 1, question: "?" }).expect(401);
  });

  it("does not let root-mounted metrics routes intercept unrelated API paths", async () => {
    const app = express();
    app.use(metricsRoutes);
    app.get("/trpc/auth.me", (_req, res) => res.json({ reached: true }));

    await request(app).get("/trpc/auth.me").expect(200, { reached: true });
    await request(app).get("/metrics/performance").expect(401, { error: "Unauthorized" });
  });
});
