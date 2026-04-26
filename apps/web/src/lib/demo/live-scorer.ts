// Server-side live scorer for the demo runner. Lightweight,
// deterministic, no LLM calls — derives a score from the user's
// fingerprint priorities + the item's topic taxonomy + title-keyword
// hints + geography match.
//
// Returns a per-item ranked list good enough to surface a
// fingerprint-specific top-K live, in milliseconds, with no
// model spend.

import type { Fingerprint, Item } from "@revere/shared";

// Maps fingerprint priority topics → taxonomy categories that count
// as a hit. Tight on purpose — "budget" alone over-matches because
// every consent-contract item carries the budget tag, so school /
// childcare / property-tax priorities resolve via title keywords
// instead.
const FP_TOPIC_TAXONOMY: Record<string, string[]> = {
  housing_cost: ["housing", "land-use"],
  rent_stabilization: ["housing"],
  property_taxes: [],
  school_quality: [],
  childcare_access: [],
  transit_reliability: ["transportation"],
  small_business_permitting: ["commercial-regulation"],
  commercial_zoning: ["land-use", "commercial-regulation"],
  tabc_rules: ["commercial-regulation"],
  downtown_safety: ["public-safety"],
  police_accountability: ["public-safety"],
};

// Priorities that fire only when the item's title or body mentions a
// topic-specific keyword. Saves the demo from "Elena's school_quality
// matched a vegetation-management contract because both touch the
// budget tag."
const TITLE_KEYWORD_HINTS: Record<string, string[]> = {
  property_taxes: ["tax", "rate", "TIRZ", "exemption", "homestead"],
  school_quality: ["school", "AISD", "Zavala", "ISD", "education", "curriculum"],
  childcare_access: ["child", "preschool", "after-school", "early childhood", "daycare"],
  rent_stabilization: ["rent", "tenant", "stabilization", "rental"],
  housing_cost: ["affordable", "rent", "tenant", "rezone", "rezoning"],
  small_business_permitting: ["permit", "small business", "license", "ABC"],
  tabc_rules: ["TABC", "alcohol", "liquor", "bar"],
  downtown_safety: ["downtown", "6th street", "patrol"],
  police_accountability: ["police", "APD", "officer"],
  transit_reliability: ["bus", "transit", "CapMetro", "MetroRapid", "rail"],
  commercial_zoning: ["CS-", "rezone", "commercial", "zoning"],
};

export interface LiveScore {
  candidate_item_id: number;
  item_id: string; // e.g. "26-1501"
  headline: string;
  what_happened: string;
  topics: string[];
  council_district: number | null;
  geography_match: 0 | 1;
  topic_overlap: number;
  matched_priorities: string[];
  post_score: number;
  why_this: string;
}

export function scoreLive(
  fp: Fingerprint,
  candidates: Array<{ id: number; item: Item }>,
): LiveScore[] {
  return candidates.map((c) => {
    const it = c.item;
    const itD = it.location?.council_district ?? null;
    const fpD = fp.location.council_district;
    const geographyMatch: 0 | 1 = itD === fpD ? 1 : 0;

    const titleLower = it.title.toLowerCase();
    const bodyLower = (it.body ?? "").toLowerCase();

    // Score every priority. Track contribution per match so why_this
    // names the strongest fingerprint clause for this item.
    const matched: Array<{ topic: string; weight: number; contribution: number }> = [];
    let topicOverlap = 0;
    for (const pri of fp.priorities) {
      const taxonomy = FP_TOPIC_TAXONOMY[pri.topic] ?? [];
      const hints = TITLE_KEYWORD_HINTS[pri.topic] ?? [];

      const taxonomyHit = taxonomy.length > 0 && it.topics.some((t) => taxonomy.includes(t));
      const keywordHit = hints.some((h) =>
        titleLower.includes(h.toLowerCase()) || bodyLower.includes(h.toLowerCase()),
      );

      if (!taxonomyHit && !keywordHit) continue;

      // Strength: keyword hits are more specific, weighted higher;
      // taxonomy hits are coarser but still meaningful. Both at full
      // strength is a 0.7× weight contribution per priority.
      let strength = 0;
      if (taxonomyHit) strength += 0.4;
      if (keywordHit) strength += 0.5;
      strength = Math.min(0.7, strength);

      const contribution = pri.weight * strength;
      topicOverlap += contribution;
      matched.push({ topic: pri.topic, weight: pri.weight, contribution });
    }
    topicOverlap = Math.min(1, Math.round(topicOverlap * 1000) / 1000);

    // Sort matches by contribution desc, so why_this leads with the
    // strongest fingerprint clause.
    matched.sort((a, b) => b.contribution - a.contribution);

    // Score: composite that favours geography + topic matches.
    const post_score = Math.round(
      (geographyMatch * 0.4 + topicOverlap * 0.6) * 1000,
    ) / 1000;

    const why_parts: string[] = [];
    if (geographyMatch === 1) {
      why_parts.push(`location.council_district=${fpD}`);
    }
    if (matched.length > 0) {
      const top = matched[0]!;
      why_parts.push(`priorities[${top.topic}].weight=${top.weight}`);
    }

    const headlineSrc = it.title;
    const headline = headlineSrc.length > 90
      ? `${headlineSrc.slice(0, 87).trimEnd()}…`
      : headlineSrc;

    const whatHappened = (it.body ?? it.title).slice(0, 280);

    return {
      candidate_item_id: c.id,
      item_id: it.id,
      headline,
      what_happened: whatHappened,
      topics: it.topics as string[],
      council_district: itD,
      geography_match: geographyMatch,
      topic_overlap: topicOverlap,
      matched_priorities: matched.map((m) => m.topic),
      post_score,
      why_this: why_parts.length > 0 ? why_parts.join(" + ") : "fingerprint priorities did not align",
    };
  });
}

export interface BriefingSnapshot {
  cover_header: string;
  surfaced: LiveScore[];
  considered: number;
  verified: number;
  threshold: number;
}

export function summarize(
  fp: Fingerprint,
  scores: LiveScore[],
  verifiedCount: number,
): BriefingSnapshot {
  const threshold = fp.relevance_slider === "strict"
    ? 0.65
    : fp.relevance_slider === "broad"
      ? 0.4
      : 0.55;

  const sorted = [...scores].sort((a, b) => b.post_score - a.post_score);
  const surfaced = sorted.filter((s) => s.post_score >= threshold).slice(0, 7);

  return {
    cover_header: `Revere · Thu Apr 9 · ${surfaced.length} item${surfaced.length === 1 ? "" : "s"} for you`,
    surfaced,
    considered: scores.length,
    verified: verifiedCount,
    threshold,
  };
}
