// Pure HTML + plain-text renderer for the morning briefing email.
// PRD §9.1 — "5-minute read", subject like "Revere · Tue Apr 22 · 3 items
// for you". The body mirrors the in-app briefing's editorial direction:
// newspaper serif, hairlines, cover header, per-item what/why/source.

interface PayloadItem {
  rank: number;
  candidate_item_id: number;
  item_id: string;
  headline: string;
  what_happened: string;
  why_this: string;
  post_score: number;
  surface_reason: string;
}

interface BriefingPayload {
  cover_header: string;
  items: PayloadItem[];
  coverage: {
    candidate_items_considered: number;
    verified: number;
    surfaced: number;
  };
  fingerprint_version_used: string;
  composer_version: string;
  generated_at: string;
}

export interface RenderArgs {
  payload: BriefingPayload;
  briefingDate: string; // YYYY-MM-DD
  userId: string;
  appUrl: string; // base URL for "open in browser" deep-links
  itemSummaryCap?: number; // chars; default 320
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatBriefingDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  // Date construction in local TZ; for the demo this is fine.
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getDay()];
  return `${dow} ${MONTHS[(m ?? 1) - 1]} ${d}`;
}

export function renderBriefingEmail(args: RenderArgs): RenderedEmail {
  const cap = args.itemSummaryCap ?? 320;
  const dateLabel = formatBriefingDate(args.briefingDate);
  const itemCount = args.payload.items.length;
  const subject = `Revere · ${dateLabel} · ${itemCount} item${itemCount === 1 ? "" : "s"} for you`;

  const text = renderText({ ...args, dateLabel, itemCount, cap });
  const html = renderHtml({ ...args, dateLabel, itemCount, cap });

  return { subject, text, html };
}

interface InternalArgs extends RenderArgs {
  dateLabel: string;
  itemCount: number;
  cap: number;
}

function clip(text: string, cap: number): string {
  if (text.length <= cap) return text;
  return `${text.slice(0, cap).trimEnd()}…`;
}

function renderText(args: InternalArgs): string {
  const lines: string[] = [];
  lines.push(`Revere · ${args.dateLabel} · ${args.itemCount} items for you`);
  lines.push("");
  lines.push(args.payload.cover_header);
  lines.push("");
  for (const item of args.payload.items) {
    lines.push(`${item.rank}. ${item.headline}`);
    lines.push(`   Why this matters to you: ${item.why_this}`);
    lines.push(`   ${clip(item.what_happened, args.cap)}`);
    lines.push(`   See source: ${args.appUrl}/demo?fp=${args.userId}#${item.item_id}`);
    lines.push("");
  }
  lines.push(
    `${args.payload.coverage.surfaced} surfaced of ${args.payload.coverage.verified} verified / ${args.payload.coverage.candidate_items_considered} considered`,
  );
  lines.push("");
  lines.push("Open the full briefing: " + `${args.appUrl}/demo?fp=${args.userId}`);
  lines.push("Revere never autosubmits. You always send the final reply yourself.");
  return lines.join("\n");
}

function renderHtml(args: InternalArgs): string {
  const itemBlocks = args.payload.items
    .map(
      (item) => `
        <article style="border-top:1px solid #e0d8c8;padding:24px 0">
          <p style="margin:0 0 8px 0;font:600 12px/1.2 'JetBrains Mono','Menlo',monospace;letter-spacing:.12em;text-transform:uppercase;color:#7a8a6e">
            #${item.rank} · ${escapeHtml(item.surface_reason.replace(/_/g, " "))}
          </p>
          <h2 style="margin:0 0 12px 0;font:600 22px/1.2 'Newsreader',Georgia,serif;color:#1a1a1a">
            ${escapeHtml(item.headline)}
          </h2>
          <p style="margin:0 0 12px 0;font:400 14px/1.4 'JetBrains Mono','Menlo',monospace;color:#1a1a1a;background:#f3eee0;padding:12px;border-left:2px solid #7a8a6e">
            <strong style="font-weight:600;color:#7a8a6e">WHY THIS MATTERS TO YOU</strong><br>
            ${escapeHtml(item.why_this)}
          </p>
          <p style="margin:0 0 12px 0;font:400 16px/1.5 'Newsreader',Georgia,serif;color:#1a1a1a">
            ${escapeHtml(clip(item.what_happened, args.cap))}
          </p>
          <p style="margin:0;font:400 14px/1.4 'Newsreader',Georgia,serif">
            <a href="${escapeAttr(args.appUrl)}/demo?fp=${escapeAttr(args.userId)}" style="color:#1a1a1a;border-bottom:1px solid #c8331f;text-decoration:none">
              See source ↗
            </a>
          </p>
        </article>
      `,
    )
    .join("\n");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Revere · ${args.dateLabel}</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f3ec;color:#1a1a1a">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <header style="margin-bottom:32px">
        <p style="margin:0 0 8px 0;font:600 12px/1.2 'JetBrains Mono','Menlo',monospace;letter-spacing:.12em;text-transform:uppercase;color:#7a8a6e">
          Revere · ${args.dateLabel}
        </p>
        <h1 style="margin:0;font:600 28px/1.15 'Newsreader',Georgia,serif">
          ${args.itemCount} item${args.itemCount === 1 ? "" : "s"} for you,
          <span style="color:#c8331f">@${escapeHtml(args.userId)}</span>
        </h1>
        <p style="margin:12px 0 0 0;font:400 16px/1.5 'Newsreader',Georgia,serif;color:#1a1a1a">
          ${escapeHtml(args.payload.cover_header)}
        </p>
      </header>

      ${itemBlocks}

      <footer style="margin-top:32px;border-top:1px solid #e0d8c8;padding-top:16px;font:400 13px/1.5 'Newsreader',Georgia,serif;color:#1a1a1a">
        <p style="margin:0 0 8px 0">
          <a href="${escapeAttr(args.appUrl)}/demo?fp=${escapeAttr(args.userId)}" style="color:#1a1a1a;border-bottom:1px solid #c8331f;text-decoration:none">
            Open the full briefing ↗
          </a>
        </p>
        <p style="margin:0 0 8px 0;color:#7a8a6e;font:400 12px/1.4 'JetBrains Mono','Menlo',monospace">
          ${args.payload.coverage.surfaced} surfaced of ${args.payload.coverage.verified} verified
          / ${args.payload.coverage.candidate_items_considered} considered
        </p>
        <p style="margin:0;color:#7a8a6e;font:400 12px/1.4 'JetBrains Mono','Menlo',monospace">
          Revere never autosubmits. You always send the final reply yourself.
        </p>
      </footer>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
