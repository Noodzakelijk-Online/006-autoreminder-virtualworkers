import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertOwnerAccess, OWNER_OPEN_ID_MISSING_MESSAGE } from "./ownerAccess";

describe("owner access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when OWNER_OPEN_ID is missing", () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    vi.stubEnv("JOYCE_DISABLE_OWNER_LOGIN", "");

    expect(() => assertOwnerAccess({ openId: "user-1" })).toThrow(TRPCError);
    expect(() => assertOwnerAccess({ openId: "user-1" })).toThrow(OWNER_OPEN_ID_MISSING_MESSAGE);
  });

  it("rejects authenticated users who are not the owner", () => {
    vi.stubEnv("OWNER_OPEN_ID", "owner-1");

    expect(() => assertOwnerAccess({ openId: "user-1" }, "Audit log")).toThrow("Audit log is restricted to the project owner.");
  });

  it("allows the configured owner", () => {
    vi.stubEnv("OWNER_OPEN_ID", "owner-1");

    expect(() => assertOwnerAccess({ openId: "owner-1" })).not.toThrow();
  });

  it("allows the temporary local owner bypass outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OWNER_OPEN_ID", "");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "joyce-local");
    vi.stubEnv("JOYCE_DISABLE_OWNER_LOGIN", "true");

    expect(() => assertOwnerAccess({ openId: "joyce-local" })).not.toThrow();
    expect(() => assertOwnerAccess({ openId: "other-user" })).toThrow(OWNER_OPEN_ID_MISSING_MESSAGE);
  });

  it("ignores the temporary bypass in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OWNER_OPEN_ID", "");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "joyce-local");
    vi.stubEnv("JOYCE_DISABLE_OWNER_LOGIN", "true");

    expect(() => assertOwnerAccess({ openId: "joyce-local" })).toThrow(OWNER_OPEN_ID_MISSING_MESSAGE);
  });
});
