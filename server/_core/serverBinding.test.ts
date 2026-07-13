import { describe, expect, it } from "vitest";
import { resolveServerHost } from "./serverBinding";

describe("server binding security", () => {
  it("binds local development to loopback by default", () => {
    expect(resolveServerHost(undefined, "development")).toBe("127.0.0.1");
  });

  it("uses a network interface by default in production", () => {
    expect(resolveServerHost(undefined, "production")).toBe("0.0.0.0");
  });

});
