// Entry point for the T-26 zoning-extraction pipeline. Usage:
//   tsx src/vision/extract.ts --candidate <id>            # one item
//   tsx src/vision/extract.ts --meeting <db_id>           # every zoning candidate
//   tsx src/vision/extract.ts --candidate <id> --dry-run  # no Supabase writes; print only
//
// Per the Session 7 plan, runs the two-stage Opus 4.7 vision pipeline,
// uploads the rendered page to zoning-maps storage, and persists a row
// in zoning_map_extractions. Skip-by-design: items without a zoning
// sub-object or a staff_report source.

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Item, SourceRef } from "@revere/shared";
import { supabase } from "../lib/supabase.js";
import { fetchBuffer } from "../lib/fetch.js";
import { rasterizeAllPages, rasterizeOnePageUnderByteCap, readPageBytes } from "./rasterize.js";
import { detectMapPage, localizeParcel } from "./extract-parcel.js";
import { persistExtraction } from "./persist.js";
import type { InvokeResult } from "../lib/anthropic.js";

const here = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(here, "..", "..", ".env.local"),
  resolve(here, "..", "..", "..", "..", ".env.local"),
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

interface Args {
  candidateId: number | null;
  meetingDbId: number | null;
  dryRun: boolean;
  pageCap: number; // safety cap on stage-1 thumbnails
}

function parseArgs(argv: string[]): Args {
  const args = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      flags.add(flag.slice(2));
      continue;
    }
    args.set(flag.slice(2), value);
    i++;
  }
  const cidRaw = args.get("candidate");
  const mtgRaw = args.get("meeting");
  const capRaw = args.get("page-cap");
  if (!cidRaw && !mtgRaw) {
    throw new Error("expected --candidate <id> OR --meeting <db_id>");
  }
  return {
    candidateId: cidRaw ? Number.parseInt(cidRaw, 10) : null,
    meetingDbId: mtgRaw ? Number.parseInt(mtgRaw, 10) : null,
    dryRun: flags.has("dry-run"),
    pageCap: capRaw ? Number.parseInt(capRaw, 10) : 50,
  };
}

interface CandidateRow {
  id: number;
  item: Item;
}

async function loadCandidates(args: Args): Promise<CandidateRow[]> {
  const sb = supabase();
  if (args.candidateId !== null) {
    const { data, error } = await sb
      .from("candidate_items")
      .select("id, item")
      .eq("id", args.candidateId)
      .single();
    if (error || !data) throw new Error(`candidate ${args.candidateId} not found: ${error?.message}`);
    return [{ id: data.id as number, item: data.item as Item }];
  }
  // --meeting: filter to candidates with a zoning sub-object AND a staff_report source.
  const { data, error } = await sb
    .from("candidate_items")
    .select("id, item")
    .eq("meeting_id", args.meetingDbId!)
    .order("item_file_id", { ascending: true });
  if (error || !data) throw new Error(`failed to load candidates: ${error?.message}`);
  const rows = (data as Array<{ id: number; item: Item }>).filter((r) => {
    const item = r.item;
    const hasZoning = item.zoning != null;
    const hasStaffReport = item.sources.some((s) => s.type === "staff_report");
    return hasZoning && hasStaffReport;
  });
  return rows;
}

interface Cost {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  opusCalls: number;
}
const newCost = (): Cost => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  opusCalls: 0,
});
function add(c: Cost, inv: InvokeResult): void {
  c.inputTokens += inv.inputTokens;
  c.outputTokens += inv.outputTokens;
  c.cacheReadTokens += inv.cacheReadTokens;
  c.cacheCreationTokens += inv.cacheCreationTokens;
  c.opusCalls += 1;
}

function pickStaffReport(item: Item): { source: SourceRef; index: number } | null {
  const idx = item.sources.findIndex((s) => s.type === "staff_report");
  if (idx === -1) return null;
  return { source: item.sources[idx]!, index: idx };
}

interface SmokeRecord {
  candidate_id: number;
  item_file_id: string;
  address: string | null;
  page_index: number | null;
  page_image_path: string | null;
  page_image_width: number | null;
  page_image_height: number | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  confidence: "high" | "medium" | "low";
  notes: string;
  pdf_byte_size: number;
  pdf_page_count: number;
  cost: Cost;
}

