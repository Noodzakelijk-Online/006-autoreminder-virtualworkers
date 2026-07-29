const EXPECTED_OPERATIONAL_ERROR_FRAGMENTS = [
  "DB not available",
  "Database not available",
  "Trello API credentials not configured",
  "Trello API key not configured",
  "Trello API token not configured",
  "OPENAI_API_KEY is not configured",
  "No APTLSS LLM provider is configured",
  "No daily plan found",
  "No APTLSS plans found",
];

export function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

export function isExpectedOperationalApiError(error: unknown) {
  const message = getApiErrorMessage(error);
  return EXPECTED_OPERATIONAL_ERROR_FRAGMENTS.some((fragment) => message.includes(fragment));
}

export function reportApiError(kind: "Query" | "Mutation", error: unknown) {
  if (isExpectedOperationalApiError(error)) {
    console.info(`[API ${kind} Degraded]`, getApiErrorMessage(error));
    return;
  }

  console.error(`[API ${kind} Error]`, error);
}
