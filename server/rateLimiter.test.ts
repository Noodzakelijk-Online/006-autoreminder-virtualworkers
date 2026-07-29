import { describe, expect, it } from "vitest";
import { isAptlssExpensiveRequest } from "./middleware/rate-limiter";

describe("APTLSS generation rate-limit scope", () => {
  it("limits APTLSS mutations only", () => {
    expect(isAptlssExpensiveRequest("POST", "/aptlss/generate")).toBe(true);
    expect(isAptlssExpensiveRequest("POST", "/aptlss/generate-batch")).toBe(true);
    expect(isAptlssExpensiveRequest("DELETE", "/aptlss/scheduled/1")).toBe(true);
    expect(isAptlssExpensiveRequest("GET", "/aptlss/history")).toBe(false);
    expect(isAptlssExpensiveRequest("GET", "/trpc/auth.me")).toBe(false);
    expect(isAptlssExpensiveRequest("POST", "/trello/cards/1/status")).toBe(false);
  });
});
