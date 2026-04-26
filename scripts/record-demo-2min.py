"""Record the canonical 2-minute demo video for hackathon submission.

Beat sheet (PRD §19.2 + docs/demo-script.md):

  0:00 – 0:10  Hook            /demo/hook
  0:10 – 0:20  Two people      /demo/two-people
  0:20 – 0:40  Maya briefing   /demo?fp=maya
  0:40 – 0:55  Source proof    SourceProofModal on 26-1501 (parcel highlight)
  0:55 – 1:15  Money shot      switch to /demo?fp=jason
  1:15 – 1:35  Trace           TraceModal on Jason's 26-1501 (toggle raw report)
  1:35 – 1:55  Action flow     DraftModal — 3 variants + critic notes
  1:55 – 2:05  Close           /demo/closing

Total target: 2:05. Hard cap: 2:10.

Output: /tmp/revere-shots/recording-final-2min/{uuid}.webm
The harness script (record-demo-and-rehearsals.sh) copies the
output to docs/verification/t-32-demo-2min.webm.

Usage:
  python3 scripts/record-demo-2min.py [--out-dir <dir>]
"""
import argparse
import os
import shutil
import sys
from playwright.sync_api import sync_playwright

DEFAULT_OUT_DIR = "/tmp/revere-shots/recording-final-2min"


def hold(page, ms):
    page.wait_for_timeout(ms)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default=DEFAULT_OUT_DIR)
    parser.add_argument("--base-url", default="http://localhost:3000")
    args = parser.parse_args()

    out_dir = args.out_dir
    shutil.rmtree(out_dir, ignore_errors=True)
    os.makedirs(out_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 900},
            record_video_dir=out_dir,
            record_video_size={"width": 1280, "height": 900},
        )
        page = ctx.new_page()

        # Beat 1: hook (10s)
        page.goto(f"{args.base_url}/demo/hook")
        page.wait_for_load_state("networkidle")
        hold(page, 10000)

        # Beat 2: two-people (10s)
        page.goto(f"{args.base_url}/demo/two-people")
        page.wait_for_load_state("networkidle")
        hold(page, 10000)

        # Beat 3: Maya's briefing (20s)
        page.goto(f"{args.base_url}/demo?fp=maya")
        page.wait_for_load_state("networkidle")
        hold(page, 6000)
        # gentle scroll to show items 2-5
        page.evaluate("window.scrollBy({ top: 360, behavior: 'smooth' })")
        hold(page, 7000)
        page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })")
        hold(page, 7000)

        # Beat 4: source-proof modal (15s)
        art = page.locator("article").filter(has_text="1811 East Cesar Chavez")
        art.first.locator('button:has-text("See source")').click()
        page.wait_for_selector('[role="dialog"]')
        page.wait_for_function(
            "() => { const i = document.querySelector('[role=\"dialog\"] image'); return !!i && i.getBoundingClientRect().height > 200; }",
            timeout=8000,
        )
        # Scroll within the modal so the parcel highlight is visible
        page.locator('[role="dialog"]').evaluate(
            "(el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, 350); }"
        )
        hold(page, 15000)

        # Beat 5: money shot — switch to Jason (20s)
        page.keyboard.press("Escape")
        hold(page, 600)
        page.goto(f"{args.base_url}/demo?fp=jason")
        page.wait_for_load_state("networkidle")
        hold(page, 5000)
        # Scroll so judges see the different headlines below the rezone
        page.evaluate("window.scrollBy({ top: 280, behavior: 'smooth' })")
        hold(page, 7000)
        page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })")
        hold(page, 7000)

        # Beat 6: trace modal on Jason's 26-1501 (16s)
        art_j = page.locator("article").filter(has_text="1811 East Cesar Chavez")
        art_j.first.locator('button:has-text("Why am I seeing this?")').click()
        page.wait_for_selector('[role="dialog"]')
        hold(page, 6000)
        # Toggle View raw report
        page.locator('[role="dialog"]').get_by_text("View raw report").click()
        hold(page, 9500)

        # Beat 7: action flow — three drafts (17s)
        page.keyboard.press("Escape")
        hold(page, 400)
        art_j.first.locator('button:has-text("Draft a reply")').click()
        page.wait_for_selector('[role="dialog"]')
        hold(page, 7000)
        # Toggle the Direct column's critic notes
        page.locator('[role="dialog"]').get_by_text("What the critics caught").first.click()
        hold(page, 9500)

        # Beat 8: closing card (7s)
        page.keyboard.press("Escape")
        hold(page, 400)
        page.goto(f"{args.base_url}/demo/closing")
        page.wait_for_load_state("networkidle")
        hold(page, 6500)

        video = page.video
        page.close()
        ctx.close()
        if video:
            print(f"video saved at: {video.path()}")
        browser.close()

    files = [f for f in os.listdir(out_dir) if f.endswith(".webm")]
    if not files:
        print("ERROR: no webm produced", file=sys.stderr)
        sys.exit(1)
    print(f"out file: {out_dir}/{files[0]}")


if __name__ == "__main__":
    main()
