import { createHash } from "node:crypto";
import type { LlmTier, OpenAiCompatibleOptions } from "./_core/llm";

export type AptlssCatalogReasoningEffort = NonNullable<OpenAiCompatibleOptions["reasoningEffort"]>;

export type AptlssCatalogModel = {
  providerId: "openai-paid";
  providerLabel: string;
  tier: LlmTier;
  model: string;
  supportsJsonSchema: boolean;
  reasoningEfforts: Array<AptlssCatalogReasoningEffort | undefined>;
  qualityScore: number;
  contextWindow: number | null;
};

export type AptlssCatalogProviderReport = {
  providerId: "openai-paid";
  label: string;
  status: "fresh" | "stale" | "disabled" | "failed";
  listedCount: number;
  eligibleCount: number;
  routedCount: number;
  excludedCount: number;
  exclusions: Record<string, number>;
  error?: string;
};

export type AptlssModelCatalogSnapshot = {
  discoveryEnabled: boolean;
  discoveredAt: string;
  expiresAt: string;
  models: AptlssCatalogModel[];
  providers: AptlssCatalogProviderReport[];
};

type ProviderDiscovery = {
  models: AptlssCatalogModel[];
  report: AptlssCatalogProviderReport;
};

type CatalogCache = {
  signature: string;
  expiresAtMs: number;
  snapshot: AptlssModelCatalogSnapshot;
};

const DEFAULT_DISCOVERY_TTL_MS = 15 * 60_000;
const DEFAULT_FAILURE_TTL_MS = 60_000;
const DEFAULT_DISCOVERY_TIMEOUT_MS = 8_000;
const MODEL_SNAPSHOT_SUFFIX = /-\d{4}-\d{2}-\d{2}$/;
const SPECIALIZED_MODEL_PATTERN = /(?:^|[/:._-])(audio|computer-use|deep-research|embed(?:ding)?s?|guard|image|moderation|realtime|safety|search-preview|sora|speech|transcri(?:be|ption)|translation|tts|video|whisper)(?:$|[/:._-])/i;
const OPENAI_DEPRECATED_MODEL_PATTERN = /^(?:chatgpt-4o|codex-mini|computer-use-preview|davinci-|babbage-|gpt-3\.5|gpt-4(?:$|-|\.5)|gpt-4o(?:$|-audio|-realtime|-search)|gpt-5(?:-chat|-codex)|gpt-5\.1-(?:chat|codex)|gpt-5\.2-(?:chat|codex)|gpt-5\.3-chat|o1(?:$|-)|o3-mini|o4-mini|text-moderation)/i;

