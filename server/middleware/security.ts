import type { NextFunction, Request, Response } from "express";

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

export function getRequestBodyLimit(env = process.env) {
  const configured = env.REQUEST_BODY_LIMIT?.trim().toLowerCase();
  return configured && /^\d+(?:b|kb|mb)$/.test(configured) ? configured : "2mb";
}
