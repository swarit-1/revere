// Two-stage Opus 4.7 vision pipeline for parcel localization.
//
// Stage 1: page detection. Pass low-DPI thumbnails of the Staff Report to
// Opus and ask which page contains the zoning map exhibit for the property.
// Real Staff Reports bury the parcel diagram inside 50–100 pages of text,
// so this is the load-bearing first call.
//
// Stage 2: parcel localization. Re-render the identified page at full DPI
// and ask Opus for the bounding box of the property in pixel coordinates.
// Confidence is reported separately; the modal renders no overlay on low.
//
// Why Opus 4.7 (and not Sonnet) for both stages: PRD §13.1 explicitly names
// 4.7's 3.75MP vision + 1:1 coordinate mapping as the canonical demo. The
// pixel-coordinate output is the demonstration of that capability.

import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";
import { anthropic, OPUS, type InvokeResult } from "../lib/anthropic.js";

const PAGE_DETECT_TOOL: Tool = {
  name: "report_zoning_map_page",
  description:
    "Report which 1-based page index contains the zoning map exhibit (the parcel diagram or aerial showing the property boundary). If the document has no such page, return page_index=null.",
  input_schema: {
    type: "object",
    properties: {
      page_index: {
        type: ["integer", "null"],
        description: "1-based PDF page number. null if no zoning-map page exists.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "high: clearly a parcel diagram/aerial showing the address. medium: looks like a map but address ambiguous. low: best guess.",
      },
      raw_passage: {
        type: "string",
        description: "Brief verbatim caption or label from the page that justifies the choice.",
      },
    },
    required: ["page_index", "confidence", "raw_passage"],
  },
};

const PARCEL_LOCALIZE_TOOL: Tool = {
  name: "report_parcel_bbox",
  description:
    "Return the bounding box (in pixel coordinates of THIS image) of the property highlighted on the zoning map. The origin (0,0) is the top-left corner. Width and height are in pixels. Set bbox to null if you cannot identify the parcel.",
  input_schema: {
    type: "object",
    properties: {
      bbox: {
        type: ["object", "null"],
        properties: {
          x: { type: "integer", description: "Left edge in pixels." },
          y: { type: "integer", description: "Top edge in pixels." },
          w: { type: "integer", description: "Width in pixels." },
          h: { type: "integer", description: "Height in pixels." },
        },
        required: ["x", "y", "w", "h"],
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
      },
      raw_passage: {
        type: "string",
        description:
          "Brief description of the parcel's visual cues (color, label, hatching) that justify the bbox.",
      },
    },
    required: ["bbox", "confidence", "raw_passage"],
  },
};

export interface PageDetectInput {
  address: string;
  thumbnails: Array<{ pageIndex: number; pngBytes: Buffer }>;
}

export interface PageDetectResult {
  page_index: number | null;
  confidence: "high" | "medium" | "low";
  raw_passage: string;
  invocation: InvokeResult;
}

export async function detectMapPage(args: PageDetectInput): Promise<PageDetectResult> {
  const userContent: Array<
    { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } }
  > = [
    {
      type: "text",
      text: [
        `Property: ${args.address}`,
        "",
        "I'm showing you thumbnails of every page of a Staff Report PDF for an Austin City Council rezoning case.",
        "Identify which 1-based page contains the zoning map exhibit — the parcel diagram, plat, or aerial showing the property boundary.",
        "Most rezoning Staff Reports include such an exhibit on a single page; some don't (text-only).",
        "Return the page index, confidence, and a short raw_passage justifying the choice.",
        "",
        `Thumbnails (page index labeled in caption):`,
      ].join("\n"),
    },
  ];
  for (const t of args.thumbnails) {
    userContent.push({ type: "text", text: `Page ${t.pageIndex}:` });
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: t.pngBytes.toString("base64") },
    });
  }

  const res = await anthropic().messages.create({
    model: OPUS,
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: "You are a meticulous document reviewer. Your job is to identify a single page in a multi-page PDF that contains a zoning map exhibit. Be conservative: if no page is clearly a parcel diagram or aerial, return null.",
      },
    ],
    messages: [{ role: "user", content: userContent }],
    tools: [PAGE_DETECT_TOOL],
    tool_choice: { type: "tool", name: PAGE_DETECT_TOOL.name },
  });

  type Stage1 = { page_index: number | null; confidence: "high" | "medium" | "low"; raw_passage: string };
  let parsed: Stage1 | null = null;
  for (const block of res.content) {
    if (block.type === "tool_use") {
      parsed = block.input as Stage1;
      break;
    }
  }
  if (!parsed) throw new Error(`stage1: model returned no tool_use (stop_reason=${res.stop_reason})`);
  const toolInput: Stage1 = parsed;

  const usage = res.usage as typeof res.usage & {
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
  const invocation: InvokeResult = {
    toolInput,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    model: OPUS,
  };
  return { ...toolInput, invocation };
}

export interface ParcelLocalizeInput {
  address: string;
  pageImage: { pngBytes: Buffer; width: number; height: number };
}

export interface ParcelLocalizeResult {
  bbox: { x: number; y: number; w: number; h: number } | null;
  confidence: "high" | "medium" | "low";
  raw_passage: string;
  invocation: InvokeResult;
}

export async function localizeParcel(args: ParcelLocalizeInput): Promise<ParcelLocalizeResult> {
  const res = await anthropic().messages.create({
    model: OPUS,
    max_tokens: 512,
    system: [
      {
        type: "text",
        text:
          "You receive a single high-resolution image of a zoning map exhibit. Your job is to return the bounding box of the highlighted property in PIXEL COORDINATES (x,y from top-left, width and height in pixels). Use the visible image dimensions: pages are commonly several thousand pixels on each side at 200 DPI. Be conservative on confidence: only return 'high' if the parcel is clearly outlined or labeled.",
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `Property: ${args.address}`,
              `Image dimensions: ${args.pageImage.width}px wide × ${args.pageImage.height}px tall.`,
              "",
              "Return the bounding box of the parcel for this property on the zoning exhibit below.",
              "If the property is not visibly identified (no label, no highlight, no arrow), return bbox=null.",
            ].join("\n"),
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: args.pageImage.pngBytes.toString("base64"),
            },
          },
        ],
      },
    ],
    tools: [PARCEL_LOCALIZE_TOOL],
    tool_choice: { type: "tool", name: PARCEL_LOCALIZE_TOOL.name },
  });

  type Stage2 = {
    bbox: { x: number; y: number; w: number; h: number } | null;
    confidence: "high" | "medium" | "low";
    raw_passage: string;
  };
  let parsed: Stage2 | null = null;
  for (const block of res.content) {
    if (block.type === "tool_use") {
      parsed = block.input as Stage2;
      break;
    }
  }
  if (!parsed) throw new Error(`stage2: model returned no tool_use (stop_reason=${res.stop_reason})`);
  const toolInput: Stage2 = parsed;

  const usage = res.usage as typeof res.usage & {
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
  const invocation: InvokeResult = {
    toolInput,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    model: OPUS,
  };
  return { ...toolInput, invocation };
}
