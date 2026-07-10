import type { User } from "../../drizzle/schema";

export const DISABLE_OWNER_LOGIN_ENV = "JOYCE_DISABLE_OWNER_LOGIN";

export function isOwnerLoginDisabled() {
  return process.env[DISABLE_OWNER_LOGIN_ENV]?.trim().toLowerCase() === "true" && process.env.NODE_ENV !== "production";
}

export function getTemporaryOwnerOpenId() {
  return process.env.OWNER_OPEN_ID?.trim() || process.env.LOCAL_AUTH_OPEN_ID?.trim() || "joyce-login-disabled";
}

export function createLocalAuthUser({
  openId,
  name,
  email,
  ownerOpenId,
}: {
  openId: string;
  name: string;
  email?: string | null;
  ownerOpenId?: string | null;
}): User {
  const now = new Date();
  return {
    id: 0,
    openId,
    name,
    email: email ?? null,
    loginMethod: "local-token",
    role: ownerOpenId && ownerOpenId === openId ? "admin" : "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export function createTemporaryOwnerBypassUser(): User {
  const openId = getTemporaryOwnerOpenId();
  return createLocalAuthUser({
    openId,
    name: process.env.LOCAL_AUTH_NAME?.trim() || "Joyce",
    email: process.env.LOCAL_AUTH_EMAIL?.trim() || null,
    ownerOpenId: openId,
  });
}
