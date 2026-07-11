export type PortfolioStep = {
  status: string;
  blockedBy?: string | null;
  dependsOnCards?: unknown;
};

export type PortfolioCard = {
  id: string;
  name: string;
  state?: string | null;
  steps: PortfolioStep[];
};

export type AptlssPortfolioSignal = {
  directDependentCount: number;
  transitiveDependentCount: number;
  unresolvedDependencyIds: string[];
  unresolvedDependencyNames: string[];
  orphanReferences: string[];
  criticalPathDepth: number;
  isInDependencyCycle: boolean;
  cycleCardIds: string[];
  bottleneckScore: number;
};

export type AptlssPortfolioAnalysis = {
  byCard: Map<string, AptlssPortfolioSignal>;
  cycles: string[][];
  orphanReferenceCount: number;
  bottlenecks: Array<{ cardId: string; cardName: string; score: number; affectedCards: number }>;
};

const COMPLETE_STATES = new Set(["DONE_CONFIRMED", "NEEDS_ARCHIVE"]);

function normalizedName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseCardReferences(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap(parseCardReferences)));
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed !== trimmed) return parseCardReferences(parsed);
  } catch {
    // Legacy rows may contain comma- or newline-separated card references.
  }
  return Array.from(new Set(trimmed.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean)));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stronglyConnectedComponents(nodes: string[], edges: Map<string, Set<string>>) {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const components: string[][] = [];

  const visit = (node: string) => {
    indexes.set(node, index);
    lowLinks.set(node, index);
    index++;
    stack.push(node);
    onStack.add(node);

    for (const dependency of Array.from(edges.get(node) ?? [])) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(dependency)!));
      } else if (onStack.has(dependency)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indexes.get(dependency)!));
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) return;
    const component: string[] = [];
    let current: string;
    do {
      current = stack.pop()!;
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    components.push(component.sort());
  };

  for (const node of nodes) {
    if (!indexes.has(node)) visit(node);
  }
  return components;
}

export function analyzeAptlssPortfolio(cards: PortfolioCard[]): AptlssPortfolioAnalysis {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const idByName = new Map(cards.map((card) => [normalizedName(card.name), card.id]));
  const dependencies = new Map<string, Set<string>>();
  const orphans = new Map<string, Set<string>>();

  const resolveReference = (reference: string) => {
    if (cardById.has(reference)) return reference;
    const urlId = reference.match(/trello\.com\/c\/([^/?#]+)/i)?.[1];
    if (urlId && cardById.has(urlId)) return urlId;
    return idByName.get(normalizedName(reference)) ?? null;
  };

  for (const card of cards) {
    const refs = card.steps
      .filter((step) => step.status === "open")
      .flatMap((step) => [
        ...parseCardReferences(step.dependsOnCards),
        ...parseCardReferences(step.blockedBy),
      ]);
    const resolved = new Set<string>();
    const unresolved = new Set<string>();
    for (const reference of refs) {
      const target = resolveReference(reference);
      if (target) resolved.add(target);
      else unresolved.add(reference);
    }
    dependencies.set(card.id, resolved);
    orphans.set(card.id, unresolved);
  }

  const dependents = new Map(cards.map((card) => [card.id, new Set<string>()]));
  for (const [cardId, refs] of Array.from(dependencies.entries())) {
    for (const ref of Array.from(refs)) dependents.get(ref)?.add(cardId);
  }

  const components = stronglyConnectedComponents(cards.map((card) => card.id), dependencies);
  const cycles = components.filter((component) => component.length > 1 || dependencies.get(component[0])?.has(component[0]));
  const cycleByCard = new Map<string, string[]>();
  for (const cycle of cycles) {
    for (const cardId of cycle) cycleByCard.set(cardId, cycle);
  }

  const transitiveDependents = (cardId: string) => {
    const found = new Set<string>();
    const queue = Array.from(dependents.get(cardId) ?? []);
    while (queue.length) {
      const current = queue.shift()!;
      if (found.has(current) || current === cardId) continue;
      found.add(current);
      queue.push(...Array.from(dependents.get(current) ?? []));
    }
    return found;
  };

  const depthMemo = new Map<string, number>();
  const dependencyDepth = (cardId: string, visiting = new Set<string>()): number => {
    if (depthMemo.has(cardId)) return depthMemo.get(cardId)!;
    if (visiting.has(cardId)) return 0;
    const nextVisiting = new Set(visiting).add(cardId);
    const activeDependencies = Array.from(dependencies.get(cardId) ?? [])
      .filter((dependencyId) => !COMPLETE_STATES.has(cardById.get(dependencyId)?.state ?? ""));
    const depth = activeDependencies.length
      ? 1 + Math.max(...activeDependencies.map((dependencyId) => dependencyDepth(dependencyId, nextVisiting)))
      : 0;
    depthMemo.set(cardId, depth);
    return depth;
  };

  const byCard = new Map<string, AptlssPortfolioSignal>();
  for (const card of cards) {
    const direct = dependents.get(card.id)?.size ?? 0;
    const transitive = transitiveDependents(card.id).size;
    const unresolvedIds = Array.from(dependencies.get(card.id) ?? [])
      .filter((dependencyId) => !COMPLETE_STATES.has(cardById.get(dependencyId)?.state ?? ""));
    const cycle = cycleByCard.get(card.id) ?? [];
    const criticalPathDepth = dependencyDepth(card.id);
    const bottleneckScore = clamp(
      direct * 14
      + Math.max(0, transitive - direct) * 7
      + (cycle.length ? 30 : 0),
    );
    byCard.set(card.id, {
      directDependentCount: direct,
      transitiveDependentCount: transitive,
      unresolvedDependencyIds: unresolvedIds,
      unresolvedDependencyNames: unresolvedIds.map((id) => cardById.get(id)?.name ?? id),
      orphanReferences: Array.from(orphans.get(card.id) ?? []).sort(),
      criticalPathDepth,
      isInDependencyCycle: cycle.length > 0,
      cycleCardIds: cycle,
      bottleneckScore,
    });
  }

  return {
    byCard,
    cycles,
    orphanReferenceCount: Array.from(orphans.values()).reduce((sum, refs) => sum + refs.size, 0),
    bottlenecks: cards
      .map((card) => ({
        cardId: card.id,
        cardName: card.name,
        score: byCard.get(card.id)?.bottleneckScore ?? 0,
        affectedCards: byCard.get(card.id)?.transitiveDependentCount ?? 0,
      }))
      .filter((item) => item.score >= 20 || item.affectedCards > 0)
      .sort((left, right) => right.score - left.score || right.affectedCards - left.affectedCards)
      .slice(0, 10),
  };
}
