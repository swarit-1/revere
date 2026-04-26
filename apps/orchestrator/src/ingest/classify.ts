// Per-item classifier. Takes a ParsedItem (from the Cheerio parser) and the
// raw item HTML, calls Claude with the Austin skill pack as a cached system
// prompt, and returns a fully-populated item.json record.
//
// Advisor strategy (per docs/plans/session-4-ingestion.md):
// 1. Sonnet 4.6 default.
// 2. Escalate to Opus 4.7 if:
//    - zoning sub-object has any sub-field with confidence == "low" or null,
//    - topics.length >= 3 (signals ambiguity), or
//    - topics.length == 0 (Sonnet failure mode).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";
import { sha256Hex, type Item, type Topic } from "@revere/shared";
import {
  invokeWithTool,
  OPUS,
  SONNET,
  type CachedSystemBlock,
  type InvokeResult,
} from "../lib/anthropic.js";
import type { ParsedItem } from "./legistar/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const skillPackRoot = join(
  here,
  "..",
  "..",
  "..",
  "..",
  ".claude",
  "skills",
  "jurisdictions",
  "austin-city-council",
);

function readSkillFile(rel: string): string {
  return readFileSync(join(skillPackRoot, rel), "utf8");
}

// Cached once per orchestrator run; reused across all 56 item classifications.
let cachedSkillPack: string | null = null;
function loadSkillPack(): string {
  if (cachedSkillPack) return cachedSkillPack;
  const files = [
    "SKILL.md",
    "reference/council-districts.md",
    "taxonomy/housing.md",
    "taxonomy/transportation.md",
    "taxonomy/public-safety.md",
    "taxonomy/budget.md",
    "taxonomy/land-use.md",
    "taxonomy/commercial-regulation.md",
  ];
  const blocks = files.map((f) => `=== ${f} ===\n${readSkillFile(f)}`);
  cachedSkillPack = blocks.join("\n\n");
  return cachedSkillPack;
}

const SYSTEM_INSTRUCTIONS = `You are a fact-checking ingestion classifier for Austin City Council agenda items.
You receive a single LegislationDetail item and emit a structured record via the emit_item tool.

HARD RULES:
1. Never fabricate. Every value must derive from the provided text fields, attachment metadata, or skill-pack reference data. Do not infer.
2. \`location.council_district\`: extract only when the body explicitly says "Council District N", "District N", or similar. Do not infer from street name. If absent, null.
3. \`topics\`: scan title and body for signal words from the taxonomy files in the skill pack. Emit 1 or 2 matching categories. Never 0; if truly nothing matches, emit ["budget"] for fee/budget items or escalate.
4. \`zoning\`: populate only if the item is a zoning change. Each sub-field is a {value, confidence, raw_passage} triple. Set confidence "high" when source phrasing is unambiguous, "medium" when paraphrasing was required, "low" when uncertain. Always include \`raw_passage\` (verbatim quote from the title/body).
5. \`type\` discriminator: "motion" = ordinance/resolution/vote, "public_hearing" = scheduled comment, "staff_report" = informational briefing, "consent" = en bloc, "proclamation" = ceremonial. Many zoning items are BOTH motion and public_hearing — pick "motion" and populate hearing_details.
6. \`source_classifications\`: classify each numbered attachment by its title. Common: "Staff Report" → staff_report, "Ordinance"/"Draft Ordinance" → ordinance, "Recommendation for Action" → other, "Map"/"Exhibit" → map/exhibit, public-comment summaries → public_comment.
7. Emit via emit_item. No prose, no markdown.`;

