import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";
import { getTemporaryOwnerOpenId, isOwnerLoginDisabled } from "./localAuthUser";

export const OWNER_OPEN_ID_MISSING_MESSAGE =
  "OWNER_OPEN_ID is not configured; owner-only monitoring is locked until production owner identity is set.";

export function assertOwnerAccess(user: Pick<User, "openId">, resource = "Admin monitoring") {
  const ownerOpenId = process.env.OWNER_OPEN_ID?.trim();

  if (isOwnerLoginDisabled() && user.openId === getTemporaryOwnerOpenId()) {
    return;
  }

  if (!ownerOpenId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: OWNER_OPEN_ID_MISSING_MESSAGE,
    });
  }

  if (user.openId !== ownerOpenId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${resource} is restricted to the project owner.`,
    });
  }
}
