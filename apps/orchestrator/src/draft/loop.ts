// Orchestrate writer + 3 (critic, refiner) passes. Per loop-protocol.md.
// Sequential: each refiner sees the prior critic's structured Critique +
// the prior draft + the item + fingerprint.

import type {
  CritiqueEntry,
  DraftVariant,
  Fingerprint,
  Item,
  VerificationReport,
  Voice,
} from "@revere/shared";
import type { InvokeResult } from "../lib/anthropic.js";
import { runWriter } from "./writer.js";
import { runCritic } from "./critic.js";
import { runRefiner } from "./refiner.js";
import { CRITICS_IN_ORDER } from "./critics.js";

export interface LoopArgs {
  item: Item;
  fingerprint: Fingerprint;
  verification: VerificationReport;
}

export interface LoopResult {
  variants: DraftVariant[]; // 3 final variants, one per voice
  invocations: InvokeResult[];
}

const LOOP_VERSION = "v1";

export async function runDraftLoop(args: LoopArgs): Promise<LoopResult> {
  const invocations: InvokeResult[] = [];

  // Stage 0: writer
  const writer = await runWriter(args);
  invocations.push(writer.invocation);
  console.log(`[T-21] writer emitted ${writer.variants.length} variants`);

  // Working state: variants + a per-voice critique trail.
  let current: Array<{ voice: Voice; text: string; references: string[] }> = writer.variants;
  const trailByVoice: Record<Voice, CritiqueEntry[]> = {
    direct: [],
    measured: [],
    persuasive: [],
  };

  // Stages 1..3: each critic + refiner.
  for (const critic of CRITICS_IN_ORDER) {
    const critiqueRes = await runCritic({
      critic,
      variants: current.map((v) => ({ voice: v.voice, text: v.text })),
      item: args.item,
      fingerprint: args.fingerprint,
    });
    invocations.push(critiqueRes.invocation);
    console.log(`[T-21] critic=${critic} emitted ${critiqueRes.critiques.length} critiques`);

    const refineRes = await runRefiner({
      current,
      critiques: critiqueRes.critiques,
      critic,
      item: args.item,
      fingerprint: args.fingerprint,
    });
    invocations.push(refineRes.invocation);
    console.log(`[T-21] refiner=${critic} emitted ${refineRes.variants.length} refined variants`);

    // Append a CritiqueEntry per voice; carry the refiner's response_to_critique.
    for (const refined of refineRes.variants) {
      const crit = critiqueRes.critiques.find((c) => c.voice === refined.voice);
      if (!crit) {
        throw new Error(`refiner returned voice=${refined.voice} but no matching critique`);
      }
      trailByVoice[refined.voice].push({
        critic,
        issues: crit.issues,
        remediation: crit.remediation,
        response: refined.response_to_critique,
      });
    }

    current = refineRes.variants.map((r) => ({
      voice: r.voice,
      text: r.text,
      references: r.references,
    }));
  }

  // Assemble final DraftVariant[] in stable voice order.
  const finalVariants: DraftVariant[] = (["direct", "measured", "persuasive"] as Voice[]).map(
    (v) => {
      const cur = current.find((c) => c.voice === v);
      if (!cur) throw new Error(`final loop missing voice=${v}`);
      return {
        voice: v,
        text: cur.text,
        references: cur.references,
        critique_trail: trailByVoice[v],
      };
    },
  );

  return { variants: finalVariants, invocations };
}

export function loopVersion(): string {
  return LOOP_VERSION;
}