const EMIT_ITEM_TOOL: Tool = {
  name: "emit_item",
  description: "Emit the structured item.json record for this agenda item.",
  input_schema: {
    type: "object",
    required: ["type", "status", "title", "topics", "source_classifications"],
    properties: {
      type: {
        type: "string",
        enum: ["motion", "public_hearing", "staff_report", "consent", "proclamation"],
      },
      status: {
        type: "string",
        enum: [
          "Agenda Ready",
          "Approved",
          "Denied",
          "Postponed",
          "Withdrawn",
          "Enacted",
        ],
      },
      title: { type: "string" },
      body: { type: ["string", "null"] },
      sponsors: { type: "array", items: { type: "string" } },
      applicants: {
        type: ["array", "null"],
        items: { type: "string" },
      },
      location: {
        type: ["object", "null"],
        properties: {
          address: { type: ["string", "null"] },
          council_district: { type: ["integer", "null"], minimum: 0, maximum: 10 },
          neighborhood: { type: ["string", "null"] },
          watershed: { type: ["string", "null"] },
        },
      },
      hearing_details: {
        type: ["object", "null"],
        properties: {
          comment_deadline: { type: ["string", "null"] },
          in_person_time: { type: ["string", "null"] },
        },
      },
      staff_report_details: {
        type: ["object", "null"],
        properties: { authoring_department: { type: ["string", "null"] } },
      },
      zoning: {
        type: ["object", "null"],
        properties: {
          current: extractedStringSchema(),
          proposed: extractedStringSchema(),
          staff_recommendation: extractedRecSchema(),
          planning_commission_recommendation: extractedRecSchema(),
          opposition_petition_filed: extractedBoolSchema(),
        },
      },
      topics: {
        type: "array",
        minItems: 1,
        items: {
          type: "string",
          enum: [
            "housing",
            "transportation",
            "public-safety",
            "budget",
            "land-use",
            "commercial-regulation",
          ],
        },
      },
      source_classifications: {
        type: "array",
        items: {
          type: "object",
          required: ["attachment_index", "source_type"],
          properties: {
            attachment_index: { type: "integer", minimum: 0 },
            source_type: {
              type: "string",
              enum: [
                "staff_report",
                "ordinance",
                "exhibit",
                "map",
                "public_comment",
                "other",
                "agenda_pdf",
              ],
            },
            title: { type: ["string", "null"] },
          },
        },
      },
    },
  },
};

function extractedStringSchema(): unknown {
  return {
    type: "object",
    required: ["value", "confidence", "raw_passage"],
    properties: {
      value: { type: ["string", "null"] },
      confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
      raw_passage: { type: ["string", "null"] },
    },
  };
}

function extractedRecSchema(): unknown {
  return {
    type: "object",
    required: ["value", "confidence", "raw_passage"],
    properties: {
      value: {
        type: ["string", "null"],
        enum: ["approve", "deny", "other", null],
      },
      confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
      raw_passage: { type: ["string", "null"] },
    },
  };
}

function extractedBoolSchema(): unknown {
  return {
    type: "object",
    required: ["value", "confidence", "raw_passage"],
    properties: {
      value: { type: ["boolean", "null"] },
      confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
      raw_passage: { type: ["string", "null"] },
    },
  };
}

