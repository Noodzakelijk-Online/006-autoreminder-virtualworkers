import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env");
const original = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const lines = original ? original.split(/\r?\n/) : [];
const generatedKeys = [];

function generatedSecret() {
  return crypto.randomBytes(36).toString("base64url");
}

function ensureValue(key, factory) {
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  const current = index >= 0 ? lines[index].slice(key.length + 1).trim() : "";
  if (current && !current.startsWith("replace-with-")) return;
  const nextLine = `${key}=${factory()}`;
  if (index >= 0) lines[index] = nextLine;
  else lines.push(nextLine);
  generatedKeys.push(key);
}

ensureValue("JWT_SECRET", generatedSecret);
ensureValue("LOCAL_AUTH_TOKEN", generatedSecret);
ensureValue("LOCAL_AUTH_OPEN_ID", () => "joyce-local");
ensureValue("SCHEDULED_TASK_SECRET", generatedSecret);
ensureValue("JOYCE_DISABLE_OWNER_LOGIN", () => "false");

fs.writeFileSync(envPath, `${lines.filter((line, index) => line || index < lines.length - 1).join("\n").replace(/\n*$/, "")}\n`, "utf8");
console.log(generatedKeys.length ? `Provisioned local values for: ${generatedKeys.join(", ")}` : "Local security values are already provisioned.");
