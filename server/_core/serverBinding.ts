const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function resolveServerHost(configuredHost: string | undefined, nodeEnv: string | undefined) {
  return configuredHost?.trim() || (nodeEnv === "development" ? "127.0.0.1" : "0.0.0.0");
}

export function assertOwnerBypassHost(host: string, ownerLoginDisabled: boolean) {
  if (ownerLoginDisabled && !LOOPBACK_HOSTS.has(host)) {
    throw new Error("JOYCE_DISABLE_OWNER_LOGIN may only be used while the server is bound to localhost.");
  }
}

export function displayServerHost(host: string) {
  return LOOPBACK_HOSTS.has(host) ? "localhost" : host;
}
