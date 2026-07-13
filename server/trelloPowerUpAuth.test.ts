import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { verifyPowerUpToken } from "./trelloPowerUpAuth";

vi.mock("axios", () => ({
  default: { get: vi.fn() },
}));

describe("Power-Up Trello authorization", () => {
  beforeEach(() => {
    vi.stubEnv("TRELLO_POWERUP_API_KEY", "power-up-key");
    vi.stubEnv("TRELLO_POWERUP_ALLOWED_MEMBER_IDS", "joyce-id,joyce-user");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("accepts a Trello-verified Joyce member", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { id: "joyce-id", username: "joyce-user", fullName: "Joyce" } });

    await expect(verifyPowerUpToken("allowed-token-1")).resolves.toMatchObject({ id: "joyce-id" });
    expect(axios.get).toHaveBeenCalledWith(
      "https://api.trello.com/1/members/me",
      expect.objectContaining({ params: expect.objectContaining({ key: "power-up-key", token: "allowed-token-1" }) }),
    );
  });

  it("rejects a valid Trello token belonging to an unapproved member", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { id: "other-id", username: "other-user" } });

    await expect(verifyPowerUpToken("disallowed-token-2")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed when Trello rejects the token", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("401"));

    await expect(verifyPowerUpToken("invalid-token-3")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires a dedicated Power-Up API key", async () => {
    vi.stubEnv("TRELLO_POWERUP_API_KEY", "");

    await expect(verifyPowerUpToken("missing-key-token-4")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(axios.get).not.toHaveBeenCalled();
  });
});
