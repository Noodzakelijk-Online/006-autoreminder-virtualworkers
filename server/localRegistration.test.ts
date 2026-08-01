import { describe, expect, it } from "vitest";
import { isLocalRegistrationAllowed } from "./_core/localRegistration";

describe("local registration guard", () => {
  it("allows account setup during local development", () => {
    expect(isLocalRegistrationAllowed({ NODE_ENV: "development" })).toBe(true);
  });

  it("rejects public production registration", () => {
    expect(isLocalRegistrationAllowed({ NODE_ENV: "production" })).toBe(false);
  });
});
