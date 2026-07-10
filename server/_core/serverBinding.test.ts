import { describe, expect, it } from "vitest";
import { assertOwnerBypassHost, resolveServerHost } from "./serverBinding";

describe("server binding security", () => {
  it("binds local development to loopback by default", () => {
    expect(resolveServerHost(undefined, "development")).toBe("127.0.0.1");
  });

  it("uses a network interface by default in production", () => {
    expect(resolveServerHost(undefined, "production")).toBe("0.0.0.0");
  });

  it("rejects disabled login on a non-loopback interface", () => {
    expect(() => assertOwnerBypassHost("0.0.0.0", true)).toThrow(/localhost/);
    expect(() => assertOwnerBypassHost("192.168.1.20", true)).toThrow(/localhost/);
  });

  it("allows normal authenticated serving on a network interface", () => {
    expect(() => assertOwnerBypassHost("0.0.0.0", false)).not.toThrow();
  });
});
