import { describe, expect, it, vi } from "vitest";
import {
  getApiErrorMessage,
  isExpectedOperationalApiError,
  reportApiError,
} from "./apiErrorReporting";

describe("api error reporting", () => {
  it("extracts messages from normal Error objects and TRPC-like objects", () => {
    expect(getApiErrorMessage(new Error("DB not available"))).toBe("DB not available");
    expect(getApiErrorMessage({ message: "Trello API credentials not configured" })).toBe("Trello API credentials not configured");
  });

  it("classifies setup and degraded errors", () => {
    expect(isExpectedOperationalApiError(new Error("DB not available"))).toBe(true);
    expect(isExpectedOperationalApiError(new Error("Trello API credentials not configured"))).toBe(true);
    expect(isExpectedOperationalApiError(new Error("OPENAI_API_KEY is not configured"))).toBe(true);
    expect(isExpectedOperationalApiError(new Error("Unexpected crash"))).toBe(false);
  });

  it("logs expected operational errors as info and unexpected errors as errors", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportApiError("Query", new Error("Trello API credentials not configured"));
    reportApiError("Mutation", new Error("OPENAI_API_KEY is not configured"));
    reportApiError("Mutation", new Error("Unexpected crash"));

    expect(infoSpy).toHaveBeenCalledWith("[API Query Degraded]", "Trello API credentials not configured");
    expect(infoSpy).toHaveBeenCalledWith("[API Mutation Degraded]", "OPENAI_API_KEY is not configured");
    expect(errorSpy).toHaveBeenCalledWith("[API Mutation Error]", expect.any(Error));

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
