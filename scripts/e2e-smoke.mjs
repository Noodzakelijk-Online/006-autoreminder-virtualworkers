import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3025/";
const outputDir = process.env.E2E_OUTPUT_DIR || path.join(os.tmpdir(), "joyce-dashboard-e2e");
const browserCandidates = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) => fs.existsSync(candidate));

if (!executablePath) throw new Error("No supported Chromium browser was found for E2E smoke testing.");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
const consoleProblems = [];
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
});
page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

async function waitForText(text) {
  await page.waitForFunction(
    (expected) => document.body?.innerText.toLowerCase().includes(expected.toLowerCase()),
    { timeout: 20_000 },
    text,
  );
}

async function clickButton(text) {
  const clicked = await page.evaluate((label) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim().includes(label));
    button?.click();
    return Boolean(button);
  }, text);
  if (!clicked) throw new Error(`Button not found: ${text}`);
}

try {
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  const response = await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 30_000 });
  if (!response?.ok()) throw new Error(`Dashboard returned HTTP ${response?.status() ?? "unknown"}.`);

  if ((await page.$("#local-owner-token")) !== null) {
    if (!process.env.LOCAL_AUTH_TOKEN) throw new Error("LOCAL_AUTH_TOKEN is required to exercise the secured login flow.");
    await page.type("#local-owner-token", process.env.LOCAL_AUTH_TOKEN);
    await clickButton("Unlock dashboard");
  }

  await waitForText("Joyce Work Control");
  await waitForText("Today");
  await page.waitForFunction(() => !document.querySelector('[data-testid="status-setup"]')?.textContent?.includes("Checking"), { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="work-queue-now"]')?.getAttribute("data-state") !== "loading", { timeout: 30_000 });
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (desktopOverflow) throw new Error("Desktop layout has horizontal page overflow.");
  await page.screenshot({ path: path.join(outputDir, "desktop-today.png"), fullPage: true });

  const firstNextItem = await page.$('[data-testid="next-up-item"]');
  if (firstNextItem) {
    await firstNextItem.click();
    await page.waitForSelector('[data-testid="card-inspector"]', { timeout: 5_000 });
    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-testid="card-inspector"]', { hidden: true, timeout: 5_000 });
  }

  await clickButton("Decisions");
  await waitForText("Prepared decisions and exceptions");
  await page.waitForFunction(() => document.querySelector('[data-testid="decision-context"]')?.getAttribute("data-state") !== "loading", { timeout: 30_000 });
  await clickButton("Classify task");
  await waitForText("Question 1 of 7");
  for (let index = 0; index < 7; index += 1) await clickButton("No");
  await waitForText("P5: Schedule or defer");
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 5_000 });

  const themeToggle = await page.waitForSelector('button[aria-label="Switch to dark mode"]', { timeout: 5_000 });
  await themeToggle.click();
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"), { timeout: 5_000 });
  await page.screenshot({ path: path.join(outputDir, "desktop-decisions-dark.png"), fullPage: true });

  await clickButton("Today");
  await waitForText("Work from one trusted queue");
  await page.click('[data-testid="today-day-plan"]');
  await waitForText("Plan My Day");
  if (process.env.E2E_PREPARE_PLANS === "1") {
    const preparePlans = await page.$('[data-testid="prepare-aptlss-plans"]');
    if (preparePlans) {
      await preparePlans.click();
      await page.waitForFunction(() => !document.querySelector('[data-testid="prepare-aptlss-plans"]'), { timeout: 180_000 });
    }
  }
  await page.screenshot({ path: path.join(outputDir, "desktop-day-plan-dark.png"), fullPage: true });

  await clickButton("Inbox");
  await waitForText("Process one intake source at a time");
  if (process.env.E2E_RUN_REPLY_SCAN === "1") {
    await page.click('[data-testid="reply-monitor-tab"]');
    await waitForText("Reply Monitor");
    await page.click('[data-testid="reply-monitor-scan"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="reply-monitor-status"]')?.textContent?.includes("Last successful scan"),
      { timeout: 180_000 },
    );
  }
  await clickButton("Time & Pay");
  await waitForText("Keep daily time, payment administration");
  await clickButton("Standards");
  await waitForText("Priority Playbook");
  await clickButton("Settings");
  await waitForText("Choose one configuration area at a time");
  await page.goto(new URL("/admin", baseUrl).toString(), { waitUntil: "networkidle2", timeout: 30_000 });
  await waitForText("APTLSS Intelligence Health");
  await waitForText("Evidence coverage");
  await page.screenshot({ path: path.join(outputDir, "desktop-aptlss-health-dark.png"), fullPage: true });
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 30_000 });
  await clickButton("Decisions");
  await waitForText("Prepared decisions and exceptions");
  await page.waitForFunction(() => document.querySelector('[data-testid="decision-context"]')?.getAttribute("data-state") !== "loading", { timeout: 30_000 });

  const preReloadProblems = consoleProblems.filter((message) => !message.includes("favicon") && !message.includes("React DevTools"));
  if (preReloadProblems.length) throw new Error(`Browser console problems:\n${preReloadProblems.join("\n")}`);
  consoleProblems.length = 0;

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle2", timeout: 30_000 });
  await waitForText("Joyce Work Control");
  await page.waitForFunction(() => document.querySelector('[data-testid="decision-context"]')?.getAttribute("data-state") !== "loading", { timeout: 30_000 });
  await new Promise((resolve) => setTimeout(resolve, 750));
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (mobileOverflow) throw new Error("Mobile layout has horizontal page overflow.");
  await page.screenshot({ path: path.join(outputDir, "mobile.png"), fullPage: true });

  const relevantProblems = consoleProblems.filter((message) => !message.includes("favicon") && !message.includes("React DevTools"));
  if (relevantProblems.length) throw new Error(`Browser console problems:\n${relevantProblems.join("\n")}`);

  console.log(JSON.stringify({
    ok: true,
    url: page.url(),
    screenshots: ["desktop-today.png", "desktop-decisions-dark.png", "desktop-day-plan-dark.png", "desktop-aptlss-health-dark.png", "mobile.png"].map((name) => path.join(outputDir, name)),
    checks: ["secured login", "Today", "card inspector", "Day plan", "Inbox", "Decisions classifier 7/7", "Time & Pay", "Standards", "Settings", "APTLSS intelligence health", "dark mode", "desktop overflow", "mobile overflow", "console"],
  }, null, 2));
} catch (error) {
  const failurePath = path.join(outputDir, "failure.png");
  await page.screenshot({ path: failurePath, fullPage: true }).catch(() => undefined);
  const bodyText = await page.evaluate(() => document.body?.innerText.slice(0, 4000) ?? "").catch(() => "");
  console.error(JSON.stringify({ failurePath, bodyText, consoleProblems }, null, 2));
  throw error;
} finally {
  await browser.close();
}
