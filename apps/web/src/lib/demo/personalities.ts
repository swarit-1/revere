// Preset personalities for the live demo runner. The fingerprints are
// real — they get scored against the actual candidate_items in
// Supabase so the per-persona briefing genuinely differs. Maya and
// Jason are the seeded demo personas (their fingerprints are already
// in the `fingerprints` table). The other four are synthesized for
// the live demo and never get persisted — they're transient
// fingerprints for the runner.

import type { Fingerprint } from "@revere/shared";

export interface Persona {
  id: string;
  display_name: string;
  initials: string;
  // ≤ 80 chars — used on the persona card
  blurb: string;
  // Three top priorities, displayed on the card
  signature_priorities: string[];
  fingerprint: Fingerprint;
  // For Maya/Jason: 'persisted' (pull from briefings table).
  // For new personas: 'live' (run the matcher fresh).
  source: "persisted" | "live";
}

const COMMON_LOCATION = {
  city: "Austin",
  county: "Travis",
  state: "TX",
  isd: "Austin ISD",
  state_house_district: 51,
  state_senate_district: 14,
  us_house_district: 35,
};

export const PERSONALITIES: Persona[] = [
  {
    id: "maya",
    display_name: "Maya",
    initials: "M",
    blurb: "East Austin renter. One kid in AISD. Software job downtown.",
    signature_priorities: ["housing_cost", "school_quality", "transit_reliability"],
    source: "persisted",
    fingerprint: {
      user_id: "maya",
      location: { ...COMMON_LOCATION, council_district: 3, school_zone: "Zavala Elementary" },
      housing: { status: "renter", unit_type: "1BR apartment", building_type: "market_rate", approximate_rent: 1850 },
      household: [
        { role: "self", age_bracket: "30-39" },
        { role: "child", age: 7, school: "Zavala Elementary" },
      ],
      work: { commute_mode: "car", commute_route_keywords: ["I-35", "downtown"], sector: "software" },
      priorities: [
        { topic: "housing_cost", weight: 0.9 },
        { topic: "school_quality", weight: 0.8 },
        { topic: "transit_reliability", weight: 0.7 },
        { topic: "police_accountability", weight: 0.6 },
        { topic: "childcare_access", weight: 0.5 },
      ],
      anti_priorities: ["dog_parks", "ceremonial_proclamations"],
      relevance_slider: "balanced",
      learned_voice_style: {},
      feedback_history: [],
    },
  },
  {
    id: "jason",
    display_name: "Jason",
    initials: "J",
    blurb: "East Austin homeowner. Coffee shop on East 6th. Walks to work.",
    signature_priorities: ["small_business_permitting", "commercial_zoning", "tabc_rules"],
    source: "persisted",
    fingerprint: {
      user_id: "jason",
      location: { ...COMMON_LOCATION, council_district: 3 },
      housing: { status: "owner", unit_type: "duplex", building_type: "owned" },
      household: [{ role: "self", age_bracket: "40-49" }],
      work: { commute_mode: "walk", commute_route_keywords: ["E 6th", "East 6th", "downtown"], sector: "small_business" },
      priorities: [
        { topic: "property_taxes", weight: 0.9 },
        { topic: "small_business_permitting", weight: 0.9 },
        { topic: "commercial_zoning", weight: 0.8 },
        { topic: "tabc_rules", weight: 0.8 },
        { topic: "downtown_safety", weight: 0.7 },
      ],
      anti_priorities: ["school_board_politics", "suburban_annexation"],
      relevance_slider: "balanced",
      learned_voice_style: {},
      feedback_history: [],
    },
  },
  {
    id: "elena",
    display_name: "Elena",
    initials: "E",
    blurb: "Riverside renter. Two kids at Zavala. Bus commute. Spanish-preferred.",
    signature_priorities: ["school_quality", "childcare_access", "transit_reliability"],
    source: "live",
    fingerprint: {
      user_id: "elena",
      location: { ...COMMON_LOCATION, council_district: 3, school_zone: "Zavala Elementary" },
      housing: { status: "renter", unit_type: "2BR apartment", building_type: "market_rate" },
      household: [
        { role: "self", age_bracket: "30-39" },
        { role: "child", age: 9, school: "Zavala Elementary" },
        { role: "child", age: 6, school: "Zavala Elementary" },
      ],
      work: { commute_mode: "bus", commute_route_keywords: ["Riverside", "downtown"], sector: "hospitality" },
      priorities: [
        { topic: "school_quality", weight: 0.95 },
        { topic: "childcare_access", weight: 0.85 },
        { topic: "transit_reliability", weight: 0.8 },
        { topic: "housing_cost", weight: 0.7 },
        { topic: "police_accountability", weight: 0.5 },
      ],
      anti_priorities: ["downtown_safety", "ceremonial_proclamations"],
      relevance_slider: "broad",
      learned_voice_style: {},
      feedback_history: [],
    },
  },
  {
    id: "darren",
    display_name: "Darren",
    initials: "D",
    blurb: "South Austin homeowner. Tech contractor. Commutes I-35 daily.",
    signature_priorities: ["transit_reliability", "property_taxes", "downtown_safety"],
    source: "live",
    fingerprint: {
      user_id: "darren",
      location: { ...COMMON_LOCATION, council_district: 5 },
      housing: { status: "owner", unit_type: "single-family", building_type: "owned" },
      household: [
        { role: "self", age_bracket: "40-49" },
        { role: "partner", age_bracket: "40-49" },
      ],
      work: { commute_mode: "car", commute_route_keywords: ["I-35", "MoPac"], sector: "tech" },
      priorities: [
        { topic: "transit_reliability", weight: 0.85 },
        { topic: "property_taxes", weight: 0.85 },
        { topic: "downtown_safety", weight: 0.7 },
        { topic: "housing_cost", weight: 0.5 },
        { topic: "police_accountability", weight: 0.5 },
      ],
      anti_priorities: ["ceremonial_proclamations", "sister_city_proclamations"],
      relevance_slider: "broad",
      learned_voice_style: {},
      feedback_history: [],
    },
  },
  {
    id: "rosa",
    display_name: "Rosa",
    initials: "R",
    blurb: "North Loop renter. Local journalist. Bikes everywhere.",
    signature_priorities: ["police_accountability", "housing_cost", "commercial_zoning"],
    source: "live",
    fingerprint: {
      user_id: "rosa",
      location: { ...COMMON_LOCATION, council_district: 9 },
      housing: { status: "renter", unit_type: "studio", building_type: "market_rate" },
      household: [{ role: "self", age_bracket: "20-29" }],
      work: { commute_mode: "bike", commute_route_keywords: ["Lamar", "downtown"], sector: "media" },
      priorities: [
        { topic: "police_accountability", weight: 0.9 },
        { topic: "housing_cost", weight: 0.85 },
        { topic: "commercial_zoning", weight: 0.7 },
        { topic: "transit_reliability", weight: 0.6 },
        { topic: "downtown_safety", weight: 0.6 },
      ],
      anti_priorities: ["sister_city_proclamations", "ceremonial_proclamations"],
      relevance_slider: "broad",
      learned_voice_style: {},
      feedback_history: [],
    },
  },
  {
    id: "kai",
    display_name: "Kai",
    initials: "K",
    blurb: "Mueller homeowner. Two-restaurant family. Property-tax sensitive.",
    signature_priorities: ["small_business_permitting", "property_taxes", "downtown_safety"],
    source: "live",
    fingerprint: {
      user_id: "kai",
      location: { ...COMMON_LOCATION, council_district: 9 },
      housing: { status: "owner", unit_type: "townhouse", building_type: "owned" },
      household: [
        { role: "self", age_bracket: "30-39" },
        { role: "partner", age_bracket: "30-39" },
        { role: "child", age: 4 },
      ],
      work: { commute_mode: "walk", commute_route_keywords: ["Mueller", "Manor Road"], sector: "restaurant" },
      priorities: [
        { topic: "small_business_permitting", weight: 0.9 },
        { topic: "property_taxes", weight: 0.85 },
        { topic: "downtown_safety", weight: 0.7 },
        { topic: "tabc_rules", weight: 0.7 },
        { topic: "childcare_access", weight: 0.6 },
      ],
      anti_priorities: ["sister_city_proclamations"],
      relevance_slider: "balanced",
      learned_voice_style: {},
      feedback_history: [],
    },
  },
];

export function findPersona(id: string): Persona | undefined {
  return PERSONALITIES.find((p) => p.id === id);
}

export function randomPersona(): Persona {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)]!;
}
