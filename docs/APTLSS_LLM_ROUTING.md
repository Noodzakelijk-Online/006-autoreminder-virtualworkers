# APTLSS OpenAI Routing

## Provider contract

APTLSS uses the server-side `OPENAI_API_KEY` as its only model-provider credential. It does not route Trello or Gmail context through OpenRouter, Ollama, Gemini, Manus Forge, or custom hosted endpoints.

External actions remain approval-gated. Model output can improve a plan, waiting-reason interpretation, schedule, or draft, but cannot post, move, approve, or complete Trello work without an explicit application action.

## Automatic model assignment

The router refreshes `GET /v1/models` every 15 minutes and builds a sanitized inventory from models available to the configured OpenAI project. It routes current general-purpose text and reasoning families, while excluding embedding, moderation, image, audio, realtime, transcription, video, search-only, deep-research, deprecated, and other specialized endpoints.

Dated snapshots are collapsed to their stable family by default. The live catalog replaces the offline compatibility ladder whenever discovery succeeds. Models are ordered from lower-cost generation candidates toward stronger review stages; supported reasoning efforts are placed next to their model from lower to higher effort.

Each accepted structured result is validated deterministically. When review is enabled, a higher stage passes or repairs the result. The cascade stops as soon as a valid result passes review, so merely discovering many models does not mean every request calls all of them.

## Configuration

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
APTLSS_MODEL_DISCOVERY_ENABLED=true
APTLSS_MODEL_CATALOG_TTL_MS=900000
APTLSS_MODEL_DISCOVERY_FAILURE_TTL_MS=60000
APTLSS_MODEL_DISCOVERY_TIMEOUT_MS=8000
APTLSS_OPENAI_DISCOVERY_ENABLED=true
APTLSS_OPENAI_INCLUDE_SNAPSHOTS=false
APTLSS_OPENAI_MODEL_INCLUDE=
APTLSS_OPENAI_MODEL_EXCLUDE=
APTLSS_OPENAI_MAX_MODELS=0
APTLSS_OPENAI_TIMEOUT_MS=180000
APTLSS_LLM_REVIEW_ENABLED=true
APTLSS_LLM_MAX_CALLS_PER_RUN=32
APTLSS_LLM_MAX_RANK=
```

`APTLSS_OPENAI_MODEL_INCLUDE` and `APTLSS_OPENAI_MODEL_EXCLUDE` accept comma-separated exact IDs or `*` wildcards. Exclusions win. Zero for `APTLSS_OPENAI_MAX_MODELS` means all eligible account-visible models.

## Failure behavior

Concurrent catalog requests share one refresh. A failed refresh is retried after one minute. After a previous successful fetch, its compatible catalog remains active as stale data. Before the first successful fetch, the maintained OpenAI fallback ladder remains available. If the key is absent, APTLSS keeps deterministic planning available and reports a setup warning instead of silently using another provider.

Provider calls, errors, model stages, review results, and fallback decisions remain auditable. API keys are never returned by readiness, catalog, or audit APIs.
