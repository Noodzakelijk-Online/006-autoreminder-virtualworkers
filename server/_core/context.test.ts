import { describe, expect, it } from "vitest";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createContext } from "./context";

function createContextOptions(): CreateExpressContextOptions {
  return {
    req: { headers: {} } as CreateExpressContextOptions["req"],
    res: {} as CreateExpressContextOptions["res"],
  };
}

describe("createContext single-user mode", () => {
  it("always exposes Joyce's internal operator identity", async () => {
    const ctx = await createContext(createContextOptions());

    expect(ctx.user).toMatchObject({
      id: 0,
      openId: "joyce-single-user",
      name: "Joyce",
      role: "admin",
      loginMethod: "single-user",
    });
  });
});
