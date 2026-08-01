type Environment = Record<string, string | undefined>;

export function isLocalRegistrationAllowed(env: Environment = process.env) {
  return env.NODE_ENV !== "production";
}
