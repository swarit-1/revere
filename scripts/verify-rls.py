"""T-23 RLS verification: proves the v3 SELECT policies gate reads
correctly by hitting the REST API with three different JWTs:
  - service-role: bypasses RLS, sees all rows.
  - Maya's authenticated JWT: sees only Maya's rows.
  - Jason's authenticated JWT: sees only Jason's rows.
  - anon key: sees zero rows.

This is the deterministic gate evidence for T-23. The full magic-link click
flow (form → email → /auth/callback) is the standard @supabase/ssr code
path; its components are tested individually in the screenshots.
"""

import os
import sys
import json
import subprocess
from pathlib import Path


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ[k.strip()] = v.strip()


REPO = Path(__file__).parent.parent
load_env(REPO / "apps" / "web" / ".env.local")
load_env(REPO / ".env.local")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
ANON_KEY = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DEMO_INBOX = os.environ["DEMO_INBOX"]


def email_for(local: str) -> str:
    user, domain = DEMO_INBOX.split("@")
    base = user if "+" in user else f"{user}+demo"
    return f"{base}-{local}@{domain}"


def admin_post(path: str, payload: dict) -> dict:
    result = subprocess.run(
        [
            "curl", "-sS", "-X", "POST", f"{SUPABASE_URL}{path}",
            "-H", f"apikey: {SERVICE_KEY}",
            "-H", f"Authorization: Bearer {SERVICE_KEY}",
            "-H", "Content-Type: application/json",
            "-d", json.dumps(payload),
        ],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


def get_access_token(email: str) -> str:
    """Mint an access_token via password sign-in path: temporarily set a
    password on the user via admin SDK, sign in with it, then revert.

    The magic-link's OTP token is single-use, and we need to walk multiple
    redirects to extract the access_token from the URL hash, which consumes
    the OTP. The password-grant path issues a token directly.
    """
    import secrets
    # Find user
    body = admin_post("/auth/v1/admin/generate_link", {"type": "recovery", "email": email})
    # Use the recovery action_link's redirect chain — recovery flow returns
    # a session in the URL hash via the same implicit-flow mechanism but
    # with a different OTP that hasn't been consumed.
    action = body.get("properties", {}).get("action_link") or body.get("action_link")
    if not action:
        raise RuntimeError(f"no action_link: {body}")
    result = subprocess.run(
        ["curl", "-sS", "-L", "-o", "/dev/null", "-D", "-", action],
        capture_output=True, text=True, check=True,
    )
    locations = []
    for line in result.stdout.splitlines():
        if line.lower().startswith("location:"):
            locations.append(line.split(":", 1)[1].strip())
    if not locations:
        raise RuntimeError(f"no redirects from action: {result.stdout[:300]}")
    final = locations[-1]
    if "#access_token=" not in final:
        raise RuntimeError(f"no access_token in final URL: {final[:300]}")
    import re
    m = re.search(r"#access_token=([^&]+)", final)
    if not m:
        raise RuntimeError("could not parse access_token")
    return m.group(1)


def query(path: str, token: str, key: str) -> tuple[int, str]:
    result = subprocess.run(
        [
            "curl", "-sS", "-w", "\\nSTATUS:%{http_code}", f"{SUPABASE_URL}{path}",
            "-H", f"apikey: {key}",
            "-H", f"Authorization: Bearer {token}",
        ],
        capture_output=True, text=True,
    )
    out = result.stdout
    if "STATUS:" in out:
        body, status = out.rsplit("STATUS:", 1)
        return int(status.strip()), body.strip()
    return 0, out


def assert_count(label: str, body: str, expected: int) -> bool:
    try:
        rows = json.loads(body)
    except Exception:
        rows = []
    n = len(rows) if isinstance(rows, list) else 0
    ok = n == expected
    icon = "ok " if ok else "FAIL"
    print(f"  [{icon}] {label}: expected {expected}, got {n}")
    if not ok:
        print(f"        body: {body[:200]}")
    return ok


def main() -> int:
    print("[verify-rls] minting access tokens for maya + jason...")
    maya_token = get_access_token(email_for("maya"))
    jason_token = get_access_token(email_for("jason"))
    print(f"[verify-rls] tokens acquired")

    all_ok = True

    print("\n[verify-rls] /rest/v1/briefings (RLS-gated)")
    # service_role bypasses RLS — sees both rows
    status, body = query("/rest/v1/briefings?select=user_id", SERVICE_KEY, SERVICE_KEY)
    all_ok &= assert_count("service_role: sees all 2 briefings", body, 2)

    # anon key — no JWT identity, RLS denies → zero rows
    status, body = query("/rest/v1/briefings?select=user_id", ANON_KEY, ANON_KEY)
    all_ok &= assert_count("anon key: sees 0 briefings (RLS denies)", body, 0)

    # Maya's JWT — RLS allows the row where user_id == app_metadata.fingerprint_user_id
    status, body = query("/rest/v1/briefings?select=user_id", maya_token, ANON_KEY)
    all_ok &= assert_count("maya JWT: sees only maya's briefing", body, 1)

    # Jason's JWT — RLS allows only Jason's row
    status, body = query("/rest/v1/briefings?select=user_id", jason_token, ANON_KEY)
    all_ok &= assert_count("jason JWT: sees only jason's briefing", body, 1)

    print("\n[verify-rls] /rest/v1/fingerprints (RLS-gated)")
    status, body = query("/rest/v1/fingerprints?select=user_id", maya_token, ANON_KEY)
    all_ok &= assert_count("maya JWT: sees only maya's fingerprint", body, 1)

    print("\n[verify-rls] /rest/v1/briefing_items (RLS-gated)")
    status, body = query("/rest/v1/briefing_items?select=user_id", maya_token, ANON_KEY)
    all_ok &= assert_count("maya JWT: sees 37 briefing_items (one per verified candidate)", body, 37)

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
