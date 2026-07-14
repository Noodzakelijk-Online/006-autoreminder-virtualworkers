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

async function clickTab(text) {
  const tabs = await page.$$('[role="tab"]');
  let target = null;
  for (const tab of tabs) {
    if ((await tab.evaluate((item) => item.textContent?.trim())) === text) {
      target = tab;
      break;
    }
  }
  if (!target) throw new Error(`Tab not found: ${text}`);
  await target.click();
  await page.waitForFunction(
    (label) => [...document.querySelectorAll('[role="tab"]')].some((item) => item.textContent?.trim() === label && item.getAttribute("data-state") === "active"),
    { timeout: 5_000 },
    text,
  );
}

try {
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  const response = await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 30_000 });
  if (!response?.ok()) throw new Error(`Dashboard returned HTTP ${response?.status() ?? "unknown"}.`);

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
  const onHoldToggle = await page.$('button[aria-label$="Review ON-HOLD Cards"]');
  if (!onHoldToggle) throw new Error("ON-HOLD review toggle was not found.");
  if ((await onHoldToggle.evaluate((element) => element.getAttribute("aria-expanded"))) !== "true") await onHoldToggle.click();
  const waitingReasonControl = await page.waitForSelector('[data-testid^="waiting-reason-"]', { timeout: 10_000 });
  await waitingReasonControl.click();
  await page.waitForSelector('[data-testid="waiting-reason-inspector"]', { timeout: 5_000 });
  await waitForText("Exact waiting reason");
  await waitForText("Internal APTLSS evidence");
  await new Promise((resolve) => setTimeout(resolve, 500));
  const waitingInspectorOverflow = await page.evaluate(() => {
    const inspector = document.querySelector('[data-testid="waiting-reason-inspector"]');
    return inspector ? inspector.scrollWidth > inspector.clientWidth + 1 : true;
  });
  if (waitingInspectorOverflow) throw new Error("Waiting-reason inspector has horizontal overflow.");
  await page.screenshot({ path: path.join(outputDir, "desktop-waiting-reason-dark.png"), fullPage: false });
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-testid="waiting-reason-inspector"]', { hidden: true, timeout: 5_000 });
  await page.click('[data-testid="reply-monitor-tab"]');
  await waitForText("Reply Monitor");
  await page.screenshot({ path: path.join(outputDir, "desktop-reply-accountability-dark.png"), fullPage: true });
  if (process.env.E2E_RUN_REPLY_SCAN === "1") {
    await page.click('[data-testid="reply-monitor-scan"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="reply-monitor-status"]')?.textContent?.includes("Last successful scan"),
      { timeout: 180_000 },
    );
  }
  await clickButton("Time & Pay");
  await waitForText("Keep daily time, payment administration");
  await clickTab("Quality history");
  await waitForText("Source-backed cards, communication, email processing, and overtime");
  await page.waitForFunction(() => !document.body?.innerText.includes("Loading compliance history"), { timeout: 30_000 });
  await page.screenshot({ path: path.join(outputDir, "desktop-compliance-history-dark.png"), fullPage: true });
  await clickButton("Standards");
  await waitForText("Priority Playbook");
  await clickButton("Settings");
  await waitForText("Choose one configuration area at a time");
  await page.goto(new URL("/admin", baseUrl).toString(), { waitUntil: "networkidle2", timeout: 30_000 });
  await waitForText("APTLSS Intelligence Health");
  await waitForText("Validated accuracy");
  await waitForText("Assessment Review Queue");
  await waitForText("Incorrect");
  await clickButton("Incorrect");
  await waitForText("Correct assessment");
  const correctionIsGated = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Record correction"));
    return button instanceof HTMLButtonElement && button.disabled;
  });
  if (!correctionIsGated) throw new Error("Assessment correction can be submitted without selecting a corrected state.");
  await clickButton("Cancel");
  await page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 5_000 });
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
  await clickButton("Toggle Sidebar");
  await clickButton("Inbox");
  await waitForText("Process one intake source at a time");
  await clickTab("Work Intake");
  const mobileOnHoldToggle = await page.$('button[aria-label$="Review ON-HOLD Cards"]');
  if (!mobileOnHoldToggle) throw new Error("Mobile ON-HOLD review toggle was not found.");
  if ((await mobileOnHoldToggle.evaluate((element) => element.getAttribute("aria-expanded"))) !== "true") await mobileOnHoldToggle.click();
  const mobileWaitingReasonControl = await page.waitForSelector('[data-testid^="waiting-reason-"]', { timeout: 10_000 });
  await mobileWaitingReasonControl.click();
  await page.waitForSelector('[data-testid="waiting-reason-inspector"]', { timeout: 5_000 });
  await waitForText("Exact waiting reason");
  await new Promise((resolve) => setTimeout(resolve, 750));
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (mobileOverflow) throw new Error("Mobile layout has horizontal page overflow.");
  await page.screenshot({ path: path.join(outputDir, "mobile-waiting-reason.png"), fullPage: false });

  const relevantProblems = consoleProblems.filter((message) => !message.includes("favicon") && !message.includes("React DevTools"));
  if (relevantProblems.length) throw new Error(`Browser console problems:\n${relevantProblems.join("\n")}`);

  console.log(JSON.stringify({
    ok: true,
    url: page.url(),
    screenshots: ["desktop-today.png", "desktop-decisions-dark.png", "desktop-day-plan-dark.png", "desktop-waiting-reason-dark.png", "desktop-reply-accountability-dark.png", "desktop-compliance-history-dark.png", "desktop-aptlss-health-dark.png", "mobile-waiting-reason.png"].map((name) => path.join(outputDir, name)),
    checks: ["single-user access", "Today", "card inspector", "Day plan", "Inbox", "waiting reason inspector", "Reply accountability", "Decisions classifier 7/7", "Time & Pay", "communication compliance history", "Standards", "Settings", "APTLSS intelligence health", "assessment review gate", "dark mode", "desktop overflow", "mobile overflow", "console"],
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
