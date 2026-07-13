import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  ENV: { notificationApiUrl: "", notificationApiKey: "" },
}));

import { notifyOwner } from "./notification";

describe("optional owner notifications", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("does not fail completed work when delivery is not configured", async () => {
    await expect(notifyOwner({ title: "Job complete", content: "The durable job finished." })).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still rejects invalid notification payloads", async () => {
    await expect(notifyOwner({ title: " ", content: "Valid content" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
