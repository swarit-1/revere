// Persists verification_reports rows. INSERT (not upsert): the schema
// constraint UNIQUE(candidate_item_id, verified_at) already guarantees
// uniqueness, and re-verification appends rows for audit history.

import type { VerificationReport } from "@revere/shared";
import { supabase } from "../lib/supabase.js";

export interface PersistArgs {
  candidate_item_id: number;
  report: VerificationReport;
}

export async function insertVerificationReport(args: PersistArgs): Promise<{ id: number }> {
  const { report } = args;
  const sb = supabase();
  const { data, error } = await sb
    .from("verification_reports")
    .insert({
      candidate_item_id: args.candidate_item_id,
      item_id: report.item_id,
      item_source_hash: report.item_source_hash,
      verified_at: report.verified_at,
      verifier_version: report.verifier_version,
      overall_verdict: report.overall_verdict,
      report,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      `failed to insert verification_report for ${report.item_id}: ${error?.message}`,
    );
  }
  return { id: data.id as number };
}
