import { afterEach, describe, expect, it, vi } from "vitest";
import { getScheduledTaskAuthFailure } from "./scheduledAuth";
import type { Request } from "express";

function requestWithAuth(authorization?: string): Request {
  return {
    headers: authorization ? { authorization } : {},
  } as Request;
}

describe("scheduled task auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows local development calls when no scheduled task secret is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "");

    expect(getScheduledTaskAuthFailure(requestWithAuth())).toBeNull();
  });

  it("fails closed in production when no scheduled task secret is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "");

    expect(getScheduledTaskAuthFailure(requestWithAuth())).toEqual({
      status: 503,
      error: "Scheduled task secret is not configured",
    });
  });

  it("rejects missing or wrong bearer tokens when a secret is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "expected-secret");

    expect(getScheduledTaskAuthFailure(requestWithAuth())).toMatchObject({ status: 401 });
    expect(getScheduledTaskAuthFailure(requestWithAuth("Bearer wrong-secret"))).toMatchObject({ status: 401 });
  });

  it("accepts the configured bearer token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "expected-secret");

    expect(getScheduledTaskAuthFailure(requestWithAuth("Bearer expected-secret"))).toBeNull();
  });
});