function buildSystemBlocks(): CachedSystemBlock[] {
  return [
    { type: "text", text: SYSTEM_INSTRUCTIONS },
    {
      type: "text",
      text: `=== Austin skill pack (loaded once, cached) ===\n\n${loadSkillPack()}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function buildUserMessage(args: {
  meeting_id: number;
  meeting_date: string;
  agenda_item_number: number | null;
  parsed: ParsedItem;
}): string {
  const lines: string[] = [];
  lines.push("Meeting context:");
  lines.push(`- jurisdiction: austin-city-council`);
  lines.push(`- meeting_date: ${args.meeting_date}`);
  lines.push(`- meeting_id (Legistar): ${args.meeting_id}`);
  lines.push(
    `- agenda_item_number: ${args.agenda_item_number ?? "(not numbered)"}`,
  );
  lines.push("");
  lines.push(`Item URL: ${args.parsed.item_url}`);
  lines.push("");
  lines.push("Item fields parsed from Legistar:");
  lines.push(`- File #: ${args.parsed.file_id}`);
  lines.push(`- Legistar Type: ${args.parsed.type}`);
  lines.push(`- Status: ${args.parsed.status}`);
  lines.push(`- In Control: ${args.parsed.in_control ?? "(none)"}`);
  lines.push(`- On Agenda: ${args.parsed.on_agenda ?? "(none)"}`);
  lines.push("");
  lines.push("Title (full posting; this is the substantive body for Legistar):");
  lines.push(args.parsed.title);
  lines.push("");
  if (args.parsed.attachments.length > 0) {
    lines.push("Attachments:");
    args.parsed.attachments.forEach((a, i) => {
      lines.push(`[${i}] title=${JSON.stringify(a.title)} url=${a.url}`);
    });
  } else {
    lines.push("Attachments: (none)");
  }
  lines.push("");
  lines.push("Emit the item.json record via emit_item.");
  return lines.join("\n");
}

interface SourceClassification {
  attachment_index: number;
  source_type: string;
  title?: string | null;
}

interface ToolOutput {
  type: Item["type"];
  status: Item["status"];
  title: string;
  body: string | null;
  sponsors: string[];
  applicants: string[] | null;
  location: Item["location"];
  hearing_details: Item["hearing_details"];
  staff_report_details: Item["staff_report_details"];
  zoning: Item["zoning"];
  topics: Topic[];
  source_classifications: SourceClassification[];
}

function shouldEscalate(out: ToolOutput): string | null {
  if (out.topics.length === 0) return "topics empty";
  if (out.topics.length >= 3) return `topics ambiguous (${out.topics.length})`;
  if (out.zoning) {
    const subs = [
      out.zoning.current,
      out.zoning.proposed,
      out.zoning.staff_recommendation,
      out.zoning.planning_commission_recommendation,
      out.zoning.opposition_petition_filed,
    ];
    for (const s of subs) {
      if (!s.confidence || s.confidence === "low") {
        return `zoning sub-field low confidence`;
      }
    }
  }
  return null;
}

function buildSources(args: {
  itemUrl: string;
  attachments: ParsedItem["attachments"];
  classifications: SourceClassification[];
}): Item["sources"] {
  const sources: Item["sources"] = [{ type: "item_detail", url: args.itemUrl }];
  args.attachments.forEach((att, i) => {
    const classification = args.classifications.find((c) => c.attachment_index === i);
    const t = (classification?.source_type ?? "other") as
      | "staff_report"
      | "ordinance"
      | "exhibit"
      | "map"
      | "public_comment"
      | "other"
      | "agenda_pdf";
    if (t === "agenda_pdf") {
      sources.push({ type: "agenda_pdf", url: att.url });
    } else {
      sources.push({ type: t, url: att.url, title: att.title });
    }
  });
  return sources as Item["sources"];
}

export interface ClassifyArgs {
  meeting_id: number;
  meeting_date: string;
  agenda_item_number: number | null;
  parsed: ParsedItem;
  rawHtml: string;
}

export interface ClassifyResult {
  item: Item;
  invocations: InvokeResult[];
  escalated: boolean;
  escalation_reason?: string;
}

export async function classifyItem(args: ClassifyArgs): Promise<ClassifyResult> {
  const systemBlocks = buildSystemBlocks();
  const userMessage = buildUserMessage(args);

  // Sonnet first.
  const sonnetResult = await invokeWithTool({
    model: SONNET,
    systemBlocks,
    userMessage,
    tool: EMIT_ITEM_TOOL,
    maxTokens: 2048,
  });
  let toolOut = sonnetResult.toolInput as ToolOutput;
  const invocations: InvokeResult[] = [sonnetResult];
  let escalated = false;
  let escalationReason: string | undefined;

  const reason = shouldEscalate(toolOut);
  if (reason) {
    escalated = true;
    escalationReason = reason;
    const opusResult = await invokeWithTool({
      model: OPUS,
      systemBlocks,
      userMessage,
      tool: EMIT_ITEM_TOOL,
      maxTokens: 2048,
    });
    toolOut = opusResult.toolInput as ToolOutput;
    invocations.push(opusResult);
  }

  const sources = buildSources({
    itemUrl: args.parsed.item_url,
    attachments: args.parsed.attachments,
    classifications: toolOut.source_classifications,
  });

  const item: Item = {
    id: args.parsed.file_id,
    jurisdiction: "austin-city-council",
    meeting_id: args.meeting_id,
    meeting_date: args.meeting_date,
    legistar_item_id: args.parsed.ref.id,
    legistar_item_guid: args.parsed.ref.guid,
    agenda_item_number: args.agenda_item_number ?? 0,
    type: toolOut.type,
    status: toolOut.status,
    title: toolOut.title,
    body: toolOut.body ?? null,
    sponsors: toolOut.sponsors ?? [],
    applicants: toolOut.applicants ?? null,
    location: toolOut.location ?? null,
    hearing_details: toolOut.hearing_details ?? null,
    staff_report_details: toolOut.staff_report_details ?? null,
    zoning: toolOut.zoning ?? null,
    topics: toolOut.topics as [Topic, ...Topic[]],
    sources,
    video: null,
    scraped_at: new Date().toISOString(),
    source_hash: sha256Hex(args.rawHtml),
  };

  return { item, invocations, escalated, ...(escalationReason ? { escalation_reason: escalationReason } : {}) };
}
