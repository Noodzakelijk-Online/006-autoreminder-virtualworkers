import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [nodeEnv, command, ...args] = process.argv.slice(2);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const localBin = path.join(projectRoot, "node_modules", ".bin");

if (!nodeEnv || !command) {
  console.error("Usage: node scripts/with-node-env.mjs <NODE_ENV> <command> [...args]");
  process.exit(1);
}

function resolveCommand(commandName) {
  if (commandName === "node") return process.execPath;
  if (path.isAbsolute(commandName) || commandName.includes("/") || commandName.includes("\\")) {
    return commandName;
  }

  const pathDirs = [localBin, ...(process.env.PATH ?? "").split(path.delimiter)];
  const extensions = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
  for (const dir of pathDirs) {
    for (const extension of extensions) {
      const candidate = path.join(dir, `${commandName}${extension}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return commandName;
}

const resolvedCommand = resolveCommand(command);
const isWindowsCommandShim = process.platform === "win32" && /\.(cmd|bat)$/i.test(resolvedCommand);
const childCommand = isWindowsCommandShim ? (process.env.ComSpec ?? "cmd.exe") : resolvedCommand;
const childArgs = isWindowsCommandShim
  ? ["/d", "/c", resolvedCommand, ...args]
  : args;

const child = spawn(childCommand, childArgs, {
  env: {
    ...process.env,
    NODE_ENV: nodeEnv,
  },
  shell: false,
  stdio: "inherit",
  windowsHide: true,
});

child.on("error", (error) => {
  console.error(`Failed to start command "${command}": ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
