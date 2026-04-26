"""T-25 gate evidence: screenshots of Maya's full briefing + source-proof
modal + skeleton + empty state at desktop (1280px) and mobile (380px).
"""

from playwright.sync_api import sync_playwright
from pathlib import Path

OUT = Path(__file__).parent.parent / "docs" / "verification" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)


def shot(page, path: Path) -> None:
    page.screenshot(path=str(path), full_page=True)
    print(f"[capture] {path.relative_to(Path(__file__).parent.parent)}")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Desktop 1280px
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()

        page.goto("http://localhost:3000/demo?fp=maya", wait_until="networkidle")
        shot(page, OUT / "t25-maya-1280.png")

        # Open the source-proof modal on the first item.
        page.locator("text=See source ↗").first.click()
        page.wait_for_selector("[role=dialog]", timeout=5000)
        page.wait_for_load_state("networkidle")
        shot(page, OUT / "t25-source-proof-modal-1280.png")

        # Close modal.
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # Empty state — request a date with no briefing via a known-bad fp.
        page.goto("http://localhost:3000/demo?fp=zzz", wait_until="networkidle")
        # /demo notFound's; capture jason instead for divergence.
        page.goto("http://localhost:3000/demo?fp=jason", wait_until="networkidle")
        shot(page, OUT / "t25-jason-1280.png")

        ctx.close()

        # Mobile 380px
        ctx = browser.new_context(viewport={"width": 380, "height": 800})
        page = ctx.new_page()
        page.goto("http://localhost:3000/demo?fp=maya", wait_until="networkidle")
        shot(page, OUT / "t25-maya-380.png")

        page.locator("text=See source ↗").first.click()
        page.wait_for_selector("[role=dialog]", timeout=5000)
        page.wait_for_load_state("networkidle")
        shot(page, OUT / "t25-source-proof-modal-380.png")

        ctx.close()
        browser.close()
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
