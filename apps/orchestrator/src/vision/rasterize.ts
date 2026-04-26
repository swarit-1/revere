// Wraps poppler's `pdftoppm` to render PDF pages to PNG bytes.
// Two render modes: low-DPI thumbnails (stage 1 page detection) and a
// single full-DPI page (stage 2 parcel localization).
//
// Why pdftoppm and not a pure-JS lib: rendering a 12.4 MB Staff Report at
// 200 DPI in pdf-lib + node-canvas pulls in ~60 MB of native deps and is
// noticeably slower per page. pdftoppm is one apt/brew install on every
// platform we care about.

import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface RenderedPage {
  pageIndex: number; // 1-based, matches PDF
  imagePath: string;
  width: number;
  height: number;
}

interface RunArgs {
  pdfBytes: Uint8Array;
  dpi: number;
  firstPage?: number;
  lastPage?: number;
}

async function runPdftoppm(args: RunArgs): Promise<RenderedPage[]> {
  const dir = join(
    tmpdir(),
    `revere-rasterize-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  const pdfPath = join(dir, "input.pdf");
  await writeFile(pdfPath, args.pdfBytes);

  const stem = "page";
  const cliArgs = ["-r", String(args.dpi), "-png"];
  if (args.firstPage) cliArgs.push("-f", String(args.firstPage));
  if (args.lastPage) cliArgs.push("-l", String(args.lastPage));
  cliArgs.push(pdfPath, join(dir, stem));

  await new Promise<void>((resolve, reject) => {
    const child = spawn("pdftoppm", cliArgs);
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`pdftoppm exited ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });
  });

  const files = (await readdir(dir))
    .filter((f) => f.startsWith(stem) && f.endsWith(".png"))
    .sort();
  const pages: RenderedPage[] = [];
  for (const f of files) {
    const m = f.match(/^page-?(\d+)\.png$/);
    if (!m) continue;
    const pageIndex = Number.parseInt(m[1]!, 10);
    const imagePath = join(dir, f);
    const bytes = await readFile(imagePath);
    const { width, height } = readPngDimensions(bytes);
    pages.push({ pageIndex, imagePath, width, height });
  }
  return pages;
}

// PNG IHDR width/height live at byte offsets 16..23 (big-endian uint32).
function readPngDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24) throw new Error("png too small");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return { width, height };
}

export async function rasterizeAllPages(
  pdfBytes: Uint8Array,
  dpi = 60,
): Promise<RenderedPage[]> {
  return runPdftoppm({ pdfBytes, dpi });
}

export async function rasterizeOnePage(
  pdfBytes: Uint8Array,
  pageIndex: number,
  dpi = 200,
): Promise<RenderedPage> {
  const pages = await runPdftoppm({
    pdfBytes,
    dpi,
    firstPage: pageIndex,
    lastPage: pageIndex,
  });
  const found = pages.find((p) => p.pageIndex === pageIndex);
  if (!found) {
    throw new Error(`pdftoppm produced no PNG for page ${pageIndex}`);
  }
  return found;
}

// Render a page at the requested DPI, but step DPI down if the resulting
// PNG would blow Anthropic's 5 MB-per-image limit. Larger paper sizes
// (tabloid, 11×17 zoning exhibits) produce 7–10 MB PNGs at 200 DPI.
// Keeping a single DPI across the codebase would either degrade 8.5×11
// crispness or break tabloid extraction.
//
// Returns the rendered bytes alongside the RenderedPage so the caller
// doesn't re-read the file from disk after we already had it in memory
// for the size check.
export async function rasterizeOnePageUnderByteCap(
  pdfBytes: Uint8Array,
  pageIndex: number,
  preferredDpi: number,
  byteCap: number,
): Promise<{ page: RenderedPage; bytes: Buffer }> {
  // Strict descent: never upscale past the requested DPI even if the cap
  // is generous — the cap is a ceiling, not a floor.
  const ladder = [preferredDpi, 150, 120, 100].filter((d, i, arr) => arr.indexOf(d) === i && d <= preferredDpi);
  if (ladder[0] !== preferredDpi) ladder.unshift(preferredDpi);
  let lastPage: RenderedPage | null = null;
  let lastBytes: Buffer | null = null;
  for (const dpi of ladder) {
    const page = await rasterizeOnePage(pdfBytes, pageIndex, dpi);
    const bytes = await readPageBytes(page);
    lastPage = page;
    lastBytes = bytes;
    if (bytes.length <= byteCap) return { page, bytes };
  }
  return { page: lastPage!, bytes: lastBytes! };
}

export async function readPageBytes(p: RenderedPage): Promise<Buffer> {
  return readFile(p.imagePath);
}