let catalogCache: CatalogCache | null = null;
let catalogRefresh: Promise<AptlssModelCatalogSnapshot> | null = null;

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function intEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function listEnv(name: string) {
  const raw = process.env[name]?.trim();
  return raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function increment(exclusions: Record<string, number>, reason: string, count = 1) {
  if (count > 0) exclusions[reason] = (exclusions[reason] ?? 0) + count;
}

function globMatches(value: string, pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

function filterReason(model: string) {
  const include = listEnv("APTLSS_OPENAI_MODEL_INCLUDE");
  const exclude = listEnv("APTLSS_OPENAI_MODEL_EXCLUDE");
  if (exclude.some((pattern) => globMatches(model, pattern))) return "operator_excluded";
  if (include.length && !include.some((pattern) => globMatches(model, pattern))) return "not_operator_included";
  return null;
}

function apiBase(value: string, fallback: string) {
  return (value.trim() || fallback).replace(/\/$/, "").replace(/\/chat\/completions$/i, "");
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = intEnv("APTLSS_MODEL_DISCOVERY_TIMEOUT_MS", DEFAULT_DISCOVERY_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`OpenAI model discovery failed with HTTP ${response.status} ${response.statusText}`);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OpenAI model discovery timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function providerReport(
  status: AptlssCatalogProviderReport["status"],
  extra: Partial<Omit<AptlssCatalogProviderReport, "providerId" | "label" | "status">> = {},
): AptlssCatalogProviderReport {
  return {
    providerId: "openai-paid",
    label: "OpenAI account models",
    status,
    listedCount: 0,
    eligibleCount: 0,
    routedCount: 0,
    excludedCount: 0,
    exclusions: {},
    ...extra,
  };
}

function openAiCanonicalModel(model: string) {
  return model.replace(MODEL_SNAPSHOT_SUFFIX, "");
}

function isOpenAiChatModel(model: string) {
  return /^(?:gpt-(?:oss-[a-z0-9.]+|4(?:\.1|o)(?:-[a-z0-9.]+)*|5(?:\.\d+)?(?:-[a-z0-9.]+)*)|o3(?:-[a-z0-9.]+)*)$/i.test(model);
}

export function getAptlssOpenAiQuality(model: string) {
  const canonical = openAiCanonicalModel(model);
  if (/^gpt-4o-mini$/i.test(canonical)) return 10;
  if (/^gpt-4\.1-mini$/i.test(canonical)) return 20;
  if (/^gpt-5-nano$/i.test(canonical)) return 25;
  if (/^gpt-5-mini$/i.test(canonical)) return 30;
  if (/^gpt-5\.4-nano$/i.test(canonical)) return 35;
  if (/^gpt-5\.4-mini$/i.test(canonical)) return 45;
  if (/^gpt-4\.1$/i.test(canonical)) return 50;
  if (/^gpt-oss-/i.test(canonical)) return /120b/i.test(canonical) ? 58 : 32;
  if (/^o3$/i.test(canonical)) return 60;
  if (/^o3-pro$/i.test(canonical)) return 68;
  if (/^gpt-5$/i.test(canonical)) return 65;
  if (/^gpt-5-pro$/i.test(canonical)) return 72;
  if (/^gpt-5\.1$/i.test(canonical)) return 74;
  if (/^gpt-5\.2$/i.test(canonical)) return 78;
  if (/^gpt-5\.2-pro$/i.test(canonical)) return 82;
  if (/^gpt-5\.3-codex$/i.test(canonical)) return 84;
  if (/^gpt-5\.4$/i.test(canonical)) return 88;
  if (/^gpt-5\.4-pro$/i.test(canonical)) return 94;
  if (/^gpt-5\.5$/i.test(canonical)) return 100;
  if (/^gpt-5\.5-pro$/i.test(canonical)) return 108;
  if (/^gpt-5\.6-luna$/i.test(canonical)) return 120;
  if (/^gpt-5\.6-terra$/i.test(canonical)) return 130;
  if (/^(?:gpt-5\.6-sol|gpt-5\.6)$/i.test(canonical)) return 140;
  return 55;
}

export function getAptlssOpenAiReasoningEfforts(model: string): Array<AptlssCatalogReasoningEffort | undefined> {
  const canonical = openAiCanonicalModel(model);
  if (/^gpt-5\.6(?:-|$)/i.test(canonical)) return ["low", "medium", "high", "xhigh", "max"];
  if (/^(?:gpt-5\.[45]-pro|gpt-5\.2-pro|gpt-5-pro|o3-pro)$/i.test(canonical)) return ["medium", "high", "xhigh"];
  if (/^gpt-5\.[45](?:-|$)/i.test(canonical)) return ["low", "medium", "high", "xhigh"];
  if (/^(?:gpt-5(?:\.[123])?(?:-|$)|o3$|gpt-oss-)/i.test(canonical)) return ["low", "medium", "high"];
  return [undefined];
}

async function discoverOpenAI(): Promise<ProviderDiscovery> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !boolEnv("APTLSS_OPENAI_DISCOVERY_ENABLED", true)) {
    return { models: [], report: providerReport("disabled") };
  }

  try {
    const base = apiBase(process.env.OPENAI_BASE_URL || "", "https://api.openai.com/v1");
    const payload = await fetchJson<{ data?: unknown[] }>(`${base}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const entries = Array.isArray(payload.data) ? payload.data : [];
    const exclusions: Record<string, number> = {};
    const includeSnapshots = boolEnv("APTLSS_OPENAI_INCLUDE_SNAPSHOTS", false);
    const availableIds = entries.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || typeof (entry as Record<string, unknown>).id !== "string") {
        increment(exclusions, "invalid_catalog_entry");
        return [];
      }
      return [((entry as Record<string, unknown>).id as string).trim()];
    }).filter(Boolean);
    const availableSet = new Set(availableIds);
    const unique = new Map<string, string>();

    for (const model of availableIds) {
      if (model.startsWith("ft:")) {
        const included = listEnv("APTLSS_OPENAI_MODEL_INCLUDE").some((pattern) => globMatches(model, pattern));
        if (!included) {
          increment(exclusions, "fine_tuned_requires_explicit_include");
          continue;
        }
      }
      if (SPECIALIZED_MODEL_PATTERN.test(model) || OPENAI_DEPRECATED_MODEL_PATTERN.test(model)) {
        increment(exclusions, "specialized_or_deprecated");
        continue;
      }
      const operatorReason = filterReason(model);
      if (operatorReason) {
        increment(exclusions, operatorReason);
        continue;
      }
      const canonical = openAiCanonicalModel(model);
      if (!isOpenAiChatModel(canonical)) {
        increment(exclusions, "no_chat_completion");
        continue;
      }
      if (includeSnapshots) {
        unique.set(model, model);
        continue;
      }
      const selected = unique.get(canonical);
      if (!selected || model === canonical || (!availableSet.has(canonical) && model.localeCompare(selected) > 0)) {
        if (selected) increment(exclusions, "snapshot_deduplicated");
        unique.set(canonical, model === canonical ? canonical : model);
      } else {
        increment(exclusions, "snapshot_deduplicated");
      }
    }

    const models = Array.from(unique.values()).map((model): AptlssCatalogModel => ({
      providerId: "openai-paid",
      providerLabel: "OpenAI available model",
      tier: "paid",
      model,
      supportsJsonSchema: true,
      reasoningEfforts: getAptlssOpenAiReasoningEfforts(model),
      qualityScore: getAptlssOpenAiQuality(model),
      contextWindow: null,
    })).sort((a, b) => a.qualityScore - b.qualityScore || a.model.localeCompare(b.model));

    const maximum = intEnv("APTLSS_OPENAI_MAX_MODELS", 0);
    const routed = maximum > 0 ? models.slice(0, maximum) : models;
    increment(exclusions, "provider_model_cap", models.length - routed.length);
    return {
      models: routed,
      report: providerReport("fresh", {
        listedCount: entries.length,
        eligibleCount: models.length,
        routedCount: routed.length,
        excludedCount: entries.length - routed.length,
        exclusions,
      }),
    };
  } catch (error) {
    return { models: [], report: providerReport("failed", { error: safeError(error) }) };
  }
}

function secretFingerprint(value: string | undefined) {
  return value ? createHash("sha256").update(value).digest("hex").slice(0, 12) : "none";
}

function catalogSignature() {
  return JSON.stringify({
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env.APTLSS_MODEL_DISCOVERY_ENABLED,
    cache: [
      process.env.APTLSS_MODEL_CATALOG_TTL_MS,
      process.env.APTLSS_MODEL_DISCOVERY_FAILURE_TTL_MS,
      process.env.APTLSS_MODEL_DISCOVERY_TIMEOUT_MS,
    ],
    openai: [
      secretFingerprint(process.env.OPENAI_API_KEY),
      process.env.OPENAI_BASE_URL,
      process.env.APTLSS_OPENAI_DISCOVERY_ENABLED,
      process.env.APTLSS_OPENAI_MODEL_INCLUDE,
      process.env.APTLSS_OPENAI_MODEL_EXCLUDE,
      process.env.APTLSS_OPENAI_INCLUDE_SNAPSHOTS,
      process.env.APTLSS_OPENAI_MAX_MODELS,
    ],
  });
}

async function refreshCatalog(signature: string, previous: AptlssModelCatalogSnapshot | null) {
  const now = Date.now();
  let result = await discoverOpenAI();
  if (result.report.status === "failed" && previous?.models.length) {
    result = {
      models: previous.models,
      report: { ...result.report, status: "stale", eligibleCount: previous.models.length, routedCount: previous.models.length },
    };
  }
  const unavailable = result.report.status === "disabled" || result.report.status === "failed";
  const ttlMs = unavailable
    ? intEnv("APTLSS_MODEL_DISCOVERY_FAILURE_TTL_MS", DEFAULT_FAILURE_TTL_MS)
    : intEnv("APTLSS_MODEL_CATALOG_TTL_MS", DEFAULT_DISCOVERY_TTL_MS);
  const snapshot: AptlssModelCatalogSnapshot = {
    discoveryEnabled: true,
    discoveredAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
    models: result.models,
    providers: [result.report],
  };
  catalogCache = { signature, expiresAtMs: now + ttlMs, snapshot };
  return snapshot;
}

export async function getAptlssModelCatalog(options: { forceRefresh?: boolean } = {}) {
  const enabled = boolEnv("APTLSS_MODEL_DISCOVERY_ENABLED", true);
  const now = Date.now();
  if (!enabled) {
    return {
      discoveryEnabled: false,
      discoveredAt: new Date(now).toISOString(),
      expiresAt: new Date(now).toISOString(),
      models: [],
      providers: [],
    } satisfies AptlssModelCatalogSnapshot;
  }

  const signature = catalogSignature();
  if (!options.forceRefresh && catalogCache?.signature === signature && catalogCache.expiresAtMs > now) {
    return catalogCache.snapshot;
  }
  if (catalogRefresh) return catalogRefresh;
  const previous = catalogCache?.signature === signature ? catalogCache.snapshot : null;
  catalogRefresh = refreshCatalog(signature, previous).finally(() => {
    catalogRefresh = null;
  });
  return catalogRefresh;
}

export function resetAptlssModelCatalogForTests() {
  catalogCache = null;
  catalogRefresh = null;
}
