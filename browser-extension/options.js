const DEFAULTS = {
  dashboardUrl: "http://127.0.0.1:3025",
  collectorLabel: "Joyce Chrome",
  collectorToken: "",
};

const form = document.querySelector("#settings-form");
const dashboardUrl = document.querySelector("#dashboard-url");
const collectorLabel = document.querySelector("#collector-label");
const collectorToken = document.querySelector("#collector-token");
const status = document.querySelector("#status");

function show(message, ok) {
  status.textContent = message;
  status.className = ok ? "ok" : "error";
}

async function save() {
  const values = {
    dashboardUrl: dashboardUrl.value.trim().replace(/\/$/, ""),
    collectorLabel: collectorLabel.value.trim(),
  };
  if (collectorToken.value.trim()) values.collectorToken = collectorToken.value.trim();
  await chrome.storage.local.set(values);
}

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get(DEFAULTS);
  dashboardUrl.value = stored.dashboardUrl;
  collectorLabel.value = stored.collectorLabel;
  collectorToken.value = stored.collectorToken;
  if (stored.lastResult) show(`${stored.lastResult.message} (${new Date(stored.lastResult.at).toLocaleString()})`, stored.lastResult.ok);
  else if (!stored.collectorToken) show("Automatic dashboard connection will run now.", true);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await save();
  show("Settings saved. The next inventory will be sent within one minute.", true);
});

document.querySelector("#test").addEventListener("click", async () => {
  if (!form.reportValidity()) return;
  await save();
  show("Testing connection...", true);
  const result = await chrome.runtime.sendMessage({ type: "report-now" });
  const updated = await chrome.storage.local.get(DEFAULTS);
  collectorToken.value = updated.collectorToken;
  show(result?.message || "No response from the collector", Boolean(result?.ok));
});
