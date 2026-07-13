import type { User } from "../../drizzle/schema";

export const JOYCE_SINGLE_USER_OPEN_ID = "joyce-single-user";

export function createJoyceSingleUser(): User {
  const now = new Date();
  return {
    id: 0,
    openId: JOYCE_SINGLE_USER_OPEN_ID,
    name: "Joyce",
    email: null,
    loginMethod: "single-user",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}
