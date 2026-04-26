// Demo card 2 — split-screen fingerprint summary. PRD §19.2 beat 0:10–0:20.
// "Maya rents in East Austin, one kid in AISD, drives I-35. Jason owns a
// duplex three blocks away..."
//
// Two columns at md+, stacked at sm. Each persona renders 4 fingerprint
// fields as a stat block + the top 3 priorities.

export const dynamic = "force-static";

interface PersonaSummary {
  initial: string;
  name: string;
  blurb: string;
  stats: Array<{ label: string; value: string }>;
  priorities: string[]; // top 3
}

const MAYA: PersonaSummary = {
  initial: "M",
  name: "Maya",
  blurb: "East Austin renter. One kid in AISD. Software job downtown.",
  stats: [
    { label: "District", value: "D3" },
    { label: "Housing", value: "Renter · 1BR market-rate" },
    { label: "School", value: "Zavala Elementary" },
    { label: "Commute", value: "I-35 by car" },
  ],
  priorities: ["housing_cost", "school_quality", "transit_reliability"],
};

const JASON: PersonaSummary = {
  initial: "J",
  name: "Jason",
  blurb: "East Austin homeowner. Coffee shop on East 6th. Walks to work.",
  stats: [
    { label: "District", value: "D3" },
    { label: "Housing", value: "Owner · duplex" },
    { label: "Sector", value: "Small business · coffee" },
    { label: "Commute", value: "Walk · East 6th" },
  ],
  priorities: ["small_business_permitting", "commercial_zoning", "tabc_rules"],
};

export default function TwoPeoplePage() {
  return (
    <main className="min-h-screen bg-cream px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 text-center">
          <p className="text-label uppercase tracking-[0.18em] text-district">
            Same district. Same meeting.
          </p>
          <h1 className="mt-4 font-serif text-headline-sm font-semibold text-ink sm:text-headline">
            Two people. <span className="text-vermilion">Different lives.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-prose font-serif text-body text-ink/80">
            Last night the Austin City Council met for four hours. Here's how
            two residents on the same block read the same meeting differently.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-0 border-y border-whisper md:grid-cols-2">
          <PersonaColumn persona={MAYA} divider="md:border-r md:border-whisper" />
          <PersonaColumn persona={JASON} divider="" />
        </div>

        <p className="mt-12 text-center text-label uppercase tracking-[0.18em] text-district">
          Watch what Revere sent each of them at <span className="text-vermilion">7am</span>.
        </p>
      </div>
    </main>
  );
}

function PersonaColumn({
  persona,
  divider,
}: {
  persona: PersonaSummary;
  divider: string;
}) {
  return (
    <article className={`px-8 py-10 ${divider}`}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center border border-ink font-serif text-2xl font-semibold text-ink"
        >
          {persona.initial}
        </span>
        <div>
          <h2 className="font-serif text-headline-sm font-semibold text-ink">
            {persona.name}
          </h2>
          <p className="mt-1 max-w-prose text-body-sm text-ink/80">
            {persona.blurb}
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4">
        {persona.stats.map((s) => (
          <div key={s.label}>
            <dt className="text-label uppercase tracking-[0.12em] text-district">
              {s.label}
            </dt>
            <dd className="mt-1 font-mono text-body-sm text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 border-t border-whisper pt-6">
        <p className="text-label uppercase tracking-[0.12em] text-district">
          Top priorities
        </p>
        <ul className="mt-3 space-y-1 font-mono text-body-sm text-ink">
          {persona.priorities.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
