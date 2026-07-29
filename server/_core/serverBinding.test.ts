import { describe, expect, it } from "vitest";
import { displayServerHost, resolveServerHost } from "./serverBinding";

describe("server binding security", () => {
  it("binds local development to loopback by default", () => {
    expect(resolveServerHost(undefined, "development")).toBe("127.0.0.1");
  });

  it("keeps production on loopback unless network access is explicitly configured", () => {
    expect(resolveServerHost(undefined, "production")).toBe("127.0.0.1");
  });

  it("honors an explicit network binding", () => {
    expect(resolveServerHost("0.0.0.0", "production")).toBe("0.0.0.0");
  });

  it("prints a deterministic IPv4 URL for wildcard bindings", () => {
    expect(displayServerHost("127.0.0.1")).toBe("127.0.0.1");
    expect(displayServerHost("0.0.0.0")).toBe("127.0.0.1");
  });
});
