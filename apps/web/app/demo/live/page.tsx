// /demo/live — the live, interactive product run.
//
// Three phases the user steps through: pick a persona → watch the
// pipeline trace through every agent on real data → see their
// briefing materialize. The persona picker lets a judge re-run the
// product against a different fingerprint and watch a different
// briefing emerge.

import { LiveDemoView } from "@/components/demo-live/LiveDemoView";

export const dynamic = "force-dynamic";

export default function DemoLivePage() {
  return <LiveDemoView />;
}
