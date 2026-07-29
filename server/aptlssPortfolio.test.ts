import { describe, expect, it } from "vitest";
import { analyzeAptlssPortfolio, parseCardReferences } from "./aptlssPortfolio";

describe("APTLSS portfolio intelligence", () => {
  it("finds transitive impact and ranks the upstream bottleneck", () => {
    const result = analyzeAptlssPortfolio([
      { id: "a", name: "Foundation", steps: [] },
      { id: "b", name: "Launch", steps: [{ status: "open", dependsOnCards: '["a"]' }] },
      { id: "c", name: "Campaign", steps: [{ status: "open", blockedBy: "b" }] },
    ]);

    expect(result.byCard.get("a")).toMatchObject({ directDependentCount: 1, transitiveDependentCount: 2 });
    expect(result.byCard.get("c")?.criticalPathDepth).toBe(2);
    expect(result.bottlenecks[0].cardId).toBe("a");
  });

  it("detects dependency cycles without recursing indefinitely", () => {
    const result = analyzeAptlssPortfolio([
      { id: "a", name: "A", steps: [{ status: "open", dependsOnCards: ["b"] }] },
      { id: "b", name: "B", steps: [{ status: "open", dependsOnCards: ["a"] }] },
    ]);

    expect(result.cycles).toEqual([["a", "b"]]);
    expect(result.byCard.get("a")?.isInDependencyCycle).toBe(true);
    expect(result.byCard.get("b")?.bottleneckScore).toBeGreaterThanOrEqual(30);
  });

  it("resolves names and Trello URLs while preserving orphan evidence", () => {
    const result = analyzeAptlssPortfolio([
      { id: "abc123", name: "Client brief", state: "DONE_CONFIRMED", steps: [] },
      { id: "work", name: "Delivery", steps: [{ status: "open", dependsOnCards: "Client brief; https://trello.com/c/abc123; missing-card" }] },
    ]);

    expect(result.byCard.get("work")?.unresolvedDependencyIds).toEqual([]);
    expect(result.byCard.get("work")?.orphanReferences).toEqual(["missing-card"]);
    expect(parseCardReferences('["a", "b", "a"]')).toEqual(["a", "b"]);
  });

  it("does not label an unconnected card as a bottleneck", () => {
    const result = analyzeAptlssPortfolio([{ id: "a", name: "A", steps: [] }]);
    expect(result.byCard.get("a")?.bottleneckScore).toBe(0);
    expect(result.bottlenecks).toEqual([]);
  });
});
