// Client component that owns the source-proof modal state on top of the
// server-rendered briefing list. Receives all data pre-fetched server-side
// so the modal opens instantly without a client round-trip.

"use client";

import { useState } from "react";
import type { Item } from "@revere/shared";
import { CoverHeader } from "./CoverHeader";
import { BriefingItem } from "./BriefingItem";
import { EmptyState } from "./EmptyState";
import { SourceProofModal } from "./SourceProofModal";
import type { BriefingPayload, BriefingPayloadItem } from "@/lib/queries/briefing";
import type { SourceProofClaim } from "@/lib/source-proof";

export interface ItemEnrichment {
  item: Item;
  proof: SourceProofClaim | null;
  itemContext: string | null;
}

interface Props {
  payload: BriefingPayload;
  briefingDate: string;
  enrichmentsByItemId: Record<string, ItemEnrichment>;
}

export function BriefingView({ payload, briefingDate, enrichmentsByItemId }: Props) {
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  if (payload.items.length === 0) {
    return <EmptyState meetingDate={briefingDate} />;
  }

  const openItem = openItemId ? enrichmentsByItemId[openItemId] : null;
  const openPayloadItem: BriefingPayloadItem | null = openItemId
    ? payload.items.find((i) => i.item_id === openItemId) ?? null
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24">
      <CoverHeader raw={payload.cover_header} />
      <div>
        {payload.items.map((it) => {
          const enrichment = enrichmentsByItemId[it.item_id];
          if (!enrichment) return null;
          return (
            <BriefingItem
              key={it.item_id}
              item={it}
              meetingDate={briefingDate}
              councilDistrict={enrichment.item.location?.council_district ?? null}
              itemType={enrichment.item.type}
              itemContext={enrichment.itemContext}
              onSourceClick={setOpenItemId}
            />
          );
        })}
      </div>

      <p className="mt-12 text-label uppercase tracking-[0.12em] text-district">
        {payload.coverage.surfaced} surfaced of {payload.coverage.verified} verified
        {" "}/ {payload.coverage.candidate_items_considered} considered
      </p>

      {openItem && openPayloadItem ? (
        <SourceProofModal
          open
          onClose={() => setOpenItemId(null)}
          mode="minimal"
          item={openItem.item}
          proof={openItem.proof}
          headline={openPayloadItem.headline}
        />
      ) : null}
    </main>
  );
}
