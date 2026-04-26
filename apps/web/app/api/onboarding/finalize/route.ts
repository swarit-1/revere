// POST /api/onboarding/finalize
//
// Body: { fingerprint: Fingerprint }
//
// 1. Authenticates via supabase server client.
// 2. Refuses if the user already has fingerprint_user_id set
//    (re-onboarding is out of scope for v1; an edit flow is T-29.5).
// 3. Sanity-checks the fingerprint: required fields present, no
//    house-number leakage in any string field, jurisdiction is Austin.
// 4. Picks a unique user_id (slug of self-name; falls back to short hex).
//    Avoids collision with seeded 'maya' / 'jason'.
// 5. Inserts into `fingerprints` with service-role client.
// 6. Updates auth user's app_metadata.fingerprint_user_id via admin client.
// 7. Refreshes session so the new JWT carries the metadata.
//
// Returns { ok: true, user_id }. Client refreshes /briefing.

import { NextResponse } from "next/server";
import type { Fingerprint } from "@revere/shared";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORBIDDEN_USER_IDS = new Set(["maya", "jason"]); // demo personas

// House numbers are anything starting with a digit run followed by a space
// and a word — cheap proxy for a precise street address. Council numbers
// like "District 3" are fine; "1811 East Cesar Chavez" is not.
const HOUSE_NUMBER_RE = /\b\d{2,5}\s+[A-Z]/;

function looksLikeHouseNumber(s: unknown): boolean {
  if (typeof s !== "string") return false;
  return HOUSE_NUMBER_RE.test(s);
}

function deepScanForHouseNumbers(obj: unknown): boolean {
  if (typeof obj === "string") return looksLikeHouseNumber(obj);
  if (Array.isArray(obj)) return obj.some(deepScanForHouseNumbers);
  if (obj && typeof obj === "object") {
    return Object.values(obj as Record<string, unknown>).some(deepScanForHouseNumbers);
  }
  return false;
}

function slugifyUserId(fp: Fingerprint): string {
  const self = fp.household.find((m) => m.role === "self");
  // Try fingerprint.user_id first if Claude already chose one.
  let candidate = (fp.user_id ?? "").trim().toLowerCase();
  if (!candidate && self) {
    // No first-name on the household member spec; the user_id is what
    // Claude emits. Generate a fallback from a short hex.
  }
  if (!candidate) {
    candidate = `self-${Math.random().toString(16).slice(2, 8)}`;
  }
  candidate = candidate
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!candidate || candidate.length < 2) {
    candidate = `self-${Math.random().toString(16).slice(2, 8)}`;
  }
  return candidate;
}

async function pickAvailableUserId(admin: ReturnType<typeof supabaseAdmin>, base: string): Promise<string> {
  // Try base, base-2, base-3 ... until we find one not in fingerprints
  // and not in the demo persona set.
  for (let suffix = 0; suffix < 64; suffix++) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    if (FORBIDDEN_USER_IDS.has(candidate)) continue;
    const { data, error } = await admin
      .from("fingerprints")
      .select("user_id")
      .eq("user_id", candidate)
      .maybeSingle();
    if (error) throw new Error(`uniqueness check failed: ${error.message}`);
    if (!data) return candidate;
  }
  throw new Error("could not allocate user_id");
}

interface IncomingBody {
  fingerprint: Fingerprint;
}

export async function POST(request: Request) {
  const sb = await supabaseServer();
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  // Already has a fingerprint? Refuse — re-onboarding is T-29.5.
  const existing = (user.app_metadata?.["fingerprint_user_id"] as string | undefined) ?? null;
  if (existing) {
    return NextResponse.json(
      { error: `already onboarded as fp=${existing}` },
      { status: 409 },
    );
  }

  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const fp = body.fingerprint;
  if (!fp || typeof fp !== "object") {
    return NextResponse.json({ error: "missing fingerprint" }, { status: 400 });
  }

  // Guardrail check 1: Austin only.
  const city = fp.location?.city?.trim().toLowerCase();
  const state = fp.location?.state?.trim().toLowerCase();
  if (city !== "austin" || (state !== "tx" && state !== "texas")) {
    return NextResponse.json(
      {
        error: `Revere v1 covers Austin, TX only. We've noted your interest in ${fp.location?.city ?? "your jurisdiction"}; we'll reach out when we expand.`,
      },
      { status: 422 },
    );
  }

  // Guardrail check 2: no house-number leakage anywhere.
  if (deepScanForHouseNumbers(fp)) {
    return NextResponse.json(
      {
        error:
          "Fingerprint contains what looks like a precise street address. Revere captures district-level granularity only; please re-do the location step without house numbers.",
      },
      { status: 422 },
    );
  }

  // Guardrail check 3: priorities + anti-priorities are non-empty + bounded.
  if (!Array.isArray(fp.priorities) || fp.priorities.length < 3 || fp.priorities.length > 5) {
    return NextResponse.json(
      { error: "priorities must have 3-5 entries" },
      { status: 422 },
    );
  }
  if (!Array.isArray(fp.anti_priorities) || fp.anti_priorities.length > 4) {
    return NextResponse.json(
      { error: "anti_priorities cap is 4 entries" },
      { status: 422 },
    );
  }

  const admin = supabaseAdmin();

  // Pick a unique user_id and overwrite whatever Claude emitted.
  const baseId = slugifyUserId(fp);
  const userId = await pickAvailableUserId(admin, baseId);

  const fingerprintRecord: Fingerprint = {
    ...fp,
    user_id: userId,
    learned_voice_style: fp.learned_voice_style ?? {},
    feedback_history: fp.feedback_history ?? [],
  };

  // Insert.
  const { error: insertErr } = await admin
    .from("fingerprints")
    .insert({
      user_id: userId,
      fingerprint: fingerprintRecord,
    });
  if (insertErr) {
    return NextResponse.json(
      { error: `fingerprint insert failed: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // Update auth metadata so RLS sees the fingerprint_user_id.
  const { error: metadataErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      fingerprint_user_id: userId,
    },
  });
  if (metadataErr) {
    return NextResponse.json(
      { error: `metadata update failed: ${metadataErr.message}` },
      { status: 500 },
    );
  }

  // Refresh the session so the JWT picks up the new metadata.
  const { error: refreshErr } = await sb.auth.refreshSession();
  if (refreshErr) {
    return NextResponse.json(
      { error: `session refresh failed: ${refreshErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, user_id: userId });
}
