const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function resolveServerHost(configuredHost: string | undefined, nodeEnv: string | undefined) {
  return configuredHost?.trim() || (nodeEnv === "development" ? "127.0.0.1" : "0.0.0.0");
}

export function displayServerHost(host: string) {
  return LOOPBACK_HOSTS.has(host) ? "localhost" : host;
}
