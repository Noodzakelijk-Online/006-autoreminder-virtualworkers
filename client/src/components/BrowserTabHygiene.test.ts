import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserExtensionSetupBanner } from "./BrowserTabHygiene";

const mocks = vi.hoisted(() => ({
  status: {
    connected: false,
    status: "disconnected",
    ageMinutes: null as number | null,
    policy: { enabled: true },
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    browserTabs: {
      getStatus: { useQuery: vi.fn(() => ({ data: mocks.status, isLoading: false })) },
      getCollectorSetup: { useQuery: vi.fn(() => ({ data: { extensionDirectory: "C:\\Joyce\\browser-extension" } })) },
    },
  },
}));

describe("BrowserExtensionSetupBanner", () => {
  beforeEach(() => {
    mocks.status.connected = false;
    mocks.status.status = "disconnected";
    mocks.status.ageMinutes = null;
  });

  it("keeps the required one-time Chrome approval visible while disconnected", () => {
    const html = renderToStaticMarkup(React.createElement(BrowserExtensionSetupBanner, { onOpenSettings: vi.fn() }));

    expect(html).toContain("Finish browser organization setup");
    expect(html).toContain("Load unpacked");
    expect(html).toContain("Copy extension folder");
  });

  it("disappears after the collector starts reporting", () => {
    mocks.status.connected = true;
    const html = renderToStaticMarkup(React.createElement(BrowserExtensionSetupBanner, { onOpenSettings: vi.fn() }));

    expect(html).toBe("");
  });
});
