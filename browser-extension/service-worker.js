const DEFAULTS = {
  dashboardUrl: "http://127.0.0.1:3025",
  collectorLabel: "Joyce Chrome",
  collectorToken: "",
};

function reportableUrl(url = "") {
  return /^(https?|file):/i.test(url);
}

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  let collectorId = stored.collectorId;
  if (!collectorId) {
    collectorId = crypto.randomUUID();
    await chrome.storage.local.set({ collectorId });
  }
  return { ...stored, collectorId };
}

async function bootstrapCollectorToken(settings) {
  const dashboard = settings.dashboardUrl.replace(/\/$/, "");
  const input = encodeURIComponent(JSON.stringify({ json: null }));
  const response = await fetch(`${dashboard}/api/trpc/browserTabs.getCollectorSetup?input=${input}`);
  if (!response.ok) throw new Error(`Automatic dashboard setup returned ${response.status}`);
  const body = await response.json();
  const token = body?.result?.data?.json?.token;
  if (!token) throw new Error("Dashboard did not provide a collector token");
  await chrome.storage.local.set({ collectorToken: token });
  return token;
}

async function buildInventory() {
  const tabs = (await chrome.tabs.query({})).filter((tab) => reportableUrl(tab.url));
  return tabs.map((tab) => ({
    id: String(tab.id ?? ""),
    title: tab.title || "Untitled tab",
    url: tab.url || "unknown://",
    pinned: Boolean(tab.pinned),
    active: Boolean(tab.active),
    windowId: tab.windowId,
  }));
}

async function sendInventory() {
  const settings = await getSettings();
  let collectorToken = settings.collectorToken;
  const endpoint = `${settings.dashboardUrl.replace(/\/$/, "")}/api/browser-tabs/ingest`;
  try {
    if (!collectorToken) collectorToken = await bootstrapCollectorToken(settings);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${collectorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        collectorId: settings.collectorId,
        collectorLabel: settings.collectorLabel,
        tabs: await buildInventory(),
      }),
    });
    const body = await response.json().catch(() => ({}));
    const result = {
      ok: response.ok,
      message: response.ok
        ? `${body.actionableTabs ?? 0} work tabs reported`
        : body.error || `Dashboard returned ${response.status}`,
      at: new Date().toISOString(),
    };
    await chrome.storage.local.set({ lastResult: result });
    return result;
  } catch (error) {
    const result = { ok: false, message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() };
    await chrome.storage.local.set({ lastResult: result });
    return result;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create("report-tabs", { periodInMinutes: 1 });
  await chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.alarms.create("report-tabs", { periodInMinutes: 1 });
  void sendInventory();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "report-tabs") void sendInventory();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "report-now") return false;
  void sendInventory().then(sendResponse);
  return true;
});

void chrome.alarms.create("report-tabs", { periodInMinutes: 1 });
void sendInventory();
