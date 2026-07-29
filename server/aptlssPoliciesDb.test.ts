import { describe, expect, it } from "vitest";
import { resolvePolicyBoolean, resolvePolicyNumberSetting } from "./aptlssPoliciesDb";

describe("operational policy semantics", () => {
  it("treats a disabled boolean rule as disabled instead of restoring its default", () => {
    expect(resolvePolicyBoolean({ enabled: 0, value: "true" }, true)).toBe(false);
  });

  it("uses defaults only when a policy has not been configured", () => {
    expect(resolvePolicyBoolean(null, true)).toBe(true);
    expect(resolvePolicyNumberSetting(null, 5)).toEqual({ value: 5, enabled: true });
  });

  it("clamps configured thresholds while preserving enabled state", () => {
    expect(resolvePolicyNumberSetting({ enabled: 1, value: "999" }, 5, { min: 1, max: 30 })).toEqual({ value: 30, enabled: true });
    expect(resolvePolicyNumberSetting({ enabled: 0, value: "3" }, 5, { min: 1, max: 30 })).toEqual({ value: 3, enabled: false });
  });
});
