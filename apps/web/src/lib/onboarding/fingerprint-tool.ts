// Tool schema for the T-29 onboarding wrap-up. Mirrors
// packages/shared/src/types/fingerprint.ts. Anthropic enforces this schema
// at the API boundary — Claude's emit_fingerprint output is type-safe by
// construction, so when we land it in `fingerprints`, no validation
// shim is needed.

import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";

export const EMIT_FINGERPRINT_TOOL: Tool = {
  name: "emit_fingerprint",
  description:
    "Emit the completed civic fingerprint when the conversation has gathered enough information about the user to fill every required field. Include a 2-3 sentence prose summary that the user can correct.",
  input_schema: {
    type: "object",
    required: ["summary", "fingerprint"],
    properties: {
      summary: {
        type: "string",
        description:
          "2-3 sentence plain-English summary of the fingerprint. Include district, household, top priority, anti-priorities. The user reads this and confirms or corrects.",
      },
      fingerprint: {
        type: "object",
        required: [
          "user_id",
          "location",
          "housing",
          "household",
          "work",
          "priorities",
          "anti_priorities",
          "relevance_slider",
          "learned_voice_style",
          "feedback_history",
        ],
        properties: {
          user_id: {
            type: "string",
            description:
              "The handle the matcher uses for this user. Slugify the user's first name; if absent, use 'self-' + 6 random hex chars. Lowercase.",
          },
          location: {
            type: "object",
            required: [
              "city",
              "county",
              "state",
              "council_district",
              "isd",
              "state_house_district",
              "state_senate_district",
              "us_house_district",
            ],
            properties: {
              city: { type: "string" },
              county: { type: "string" },
              state: { type: "string" },
              council_district: {
                type: "integer",
                minimum: 1,
                maximum: 10,
              },
              isd: { type: "string" },
              school_zone: {
                type: ["string", "null"],
                description:
                  "Only set if the user has a school-aged kid AND told you the school. Otherwise null.",
              },
              state_house_district: { type: "integer" },
              state_senate_district: { type: "integer" },
              us_house_district: { type: "integer" },
            },
          },
          housing: {
            type: "object",
            required: ["status", "unit_type"],
            properties: {
              status: { type: "string", enum: ["renter", "owner"] },
              unit_type: { type: "string" },
              approximate_rent: {
                type: ["number", "null"],
                description:
                  "Only if renter AND user volunteered. Otherwise null.",
              },
              building_type: {
                type: ["string", "null"],
                enum: ["market_rate", "income_restricted", "owned", null],
              },
            },
          },
          household: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["role"],
              properties: {
                role: {
                  type: "string",
                  enum: ["self", "partner", "child", "parent", "other"],
                },
                age_bracket: {
                  type: ["string", "null"],
                  description:
                    "e.g. '30-39', '40-49'. Use this for adult household members.",
                },
                age: {
                  type: ["integer", "null"],
                  description: "Use this for kids; integer years.",
                },
                school: {
                  type: ["string", "null"],
                  description:
                    "Only for kid roles when the user told you the school name.",
                },
              },
            },
          },
          work: {
            type: "object",
            required: ["commute_mode", "commute_route_keywords", "sector"],
            properties: {
              commute_mode: {
                type: "string",
                enum: ["car", "bus", "bike", "walk", "remote"],
              },
              commute_route_keywords: {
                type: "array",
                items: { type: "string" },
                minItems: 0,
                maxItems: 3,
              },
              sector: { type: "string" },
            },
          },
          priorities: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: {
              type: "object",
              required: ["topic", "weight"],
              properties: {
                topic: {
                  type: "string",
                  description: "snake_case topic. e.g. housing_cost.",
                },
                weight: { type: "number", minimum: 0.4, maximum: 1.0 },
              },
            },
          },
          anti_priorities: {
            type: "array",
            minItems: 0,
            maxItems: 4,
            items: {
              type: "string",
              description: "snake_case topic the user is tired of hearing about.",
            },
          },
          relevance_slider: {
            type: "string",
            enum: ["strict", "balanced", "broad"],
          },
          learned_voice_style: {
            type: "object",
            description:
              "Empty object {} on first build. The longitudinal loop populates this from edits over time.",
          },
          feedback_history: {
            type: "array",
            description: "Empty array on first build. Populated by feedback events.",
            items: { type: "object" },
          },
        },
      },
    },
  },
};
