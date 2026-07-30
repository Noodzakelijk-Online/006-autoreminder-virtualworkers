export type OperatorEvidenceSourceKey =
  | "trello"
  | "communication"
  | "gmail"
  | "google_drive"
  | "time";

export type OperatorAssessmentEvidence = {
  key: string;
  source: string;
  value: string | number | boolean | null;
  quality: string;
  detail: string;
  observedAt?: string;
};

export type OperatorEvidenceIssue = {
  id: string;
  title: string;
  detail: string;
  resolution: string;
  severity: "high" | "medium" | "low";
};

export type OperatorEvidenceSourceStatus = {
  key: OperatorEvidenceSourceKey;
  label: string;
  count: number;
  status: "linked" | "live" | "missing";
  detail: string;
};

export type OperatorIntelligenceSnapshot = {
  forecast?: {
    rawEstimatedRemainingMinutes?: number;
    calibratedP50Minutes?: number;
    calibratedP90Minutes?: number;
    calibrationSampleSize?: number;
    uncertainty?: string;
  };
  confidenceProfile?: {
    targetScore?: number;
    ceiling?: number;
    gapToTarget?: number;
    dimensions?: {
      evidence?: number;
      forecast?: number;
      humanValidation?: number;
      consistency?: number;
    };
    blockers?: string[];
  };
};

export type OperatorEvidenceSummaryInput = {
  rawUncertainties: string[];
  assessmentEvidence: OperatorAssessmentEvidence[];
  intelligence: OperatorIntelligenceSnapshot;
  linkedSourceCounts: Partial<Record<Exclude<OperatorEvidenceSourceKey, "time">, number>>;
  completedTimeSamples: number;
};

function countFor(
  counts: OperatorEvidenceSummaryInput["linkedSourceCounts"],
  key: Exclude<OperatorEvidenceSourceKey, "time">,
) {
  return Math.max(0, Number(counts[key] ?? 0));
}

function isCoveredByStructuredIssue(value: string) {
  return /gmail|drive|communication|trello|evidence is linked|completed-work sample|calibrat|remaining-time|forecast|uncertainty range/i.test(value);
}

