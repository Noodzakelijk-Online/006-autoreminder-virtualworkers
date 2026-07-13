export type WorkspaceEvidenceSource = "gmail" | "google_drive" | "trello" | "communication";

export type WorkspaceEvidenceCandidate = {
  id: number;
  source: WorkspaceEvidenceSource;
  sourceId: string;
  title: string;
  summary: string | null;
  content: string | null;
  sourceUrl: string | null;
  modifiedAt: Date | null;
  observedAt: Date;
};

export type EvidenceMatchCard = {
  id: string;
  name: string;
  url?: string | null;
  context?: string | null;
};

export type WorkspaceEvidenceMatch = {
  cardId: string;
  relevanceScore: number;
  matchReason: string;
};

export type AptlssExternalEvidenceItem = {
  source: WorkspaceEvidenceSource;
  sourceId: string;
  title: string;
  summary: string | null;
  contentSnippet: string | null;
  sourceUrl: string | null;
  modifiedAt: string | null;
  observedAt: string;
  relevanceScore: number;
  matchReason: string;
};

export type AptlssExternalEvidenceSignal = {
  total: number;
  sourceCounts: Record<WorkspaceEvidenceSource, number>;
  highConfidenceLinks: number;
  latestObservedAt: string | null;
  items: AptlssExternalEvidenceItem[];
};

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "card", "client", "for", "from",
  "have", "into", "joyce", "project", "re", "the", "this", "trello", "update", "with",
  "aan", "bij", "dat", "de", "den", "der", "door", "een", "het", "met", "naar", "onder",
  "op", "te", "van", "voor",
]);

// These terms are useful context, but too common in Joyce's workspace to prove
// that two records describe the same work item.
const LOW_SIGNAL_MATCH_TERMS = new Set([
  "account", "business", "company", "document", "file", "general", "notes", "online",
  "noodzakelijk", "plan", "planning", "task", "work", "working",
]);

function normalize(value: string) {
  return value.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function terms(value: string) {
  return Array.from(new Set(normalize(value).split(/\s+/).filter((term) => term.length >= 3 && !STOP_WORDS.has(term))));
}

function compact(value: string | null | undefined, maxLength = 800) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function matchEvidenceToCards(
  evidence: WorkspaceEvidenceCandidate,
  cards: EvidenceMatchCard[],
): WorkspaceEvidenceMatch[] {
  const rawEvidence = [evidence.title, evidence.summary, evidence.content, evidence.sourceUrl].filter(Boolean).join("\n");
  const normalizedEvidence = normalize(rawEvidence);
  const semanticEvidence = evidence.source === "google_drive"
    ? evidence.title
    : [evidence.title, evidence.summary].filter(Boolean).join("\n");
  const evidenceTerms = new Set(terms(semanticEvidence).filter((term) => !LOW_SIGNAL_MATCH_TERMS.has(term)));
  const matches: WorkspaceEvidenceMatch[] = [];

  for (const card of cards) {
    const cardName = normalize(card.name);
    const cardContext = [card.name, card.url, card.context].filter(Boolean).join("\n");
    let relevanceScore = 0;
    let matchReason = "";

    if (evidence.source === "trello" && evidence.sourceId === card.id) {
      relevanceScore = 100;
      matchReason = "Trello card is the evidence source";
    } else if (
      rawEvidence.includes(card.id)
      || (card.url && rawEvidence.includes(card.url))
      || (evidence.source !== "gmail" && cardContext.includes(evidence.sourceId))
    ) {
      relevanceScore = 98;
      matchReason = "Explicit card or source identifier match";
    } else if (evidence.source === "trello") {
      continue;
    } else if (
      cardName.length >= 6
      && terms(card.name).some((term) => !LOW_SIGNAL_MATCH_TERMS.has(term))
      && normalizedEvidence.includes(cardName)
    ) {
      relevanceScore = 92;
      matchReason = "Full card name appears in the source";
    } else {
      const cardTerms = terms(card.name).filter((term) => !LOW_SIGNAL_MATCH_TERMS.has(term));
      const overlap = cardTerms.filter((term) => evidenceTerms.has(term));
      const ratio = cardTerms.length ? overlap.length / cardTerms.length : 0;
      if (overlap.length >= 2 && ratio >= 0.67) {
        relevanceScore = Math.min(88, Math.round(56 + ratio * 32));
        matchReason = `Distinctive title terms: ${overlap.join(", ")}`;
      }
    }

    if (relevanceScore >= 60) matches.push({ cardId: card.id, relevanceScore, matchReason });
  }

  return matches.sort((left, right) => right.relevanceScore - left.relevanceScore).slice(0, 8);
}

export function buildAptlssExternalEvidenceSignal(rows: Array<WorkspaceEvidenceCandidate & {
  relevanceScore: number;
  matchReason: string;
}>): AptlssExternalEvidenceSignal {
  const sourceCounts: Record<WorkspaceEvidenceSource, number> = { gmail: 0, google_drive: 0, trello: 0, communication: 0 };
  for (const row of rows) sourceCounts[row.source]++;
  const ordered = [...rows].sort((left, right) => {
    if (right.relevanceScore !== left.relevanceScore) return right.relevanceScore - left.relevanceScore;
    return (right.modifiedAt ?? right.observedAt).getTime() - (left.modifiedAt ?? left.observedAt).getTime();
  });
  return {
    total: ordered.length,
    sourceCounts,
    highConfidenceLinks: ordered.filter((row) => row.relevanceScore >= 90).length,
    latestObservedAt: ordered.length
      ? new Date(Math.max(...ordered.map((row) => (row.modifiedAt ?? row.observedAt).getTime()))).toISOString()
      : null,
    items: ordered.slice(0, 12).map((row) => ({
      source: row.source,
      sourceId: row.sourceId,
      title: row.title,
      summary: compact(row.summary, 500),
      contentSnippet: compact(row.content, 800),
      sourceUrl: row.sourceUrl,
      modifiedAt: row.modifiedAt?.toISOString() ?? null,
      observedAt: row.observedAt.toISOString(),
      relevanceScore: row.relevanceScore,
      matchReason: row.matchReason,
    })),
  };
}
