export function resolveServerHost(configuredHost: string | undefined, _nodeEnv: string | undefined) {
  return configuredHost?.trim() || "127.0.0.1";
}

export function displayServerHost(host: string) {
  if (host === "0.0.0.0" || host === "::") return "127.0.0.1";
  return host;
}
