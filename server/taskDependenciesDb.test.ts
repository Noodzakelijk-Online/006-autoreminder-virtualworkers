import { describe, expect, it } from "vitest";
import { analyzeAptlssPortfolio } from "./aptlssPortfolio";
import { mergeDependencyEdges } from "./taskDependenciesDb";

describe("durable task dependencies", () => {
  it("injects persisted edges into portfolio analysis without dropping embedded steps", () => {
    const cards = mergeDependencyEdges([
      { id: "foundation", name: "Foundation", steps: [] },
      { id: "launch", name: "Launch", steps: [{ status: "open", blockedBy: "approval" }] },
    ], [
      { cardId: "launch", dependsOnCardId: "foundation", source: "manual" },
      { cardId: "launch", dependsOnCardId: "foundation", source: "trello" },
    ]);

    expect(cards[1].steps).toEqual([
      { status: "open", blockedBy: "approval" },
      { status: "open", blockedBy: null, dependsOnCards: ["foundation"] },
    ]);
    expect(analyzeAptlssPortfolio(cards).byCard.get("foundation")?.directDependentCount).toBe(1);
  });
});
