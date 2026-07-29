import { afterEach, describe, expect, it } from "vitest";
import {
  assertLocalAuthBypassConfiguration,
  isAllowedLocalBypassRole,
  isLocalAuthBypassEnabled,
  isLoopbackAddress,
} from "./_core/localAuthBypass";

const original = {
  bypass: process.env.LOCAL_AUTH_BYPASS,
  nodeEnv: process.env.NODE_ENV,
  host: process.env.HOST,
};

afterEach(() => {
  if (original.bypass === undefined) delete process.env.LOCAL_AUTH_BYPASS;
  else process.env.LOCAL_AUTH_BYPASS = original.bypass;
  if (original.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = original.nodeEnv;
  if (original.host === undefined) delete process.env.HOST;
  else process.env.HOST = original.host;
});

describe("local auth bypass guard", () => {
  it("is disabled unless explicitly enabled", () => {
    delete process.env.LOCAL_AUTH_BYPASS;
    expect(isLocalAuthBypassEnabled()).toBe(false);
  });

  it("accepts only loopback host forms", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("localhost")).toBe(true);
    expect(isLoopbackAddress("0.0.0.0")).toBe(false);
    expect(isLoopbackAddress("192.168.1.5")).toBe(false);
  });

  it("allows only operational roles for an explicit local identity", () => {
    expect(isAllowedLocalBypassRole("worker")).toBe(true);
    expect(isAllowedLocalBypassRole("admin")).toBe(true);
    expect(isAllowedLocalBypassRole("user")).toBe(false);
    expect(isAllowedLocalBypassRole(undefined)).toBe(false);
  });

  it("rejects production bypass", () => {
    process.env.LOCAL_AUTH_BYPASS = "true";
    process.env.NODE_ENV = "production";
    process.env.HOST = "127.0.0.1";
    expect(() => assertLocalAuthBypassConfiguration()).toThrow(/production/);
  });

  it("rejects non-loopback development binds", () => {
    process.env.LOCAL_AUTH_BYPASS = "true";
    process.env.NODE_ENV = "development";
    process.env.HOST = "0.0.0.0";
    expect(() => assertLocalAuthBypassConfiguration()).toThrow(/loopback/);
  });

  it("allows explicit loopback development use", () => {
    process.env.LOCAL_AUTH_BYPASS = "true";
    process.env.NODE_ENV = "development";
    process.env.HOST = "127.0.0.1";
    expect(() => assertLocalAuthBypassConfiguration()).not.toThrow();
  });
});
