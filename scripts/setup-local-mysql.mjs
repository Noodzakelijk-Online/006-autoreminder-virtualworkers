import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const envPath = path.join(projectRoot, ".env");
const dbEnvPath = path.join(projectRoot, ".env.db.local");

const containerName = process.env.JOYCE_DB_CONTAINER ?? "joyce-work-schedule-mysql";
const image = process.env.JOYCE_DB_IMAGE ?? "mysql:8.4";
const host = process.env.JOYCE_DB_HOST ?? "127.0.0.1";
const port = process.env.JOYCE_DB_PORT ?? "3307";
const database = process.env.JOYCE_DB_NAME ?? "joyce_work_schedule";
const user = process.env.JOYCE_DB_USER ?? "joyce";

function randomSecret() {
  return crypto.randomBytes(24).toString("base64url");
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const entries = new Map();
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (match) entries.set(match[1], match[2]);
  }
  return entries;
}

function writeEnvFile(filePath, entries) {
  const content = Array.from(entries, ([key, value]) => `${key}=${value}`).join("\n");
  fs.writeFileSync(filePath, `${content}\n`);
}

function upsertEnv(filePath, updates) {
  const lines = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").split(/\r?\n/) : [];
  const seen = new Set();
  const next = lines
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const match = line.match(/^([^#=\s]+)=/);
      if (!match) return line;
      const key = match[1];
      if (!Object.prototype.hasOwnProperty.call(updates, key)) return line;
      seen.add(key);
      return `${key}=${updates[key]}`;
    });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, `${next.join("\n")}\n`);
}

function runDocker(args, options = {}) {
  return spawnSync("docker", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    windowsHide: true,
  });
}

function waitForPort(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host, port: Number(port) });
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for MySQL on ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1000);
      });
    };
    attempt();
  });
}

const dbEnv = readEnvFile(dbEnvPath);
if (!dbEnv.has("MYSQL_ROOT_PASSWORD")) dbEnv.set("MYSQL_ROOT_PASSWORD", randomSecret());
if (!dbEnv.has("MYSQL_DATABASE")) dbEnv.set("MYSQL_DATABASE", database);
if (!dbEnv.has("MYSQL_USER")) dbEnv.set("MYSQL_USER", user);
if (!dbEnv.has("MYSQL_PASSWORD")) dbEnv.set("MYSQL_PASSWORD", randomSecret());
writeEnvFile(dbEnvPath, dbEnv);

const password = dbEnv.get("MYSQL_PASSWORD");
const databaseUrl = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
upsertEnv(envPath, {
  DATABASE_URL: databaseUrl,
});

const inspect = runDocker(["inspect", containerName]);
if (inspect.status === 0) {
  const start = runDocker(["start", containerName]);
  if (start.status !== 0) {
    process.stderr.write(start.stderr || "Failed to start existing MySQL container.\n");
    process.exit(start.status ?? 1);
  }
} else {
  const run = runDocker([
    "run",
    "--name",
    containerName,
    "--env-file",
    dbEnvPath,
    "-p",
    `${host}:${port}:3306`,
    "-v",
    `${containerName}:/var/lib/mysql`,
    "-d",
    image,
  ]);
  if (run.status !== 0) {
    process.stderr.write(run.stderr || "Failed to create MySQL container.\n");
    process.exit(run.status ?? 1);
  }
}

try {
  await waitForPort();
  console.log(`Local MySQL is listening on ${host}:${port}. DATABASE_URL was written to .env.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
