export * from "./types/fingerprint";
export * from "./types/item";
export * from "./types/relevance-score";
export * from "./types/verification-report";
export * from "./types/draft";
export * from "./source-hash";

// Multi-jurisdiction + election types (added Session 10).
export type {
  GovernmentLevel,
  JurisdictionId,
  RecordKind,
  BriefingMode,
  PromiseAuthority,
  PromiseSpecificity,
  RepresentationEntry,
} from "./types/government";
export { jurisdictionId, AUTHORITY_LABELS } from "./types/government";

export type {
  ElectionRace,
  ElectionCandidate,
  ElectionPromise,
  PromiseSource,
  RaceRelevance,
  PromiseRelevance,
} from "./types/election";

export type {
  GeographyLabelInput,
  ConfidenceTier,
} from "./types/representation";
export {
  buildGeographyLabel,
  buildRepresentationLadder,
  deriveConfidenceTier,
  CONFIDENCE_LABELS,
} from "./types/representation";