function formatMinutes(value: number | undefined) {
  if (!Number.isFinite(value)) return null;
  const minutes = Math.max(0, Math.round(value ?? 0));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function buildOperatorEvidenceSummary(input: OperatorEvidenceSummaryInput) {
  const liveTrelloSignals = input.assessmentEvidence.filter((item) =>
    item.source === "trello" && item.quality !== "weak" && item.value !== null
  ).length;
  const retainedTrello = countFor(input.linkedSourceCounts, "trello");
  const communication = countFor(input.linkedSourceCounts, "communication");
  const gmail = countFor(input.linkedSourceCounts, "gmail");
  const googleDrive = countFor(input.linkedSourceCounts, "google_drive");
  const completedTimeSamples = Math.max(0, input.completedTimeSamples);

  const sources: OperatorEvidenceSourceStatus[] = [
    {
      key: "trello",
      label: "Trello",
      count: retainedTrello + liveTrelloSignals,
      status: retainedTrello > 0 ? "linked" : liveTrelloSignals > 0 ? "live" : "missing",
      detail: retainedTrello > 0
        ? `${retainedTrello} retained item${retainedTrello === 1 ? "" : "s"}`
        : liveTrelloSignals > 0
          ? `${liveTrelloSignals} live assessment signal${liveTrelloSignals === 1 ? "" : "s"}`
          : "No current card evidence",
    },
    {
      key: "communication",
      label: "Messages",
      count: communication,
      status: communication > 0 ? "linked" : "missing",
      detail: communication > 0 ? `${communication} linked event${communication === 1 ? "" : "s"}` : "No linked conversation",
    },
    {
      key: "gmail",
      label: "Gmail",
      count: gmail,
      status: gmail > 0 ? "linked" : "missing",
      detail: gmail > 0 ? `${gmail} linked email${gmail === 1 ? "" : "s"}` : "No linked email",
    },
    {
      key: "google_drive",
      label: "Drive",
      count: googleDrive,
      status: googleDrive > 0 ? "linked" : "missing",
      detail: googleDrive > 0 ? `${googleDrive} linked file${googleDrive === 1 ? "" : "s"}` : "No linked file",
    },
    {
      key: "time",
      label: "Time",
      count: completedTimeSamples,
      status: completedTimeSamples > 0 ? "linked" : "missing",
      detail: completedTimeSamples > 0
        ? `${completedTimeSamples} completed sample${completedTimeSamples === 1 ? "" : "s"}`
        : "No completed sample",
    },
  ];

  const issues: OperatorEvidenceIssue[] = [];
  const missingCorroboration = sources
    .filter((source) => ["communication", "gmail", "google_drive"].includes(source.key) && source.status === "missing")
    .map((source) => source.label);
  if (missingCorroboration.length > 0) {
    const trelloStatus = sources[0].status === "missing"
      ? "No Trello evidence is available either."
      : `${sources[0].detail} is available.`;
    issues.push({
      id: "cross-source-corroboration",
      title: "Cross-source corroboration is incomplete",
      detail: `${trelloStatus} ${missingCorroboration.join(", ")} ${missingCorroboration.length === 1 ? "is" : "are"} not linked to this card.`,
      resolution: "Ingest or link a matching message, email, or Drive file by card ID or exact card title. Until then, treat Trello as the primary source.",
      severity: sources[0].status === "missing" ? "high" : "medium",
    });
  }

  const forecast = input.intelligence.forecast;
  const p50 = formatMinutes(forecast?.calibratedP50Minutes);
  const p90 = formatMinutes(forecast?.calibratedP90Minutes);
  const sampleSize = Math.max(completedTimeSamples, Number(forecast?.calibrationSampleSize ?? 0));
  const hasWideForecast = Number(forecast?.calibratedP90Minutes ?? 0) >
    Number(forecast?.calibratedP50Minutes ?? 0) * 1.35;
  if (sampleSize < 2 || hasWideForecast) {
    issues.push({
      id: "forecast-calibration",
      title: "The remaining-time forecast needs calibration",
      detail: p50 && p90
        ? `Current range: P50 ${p50}, P90 ${p90}, based on ${sampleSize} completed sample${sampleSize === 1 ? "" : "s"}.`
        : `The estimate is based on ${sampleSize} completed sample${sampleSize === 1 ? "" : "s"}.`,
      resolution: "Track this card from start to stop and complete at least two comparable work sessions. Plan against P90 until the sample is large enough.",
      severity: sampleSize === 0 ? "high" : "medium",
    });
  }

  for (const uncertainty of input.rawUncertainties) {
    const detail = uncertainty.trim();
    if (!detail || isCoveredByStructuredIssue(detail)) continue;
    issues.push({
      id: `assessment-gap-${issues.length + 1}`,
      title: "Assessment gap",
      detail,
      resolution: "Review the relevant source and add or link the missing fact before relying on this part of the assessment.",
      severity: "medium",
    });
  }

  return {
    sources,
    issues,
    forecast: forecast ? {
      p50Minutes: forecast.calibratedP50Minutes ?? null,
      p90Minutes: forecast.calibratedP90Minutes ?? null,
      sampleSize,
      uncertainty: forecast.uncertainty ?? null,
    } : null,
    confidenceProfile: input.intelligence.confidenceProfile ? {
      targetScore: input.intelligence.confidenceProfile.targetScore ?? null,
      ceiling: input.intelligence.confidenceProfile.ceiling ?? null,
      gapToTarget: input.intelligence.confidenceProfile.gapToTarget ?? null,
      dimensions: input.intelligence.confidenceProfile.dimensions ?? {},
      blockers: input.intelligence.confidenceProfile.blockers ?? [],
    } : null,
  };
}
