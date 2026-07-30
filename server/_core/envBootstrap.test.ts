import { describe, expect, it } from "vitest";
import { normalizeEnvironmentAliases } from "./envBootstrap";

describe("normalizeEnvironmentAliases", () => {
  it("maps legacy Trello names to the canonical production contract", () => {
    const env = {
      TrelloAPIKey: "legacy-key",
      TrelloAPIToken: "legacy-token",
    };

    expect(normalizeEnvironmentAliases(env)).toEqual([
      "TRELLO_API_KEY",
      "TRELLO_TOKEN",
    ]);
    expect(env).toMatchObject({
      TRELLO_API_KEY: "legacy-key",
      TRELLO_TOKEN: "legacy-token",
    });
  });

  it("never replaces canonical values", () => {
    const env = {
      TRELLO_API_KEY: "canonical-key",
      TRELLO_TOKEN: "canonical-token",
      TrelloAPIKey: "legacy-key",
      TrelloAPIToken: "legacy-token",
    };

    expect(normalizeEnvironmentAliases(env)).toEqual([]);
    expect(env.TRELLO_API_KEY).toBe("canonical-key");
    expect(env.TRELLO_TOKEN).toBe("canonical-token");
  });
});
