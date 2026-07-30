import "dotenv/config";

type Environment = Record<string, string | undefined>;

const ENVIRONMENT_ALIASES = [
  ["TRELLO_API_KEY", "TrelloAPIKey"],
  ["TRELLO_TOKEN", "TrelloAPIToken"],
] as const;

export function normalizeEnvironmentAliases(env: Environment = process.env) {
  const normalized: string[] = [];

  for (const [canonicalName, legacyName] of ENVIRONMENT_ALIASES) {
    if (env[canonicalName]?.trim()) continue;

    const legacyValue = env[legacyName]?.trim();
    if (!legacyValue) continue;

    env[canonicalName] = legacyValue;
    normalized.push(canonicalName);
  }

  return normalized;
}

normalizeEnvironmentAliases();
