import crypto from "crypto";
import type { Request, Response } from "express";

type ScheduledAuthFailure = {
  status: 401 | 503;
  error: string;
};

function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization ?? "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

function tokenEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function getScheduledTaskAuthFailure(req: Request): ScheduledAuthFailure | null {
  const expectedToken = process.env.SCHEDULED_TASK_SECRET?.trim();

  if (!expectedToken) {
    if (process.env.NODE_ENV !== "production") return null;
    return {
      status: 503,
      error: "Scheduled task secret is not configured",
    };
  }

  const token = getBearerToken(req);
  if (!token || !tokenEquals(token, expectedToken)) {
    return {
      status: 401,
      error: "Unauthorized",
    };
  }

  return null;
}

export function assertScheduledTaskAuthorized(req: Request, res: Response): boolean {
  const failure = getScheduledTaskAuthFailure(req);
  if (!failure) return true;
  res.status(failure.status).json({ error: failure.error });
  return false;
}
