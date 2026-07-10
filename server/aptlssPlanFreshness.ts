export function canReuseAptlssPlan({
  generatedAt,
  currentContextHash,
  assessedContextHash,
  assessedEngineVersion,
  currentEngineVersion,
  nextAssessmentAt,
  nowMs = Date.now(),
  maxAgeMs = 4 * 60 * 60_000,
}: {
  generatedAt: Date | string;
  currentContextHash: string;
  assessedContextHash: string;
  assessedEngineVersion: string;
  currentEngineVersion: string;
  nextAssessmentAt: Date | string;
  nowMs?: number;
  maxAgeMs?: number;
}) {
  const generatedMs = new Date(generatedAt).getTime();
  const nextAssessmentMs = new Date(nextAssessmentAt).getTime();
  return Number.isFinite(generatedMs)
    && Number.isFinite(nextAssessmentMs)
    && nowMs - generatedMs >= 0
    && nowMs - generatedMs < maxAgeMs
    && currentContextHash === assessedContextHash
    && assessedEngineVersion === currentEngineVersion
    && nextAssessmentMs > nowMs;
}
