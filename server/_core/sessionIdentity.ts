type Environment = Record<string, string | undefined>;

const DEFAULT_SESSION_AUDIENCE = "va-dashboard";

export function getSessionAudience(env: Environment = process.env) {
  return env.SESSION_APP_ID?.trim()
    || env.VITE_APP_ID?.trim()
    || DEFAULT_SESSION_AUDIENCE;
}
