// Demo card 2 — split-screen fingerprint summary. PRD §19.2 beat 0:10–0:20.
//
// Maya slides in from the left; Jason from the right. The header settles
// first, then both columns animate in-parallel from their respective
// edges — the visual metaphor for "same district, opposite framings."
// Stat blocks within each column stagger after their parent.

export const dynamic = "force-static";

interface PersonaSummary {
  initial: string;
  name: string;
  blurb: string;
  stats: Array<{ label: string; value: string }>;
  priorities: string[];
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
    <main className="grain bg-dawn relative min-h-screen overflow-hidden bg-cream px-6 py-16">
      <div className="above-grain mx-auto max-w-5xl">
        <header className="mb-12 text-center">
          <p className="animate-fade-down font-mono text-label uppercase tracking-[0.18em] text-district">
            Same district. Same meeting.
          </p>
          <h1 className="mt-4 font-serif text-headline-sm font-semibold text-ink sm:text-headline">
            <span className="animate-fade-up inline-block delay-200">
              Two people.
            </span>{" "}
            <span className="animate-fade-up inline-block text-vermilion delay-400">
              Different lives.
            </span>
          </h1>
          <p className="animate-fade-up mx-auto mt-4 max-w-prose font-serif text-body text-ink/80 delay-600">
            Last night the Austin City Council met for four hours. Here's how
            two residents on the same block read the same meeting differently.
          </p>
          <div
            aria-hidden
            className="mx-auto mt-8 h-px w-24 origin-center animate-draw-rule bg-ink/30 delay-700"
          />
        </header>

        <div className="grid grid-cols-1 gap-0 border-y border-whisper md:grid-cols-2">
          <PersonaColumn
            persona={MAYA}
            divider="md:border-r md:border-whisper"
            entryClass="animate-slide-in-left"
            baseDelay={800}
          />
          <PersonaColumn
            persona={JASON}
            divider=""
            entryClass="animate-slide-in-right"
            baseDelay={800}
          />
        </div>

        <p className="animate-fade-up mt-12 text-center text-label uppercase tracking-[0.18em] text-district delay-1500">
          Watch what Revere sent each of them at{" "}
          <span className="text-vermilion">7am</span>.
        </p>
      </div>
    </main>
  );
}

function PersonaColumn({
  persona,
  divider,
  entryClass,
  baseDelay,
}: {
  persona: PersonaSummary;
  divider: string;
  entryClass: string;
  baseDelay: number;
}) {
  return (
    <article
      className={`${entryClass} px-8 py-10 ${divider}`}
      style={{ animationDelay: `${baseDelay}ms` }}
    >
      <div
        className="flex animate-fade-up items-start gap-4"
        style={{ animationDelay: `${baseDelay + 200}ms` }}
      >
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
        {persona.stats.map((s, i) => (
          <div
            key={s.label}
            className="animate-fade-up"
            style={{ animationDelay: `${baseDelay + 350 + i * 80}ms` }}
          >
            <dt className="text-label uppercase tracking-[0.12em] text-district">
              {s.label}
            </dt>
            <dd className="mt-1 font-mono text-body-sm text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div
        className="mt-8 animate-fade-up border-t border-whisper pt-6"
        style={{ animationDelay: `${baseDelay + 700}ms` }}
      >
        <p className="text-label uppercase tracking-[0.12em] text-district">
          Top priorities
        </p>
        <ul className="mt-3 space-y-1 font-mono text-body-sm text-ink">
          {persona.priorities.map((p) => (
            <li key={p}>
              <span className="mr-2 text-vermilion">•</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
