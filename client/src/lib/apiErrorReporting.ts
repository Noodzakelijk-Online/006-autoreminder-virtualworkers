import { UNAUTHED_ERR_MSG } from "@shared/const";

const EXPECTED_OPERATIONAL_ERROR_FRAGMENTS = [
  "DB not available",
  "Database not available",
  "Trello API credentials not configured",
  "Trello API key not configured",
  "Trello API token not configured",
  "BUILT_IN_FORGE_API_KEY is not configured",
  "OWNER_OPEN_ID is not configured",
  "Local owner login is not configured",
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

export function isUnauthorizedApiError(error: unknown) {
  return getApiErrorMessage(error) === UNAUTHED_ERR_MSG;
}

export function isExpectedOperationalApiError(error: unknown) {
  const message = getApiErrorMessage(error);
  return EXPECTED_OPERATIONAL_ERROR_FRAGMENTS.some((fragment) => message.includes(fragment));
}

export function reportApiError(kind: "Query" | "Mutation", error: unknown) {
  if (isUnauthorizedApiError(error)) {
    console.info(`[API ${kind} Auth]`, getApiErrorMessage(error));
    return;
  }

  if (isExpectedOperationalApiError(error)) {
    console.info(`[API ${kind} Degraded]`, getApiErrorMessage(error));
    return;
  }

  console.error(`[API ${kind} Error]`, error);
}
