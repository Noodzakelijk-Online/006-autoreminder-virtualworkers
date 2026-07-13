import { createHash } from "crypto";
import axios from "axios";
import { TRPCError } from "@trpc/server";

const TRELLO_API_BASE = "https://api.trello.com/1";
const DEFAULT_ALLOWED_MEMBERS = new Set([
  "joyjemimajj1",
  "664ed797b37eb4605ed64bc1",
  "noodzakelijkonline",
]);
const CACHE_TTL_MS = 5 * 60_000;

type VerifiedMember = { id: string; username: string; fullName?: string };
const tokenCache = new Map<string, { member: VerifiedMember; expiresAt: number }>();

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function allowedMemberIds() {
  const configured = process.env.TRELLO_POWERUP_ALLOWED_MEMBER_IDS
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured?.length ? new Set(configured) : DEFAULT_ALLOWED_MEMBERS;
}

export async function verifyPowerUpToken(token: string): Promise<VerifiedMember> {
  const trimmed = token.trim();
  if (!trimmed) throw new TRPCError({ code: "UNAUTHORIZED", message: "Authorize the Joyce Power-Up with Trello first." });
  const apiKey = process.env.TRELLO_POWERUP_API_KEY?.trim();
  if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "TRELLO_POWERUP_API_KEY is not configured." });

  const hash = tokenHash(trimmed);
  const cached = tokenCache.get(hash);
  if (cached && cached.expiresAt > Date.now()) return cached.member;

  let member: VerifiedMember;
  try {
    const response = await axios.get<VerifiedMember>(`${TRELLO_API_BASE}/members/me`, {
      params: { key: apiKey, token: trimmed, fields: "id,username,fullName" },
      timeout: 10_000,
    });
    member = response.data;
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Trello rejected the Power-Up authorization token." });
  }

  const allowed = allowedMemberIds();
  if (!allowed.has(member.id.toLowerCase()) && !allowed.has(member.username.toLowerCase())) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This Trello member is not allowed to operate Joyce's Power-Up." });
  }

  if (tokenCache.size > 100) {
    tokenCache.forEach((value, key) => {
      if (value.expiresAt <= Date.now()) tokenCache.delete(key);
    });
  }
  tokenCache.set(hash, { member, expiresAt: Date.now() + CACHE_TTL_MS });
  return member;
}
