"""Bundled-task gate video — ~30s walk-through that seeds T-32
(pre-recorded backup).

Flow (uses /demo path because magic-link click isn't programmatically
drivable; the components are identical to the auth path):
  0–5s:   land on /demo?fp=maya, briefing renders
  5–13s:  click the top item's "See source" → modal opens with
          forensic detail, then close
  13–18s: switch to /demo?fp=jason
  18–25s: same top item (26-1501) shows different why_this lens
  25–30s: hover/click "See source" on Jason's top item, close

Saved to docs/verification/t-28-bundled-flow.webm (Playwright records
WebM-VP8 by default).
"""

import os
import sys
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright


def load_env(p: Path) -> None:
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        if line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ[k.strip()] = v.strip()


REPO = Path(__file__).parent.parent
load_env(REPO / "apps" / "web" / ".env.local")
load_env(REPO / ".env.local")

ORIGIN = "http://localhost:3000"
OUT = REPO / "docs" / "verification" / "t-28-bundled-flow.webm"
TMP = REPO / "docs" / "verification" / "_video_tmp"
TMP.mkdir(parents=True, exist_ok=True)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 800},
            record_video_dir=str(TMP),
            record_video_size={"width": 1280, "height": 800},
        )
        page = ctx.new_page()

        # Beat 1 (0–5s): land on Maya's briefing
        page.goto(f"{ORIGIN}/demo?fp=maya", wait_until="networkidle")
        page.wait_for_timeout(3500)

        # Beat 2 (5–13s): scroll to the top item, click See source, wait
        page.locator("text=See source ↗").first.scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        page.locator("text=See source ↗").first.click()
        page.wait_for_selector("[role=dialog]", timeout=4000)
        page.wait_for_timeout(4000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

        # Beat 3 (13–18s): scroll back up, then navigate to Jason
        page.evaluate("window.scrollTo(0,0)")
        page.wait_for_timeout(800)
        page.goto(f"{ORIGIN}/demo?fp=jason", wait_until="networkidle")
        page.wait_for_timeout(2500)

        # Beat 4 (18–25s): show same top item, different why_this
        page.locator("text=Rezoning hearing for 1811 East Cesar Chavez").first.scroll_into_view_if_needed()
        page.wait_for_timeout(3500)

        # Beat 5 (25–30s): click See source on Jason's top item
        page.locator("text=See source ↗").first.click()
        page.wait_for_selector("[role=dialog]", timeout=4000)
        page.wait_for_timeout(3500)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        ctx.close()  # finalizes the video file
        browser.close()

    # Find the recorded webm file and move it to the canonical name.
    webms = list(TMP.glob("*.webm"))
    if not webms:
        print("[FAIL] no .webm produced", file=sys.stderr)
        return 1
    src = max(webms, key=lambda p: p.stat().st_size)
    if OUT.exists():
        OUT.unlink()
    shutil.move(str(src), str(OUT))
    shutil.rmtree(TMP, ignore_errors=True)

    size_kb = OUT.stat().st_size / 1024
    print(f"[ok] wrote {OUT.relative_to(REPO)} ({size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
