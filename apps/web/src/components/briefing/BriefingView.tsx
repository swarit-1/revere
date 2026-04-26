// Client component that owns the modal state on top of the
// server-rendered briefing list. Receives all data pre-fetched server-side
// so modals open instantly without a client round-trip.
//
// Modal-state is a single discriminator — only one of source / trace can
// be open at a time. Clicking the second button while the first is open
// transitions cleanly without overlap.

"use client";

import { useState } from "react";
import type { Item } from "@revere/shared";
import { CoverHeader } from "./CoverHeader";
import { BriefingItem } from "./BriefingItem";
import { EmptyState } from "./EmptyState";
import { SourceProofModal } from "./SourceProofModal";
import { TraceModal } from "./TraceModal";
import { DraftModal } from "./DraftModal";
import type { BriefingPayload, BriefingPayloadItem } from "@/lib/queries/briefing";
import type { SourceProofClaim } from "@/lib/source-proof";
import type { ZoningExtraction } from "@/lib/queries/zoning-extraction";
import type { TracePayload } from "@/lib/queries/trace";
import type { DraftRow } from "@/lib/queries/drafts";

export interface ItemEnrichment {
  item: Item;
  proof: SourceProofClaim | null;
  itemContext: string | null;
  zoningExtraction: ZoningExtraction | null;
  trace: TracePayload | null;
  drafts: DraftRow[];
}

interface Props {
  payload: BriefingPayload;
  briefingDate: string;
  enrichmentsByItemId: Record<string, ItemEnrichment>;
}

type OpenModal =
  | { kind: "source"; itemId: string }
  | { kind: "trace"; itemId: string }
  | { kind: "draft"; itemId: string }
  | null;

export function BriefingView({ payload, briefingDate, enrichmentsByItemId }: Props) {
  const [openModal, setOpenModal] = useState<OpenModal>(null);

  if (payload.items.length === 0) {
    return <EmptyState meetingDate={briefingDate} />;
  }

  const openEnrichment = openModal ? enrichmentsByItemId[openModal.itemId] ?? null : null;
  const openPayloadItem: BriefingPayloadItem | null = openModal
    ? payload.items.find((i) => i.item_id === openModal.itemId) ?? null
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24">
      <CoverHeader raw={payload.cover_header} />
      <div>
        {payload.items.map((it, idx) => {
          const enrichment = enrichmentsByItemId[it.item_id];
          if (!enrichment) return null;
          return (
            <BriefingItem
              key={it.item_id}
              item={it}
              index={idx}
              meetingDate={briefingDate}
              councilDistrict={enrichment.item.location?.council_district ?? null}
              itemType={enrichment.item.type}
              itemContext={enrichment.itemContext}
              hasDrafts={enrichment.drafts.length > 0}
              onSourceClick={(id) => setOpenModal({ kind: "source", itemId: id })}
              onTraceClick={(id) => setOpenModal({ kind: "trace", itemId: id })}
              onDraftClick={(id) => setOpenModal({ kind: "draft", itemId: id })}
            />
          );
        })}
      </div>

      <p className="mt-12 text-label uppercase tracking-[0.12em] text-district">
        {payload.coverage.surfaced} surfaced of {payload.coverage.verified} verified
        {" "}/ {payload.coverage.candidate_items_considered} considered
      </p>

      {openModal?.kind === "source" && openEnrichment && openPayloadItem ? (
        <SourceProofModal
          open
          onClose={() => setOpenModal(null)}
          mode="full"
          item={openEnrichment.item}
          proof={openEnrichment.proof}
          headline={openPayloadItem.headline}
          zoningExtraction={openEnrichment.zoningExtraction}
        />
      ) : null}

      {openModal?.kind === "trace" && openEnrichment && openPayloadItem ? (
        <TraceModal
          open
          onClose={() => setOpenModal(null)}
          headline={openPayloadItem.headline}
          item={openEnrichment.item}
          trace={openEnrichment.trace}
        />
      ) : null}

      {openModal?.kind === "draft" && openEnrichment && openPayloadItem ? (
        <DraftModal
          open
          onClose={() => setOpenModal(null)}
          headline={openPayloadItem.headline}
          itemFileId={openEnrichment.item.id}
          councilDistrict={openEnrichment.item.location?.council_district ?? null}
          drafts={openEnrichment.drafts}
        />
      ) : null}
    </main>
  );
}
