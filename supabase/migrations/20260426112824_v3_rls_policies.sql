-- Session 6 / T-23: v3 RLS policies. Authenticated read access for
-- briefing data, gated by app_metadata.fingerprint_user_id == row.user_id.
--
-- Architecture decisions (locked in docs/plans/session-6-briefing-ui.md):
-- 1. The fingerprint user_id ('maya', 'jason', etc.) lives in the auth user's
--    app_metadata, not as a separate join table. Policies read it from
--    auth.jwt() so server components inherit it without an extra fetch.
-- 2. The persona switcher's metadata mutation triggers a JWT refresh, after
--    which the next query sees the new fingerprint_user_id and the policy
--    returns the new persona's rows. T-28's gate explicitly tests this.
-- 3. service_role bypasses RLS by design. Two paths use it deliberately:
--    (a) the orchestrator (verification + matching + composing) running
--        outside any user session,
--    (b) the /demo?fp=maya|jason URL-fallback route that renders briefings
--        without auth so the demo survives a Wi-Fi failure on stage.
--    A future security pass might be tempted to "fix" the bypass — DO NOT.
--    The /demo URL is non-public; the bypass is the deliberate emergency
--    lane. See apps/web/app/demo/page.tsx for the rendering side.
-- 4. candidate_items + verification_reports stay service-role-only in v1.
--    Authenticated users reach those records transitively through
--    briefing_items joins denormalized at matcher time, so direct read
--    isn't needed yet. T-26 (hi-res maps) re-examines this.

CREATE POLICY "users read own fingerprint" ON fingerprints
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'fingerprint_user_id') = user_id
  );

CREATE POLICY "users read own briefing_items" ON briefing_items
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'fingerprint_user_id') = user_id
  );

CREATE POLICY "users read own briefings" ON briefings
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'fingerprint_user_id') = user_id
  );

-- Authenticated users join briefing_items → candidate_items + verification_reports
-- in the source-proof modal (T-25). RLS on those tables stays enabled with
-- no SELECT policy for authenticated, so direct reads return zero rows;
-- the orchestrator's denormalized payload + the /demo override (service-role)
-- are the only documented read paths.
