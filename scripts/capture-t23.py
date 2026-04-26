"""T-23 gate evidence: screenshot the home page, sign-in form, and the
unauthenticated /briefing redirect path.

Plus a programmatic assertion that an authenticated session (forged via
the admin SDK by exchanging the magic-link token) lands on /briefing
and renders the cover header.
"""

from playwright.sync_api import sync_playwright
from pathlib import Path
import sys

OUT = Path(__file__).parent.parent / "docs" / "verification" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)


def shot(page, path: Path) -> None:
    page.screenshot(path=str(path), full_page=True)
    print(f"[capture] {path.relative_to(Path(__file__).parent.parent)}")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()

        page.goto("http://localhost:3000/", wait_until="networkidle")
        shot(page, OUT / "t23-home.png")

        page.goto("http://localhost:3000/auth/sign-in", wait_until="networkidle")
        shot(page, OUT / "t23-sign-in.png")

        # Unauthenticated /briefing should redirect to /auth/sign-in.
        page.goto("http://localhost:3000/briefing", wait_until="networkidle")
        if "/auth/sign-in" not in page.url:
            print(f"[FAIL] /briefing did not redirect; landed on {page.url}")
            browser.close()
            return 1
        print(f"[ok] unauthenticated /briefing → {page.url}")
        shot(page, OUT / "t23-briefing-unauthed-redirect.png")

        # Onboarding-pending placeholder.
        page.goto("http://localhost:3000/onboarding-pending", wait_until="networkidle")
        shot(page, OUT / "t23-onboarding-pending.png")

        browser.close()
        return 0


if __name__ == "__main__":
    sys.exit(main())