async function extractOne(row: CandidateRow, args: Args): Promise<SmokeRecord> {
  const cost = newCost();
  const item = row.item;
  const address = item.location?.address ?? item.title;
  const sr = pickStaffReport(item);
  if (!sr) {
    return {
      candidate_id: row.id,
      item_file_id: item.id,
      address,
      page_index: null,
      page_image_path: null,
      page_image_width: null,
      page_image_height: null,
      bbox: null,
      confidence: "low",
      notes: "no staff_report source on item",
      pdf_byte_size: 0,
      pdf_page_count: 0,
      cost,
    };
  }

  console.log(`[T-26] ${item.id} (${address}) → fetching ${sr.source.url}`);
  const pdfBytes = await fetchBuffer(sr.source.url);
  console.log(`[T-26] ${item.id} → PDF ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

  // Stage 0: rasterize all pages to thumbnails.
  const allPages = await rasterizeAllPages(pdfBytes, 60);
  const totalPages = allPages.length;
  console.log(`[T-26] ${item.id} → rasterized ${totalPages} pages at 60 DPI`);

  // If too many pages, sample evenly to stay under request size.
  let thumbs = allPages;
  if (totalPages > args.pageCap) {
    const step = Math.ceil(totalPages / args.pageCap);
    thumbs = allPages.filter((_, i) => i % step === 0);
    console.log(`[T-26] ${item.id} → sampled ${thumbs.length} of ${totalPages} thumbnails`);
  }

  const thumbsForCall = await Promise.all(
    thumbs.map(async (p) => ({ pageIndex: p.pageIndex, pngBytes: await readPageBytes(p) })),
  );

  // Stage 1: page detection.
  const stage1 = await detectMapPage({ address: address ?? item.title, thumbnails: thumbsForCall });
  add(cost, stage1.invocation);
  console.log(
    `[T-26] ${item.id} → stage1 page_index=${stage1.page_index} confidence=${stage1.confidence}`,
  );

  if (stage1.page_index === null) {
    const notes = `stage1: no map page found. ${stage1.raw_passage}`;
    if (!args.dryRun) {
      await persistExtraction({
        sb: supabase(),
        candidate_item_id: row.id,
        source_index: sr.index,
        page_index: null,
        page_image_bytes: null,
        page_image_width: null,
        page_image_height: null,
        bbox: null,
        confidence: "low",
        notes,
      });
    }
    return {
      candidate_id: row.id,
      item_file_id: item.id,
      address,
      page_index: null,
      page_image_path: null,
      page_image_width: null,
      page_image_height: null,
      bbox: null,
      confidence: "low",
      notes,
      pdf_byte_size: pdfBytes.length,
      pdf_page_count: totalPages,
      cost,
    };
  }

  // Stage 2: parcel localization. Re-render that page at full DPI, but
  // step DPI down if the PNG would exceed Anthropic's 5 MB image limit
  // (tabloid-size exhibits at 200 DPI commonly do). Base64 inflates ~33%,
  // so cap raw PNG at 3.5 MB to fit under after encoding.
  const { page: fullPage, bytes: fullBytes } = await rasterizeOnePageUnderByteCap(
    pdfBytes,
    stage1.page_index,
    200,
    3_500_000,
  );
  console.log(
    `[T-26] ${item.id} → page ${stage1.page_index} rendered at 200 DPI: ${fullPage.width}×${fullPage.height} (${(fullBytes.length / 1024 / 1024).toFixed(2)} MB)`,
  );

  const stage2 = await localizeParcel({
    address: address ?? item.title,
    pageImage: { pngBytes: fullBytes, width: fullPage.width, height: fullPage.height },
  });
  add(cost, stage2.invocation);
  console.log(
    `[T-26] ${item.id} → stage2 bbox=${JSON.stringify(stage2.bbox)} confidence=${stage2.confidence}`,
  );

  // Worst-of confidence between the two stages — bbox is only as trustworthy
  // as the page choice that produced it.
  const worstConf = worst(stage1.confidence, stage2.confidence);
  // Treat null bbox as low confidence regardless of model claim.
  const finalConf: "high" | "medium" | "low" = stage2.bbox === null ? "low" : worstConf;

  const notes = [
    `stage1: ${stage1.confidence} — ${stage1.raw_passage}`,
    `stage2: ${stage2.confidence} — ${stage2.raw_passage}`,
  ].join(" | ");

  if (!args.dryRun) {
    await persistExtraction({
      sb: supabase(),
      candidate_item_id: row.id,
      source_index: sr.index,
      page_index: stage1.page_index,
      page_image_bytes: fullBytes,
      page_image_width: fullPage.width,
      page_image_height: fullPage.height,
      bbox: stage2.bbox,
      confidence: finalConf,
      notes,
    });
  }

  return {
    candidate_id: row.id,
    item_file_id: item.id,
    address,
    page_index: stage1.page_index,
    page_image_path: args.dryRun ? null : `${row.id}/${stage1.page_index}.png`,
    page_image_width: fullPage.width,
    page_image_height: fullPage.height,
    bbox: stage2.bbox,
    confidence: finalConf,
    notes,
    pdf_byte_size: pdfBytes.length,
    pdf_page_count: totalPages,
    cost,
  };
}

const CONF_RANK: Record<"high" | "medium" | "low", number> = { high: 2, medium: 1, low: 0 };
function worst(a: "high" | "medium" | "low", b: "high" | "medium" | "low"): "high" | "medium" | "low" {
  return CONF_RANK[a] <= CONF_RANK[b] ? a : b;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sb = supabase();
  const startedAt = new Date().toISOString();

  const session = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: args.meetingDbId,
      runtime: "vision-extractor",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: `T-26 vision extract ${args.candidateId ? `candidate ${args.candidateId}` : `meeting ${args.meetingDbId}`}`,
    })
    .select("id")
    .single();
  if (session.error || !session.data) {
    throw new Error(`failed to open agent_sessions row: ${session.error?.message}`);
  }
  const sessionId = session.data.id as number;

  try {
    const rows = await loadCandidates(args);
    console.log(`[T-26] processing ${rows.length} candidates`);

    const results: SmokeRecord[] = [];
    const totalCost = newCost();
    let failures = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      try {
        const r = await extractOne(row, args);
        results.push(r);
        totalCost.inputTokens += r.cost.inputTokens;
        totalCost.outputTokens += r.cost.outputTokens;
        totalCost.cacheReadTokens += r.cost.cacheReadTokens;
        totalCost.cacheCreationTokens += r.cost.cacheCreationTokens;
        totalCost.opusCalls += r.cost.opusCalls;
        console.log(
          `[T-26] (${i + 1}/${rows.length}) ${row.item.id} → page=${r.page_index} bbox=${r.bbox ? "present" : "null"} confidence=${r.confidence}`,
        );
      } catch (err) {
        failures += 1;
        console.warn(`[T-26] item ${row.item.id} FAILED: ${(err as Error).message}`);
      }
    }

    const distribution = { high: 0, medium: 0, low: 0 } as Record<"high" | "medium" | "low", number>;
    for (const r of results) distribution[r.confidence] += 1;

    const noteLines = [
      `T-26 vision extract: ${results.length}/${rows.length} extractions persisted, ${failures} failures`,
      `confidence distribution: high=${distribution.high} medium=${distribution.medium} low=${distribution.low}`,
      `tokens in/out/cache_read/cache_create: ${totalCost.inputTokens}/${totalCost.outputTokens}/${totalCost.cacheReadTokens}/${totalCost.cacheCreationTokens}`,
      `opus calls: ${totalCost.opusCalls}`,
    ];

    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        items_processed: results.length,
        notes: noteLines.join(" | "),
      })
      .eq("id", sessionId);

    console.log("\n=== T-26 SUMMARY ===");
    for (const r of results) {
      console.log(
        JSON.stringify({
          item_file_id: r.item_file_id,
          page_index: r.page_index,
          page_image_path: r.page_image_path,
          page_image_width: r.page_image_width,
          page_image_height: r.page_image_height,
          bbox: r.bbox,
          confidence: r.confidence,
          pdf_pages: r.pdf_page_count,
          pdf_mb: (r.pdf_byte_size / 1024 / 1024).toFixed(2),
        }),
      );
    }
    console.log(`[T-26] DONE ${noteLines.join(" | ")}`);
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `T-26 vision extract failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
