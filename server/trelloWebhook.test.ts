import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { authorizeTrelloWebhook, shouldRefreshAptlssForAction, verifyTrelloSignature } from "./trelloWebhook";

const body = JSON.stringify({ action: { type: "updateCard" } });
const callbackUrl = "https://example.test/api/trello/webhook";
const secret = "test-secret";
const signature = crypto.createHmac("sha1", secret).update(body + callbackUrl).digest("base64");

describe("Trello webhook authorization", () => {
  it("accepts a valid Trello signature", () => {
    expect(verifyTrelloSignature(body, callbackUrl, signature, secret)).toBe(true);
    expect(authorizeTrelloWebhook({ body, callbackUrl, signature, secret, production: true })).toMatchObject({ ok: true });
  });

  it("rejects missing and invalid signatures when a secret is configured", () => {
    expect(authorizeTrelloWebhook({ body, callbackUrl, secret, production: true })).toMatchObject({ ok: false, status: 401 });
    expect(authorizeTrelloWebhook({ body, callbackUrl, signature: "invalid", secret, production: true })).toMatchObject({ ok: false, status: 401 });
  });

  it("fails closed in production when the secret is absent", () => {
    expect(authorizeTrelloWebhook({ body, callbackUrl, production: true })).toMatchObject({ ok: false, status: 503 });
  });

  it("allows unsigned local-development events with an explicit degraded marker", () => {
    expect(authorizeTrelloWebhook({ body, callbackUrl, production: false })).toEqual({ ok: true, unsignedDevelopmentRequest: true });
  });
});

describe("APTLSS webhook intelligence triggers", () => {
  it.each([
    "updateCard",
    "commentCard",
    "addMemberToCard",
    "addLabelToCard",
    "addAttachmentToCard",
    "updateCheckItemStateOnCard",
  ])("reassesses material event %s", (actionType) => {
    expect(shouldRefreshAptlssForAction(actionType)).toBe(true);
  });

  it("ignores unrelated board administration events", () => {
    expect(shouldRefreshAptlssForAction("updateBoard")).toBe(false);
  });
});
