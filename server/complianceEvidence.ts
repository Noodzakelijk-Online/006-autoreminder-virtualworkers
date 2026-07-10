export type ComplianceCard = { id: string; name: string; url: string };

export function buildComplianceEvidence({
  doingCards,
  onHoldCards,
  commentedCardIds,
  reviewedOnHoldIds,
}: {
  doingCards: ComplianceCard[];
  onHoldCards: ComplianceCard[];
  commentedCardIds: Set<string>;
  reviewedOnHoldIds: Set<string>;
}) {
  const doingUpdated = doingCards.filter((card) => commentedCardIds.has(card.id));
  const doingMissed = doingCards.filter((card) => !commentedCardIds.has(card.id));
  const onHoldReviewed = onHoldCards.filter((card) => reviewedOnHoldIds.has(card.id));
  const onHoldMissed = onHoldCards.filter((card) => !reviewedOnHoldIds.has(card.id));
  const total = doingCards.length + onHoldCards.length;
  const compliancePct = total === 0
    ? 100
    : Math.round(((doingUpdated.length + onHoldReviewed.length) / total) * 100);

  return {
    doingUpdated,
    doingMissed,
    onHoldReviewed,
    onHoldMissed,
    compliancePct,
    potentialD1Instances: doingMissed.length,
    estimatedReviewImpact: doingMissed.length * 5,
  };
}
