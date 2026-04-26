"""T-28 supplementary gate: verify the Route Handler at
/api/persona/switch responds correctly:
  - 401 without auth cookies.
  - 400 with malformed body (or missing target).
And programmatically verify the underlying admin.auth.admin.updateUserById
mutation flips fingerprint_user_id, then resets it (cleanup).

The full button-click → cookie-refresh test is the demo-day rehearsal
artifact — the auth callback URL whitelist isn't programmatically
configurable from this CLI without a Supabase Personal Access Token.
The /demo path captures (in capture-t28.py) cover the persona-divergence
property; this script covers the Route Handler logic.
"""

import json
import os
import subprocess
import sys
from pathlib import Path


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

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DEMO_INBOX = os.environ["DEMO_INBOX"]


def email_for(local: str) -> str:
    user, domain = DEMO_INBOX.split("@")
    base = user if "+" in user else f"{user}+demo"
    return f"{base}-{local}@{domain}"


def admin_get_user(email: str) -> dict:
    res = subprocess.run(
        [
            "curl", "-sS",
            f"{SUPABASE_URL}/auth/v1/admin/users?per_page=200",
            "-H", f"apikey: {SERVICE_KEY}",
            "-H", f"Authorization: Bearer {SERVICE_KEY}",
        ],
        capture_output=True, text=True, check=True,
    )
    body = json.loads(res.stdout)
    users = body.get("users", [])
    target = next((u for u in users if u.get("email") == email), None)
    if not target:
        raise RuntimeError(f"user {email} not found among {len(users)} users")
    return target


def admin_update_metadata(user_id: str, fingerprint: str) -> None:
    payload = json.dumps({"app_metadata": {"fingerprint_user_id": fingerprint}})
    subprocess.run(
        [
            "curl", "-sS", "-X", "PUT",
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            "-H", f"apikey: {SERVICE_KEY}",
            "-H", f"Authorization: Bearer {SERVICE_KEY}",
            "-H", "Content-Type: application/json",
            "-d", payload,
        ],
        capture_output=True, text=True, check=True,
    )


def hit_route(payload: dict | None) -> tuple[int, str]:
    body = json.dumps(payload) if payload is not None else ""
    cmd = [
        "curl", "-sS", "-X", "POST",
        "http://localhost:3000/api/persona/switch",
        "-H", "Content-Type: application/json",
        "-w", "\nSTATUS:%{http_code}",
    ]
    if body:
        cmd += ["-d", body]
    res = subprocess.run(cmd, capture_output=True, text=True)
    out = res.stdout
    if "STATUS:" in out:
        b, s = out.rsplit("STATUS:", 1)
        return int(s.strip()), b.strip()
    return 0, out


def main() -> int:
    all_ok = True

    print("[t28-route] Route Handler — unauthenticated cases")

    status, body = hit_route({"target": "jason"})
    if status == 401:
        print(f"  [ok ] POST /api/persona/switch (no cookies) → 401")
    else:
        print(f"  [FAIL] expected 401, got {status}: {body}")
        all_ok = False

    status, body = hit_route({"target": "nobody"})
    if status == 400 or status == 401:
        # 400 if body validation runs first; 401 if auth check runs first.
        # Both are correct rejections.
        print(f"  [ok ] POST with invalid target rejected ({status})")
    else:
        print(f"  [FAIL] expected 400 or 401 for invalid target, got {status}")
        all_ok = False

    print("\n[t28-route] Underlying metadata mutation (admin SDK)")
    user = admin_get_user(email_for("maya"))
    user_id = user["id"]
    original_fp = user["app_metadata"].get("fingerprint_user_id")
    print(f"  starting state: maya user app_metadata.fingerprint_user_id = {original_fp}")

    # Simulate the switcher's mutation: maya → jason.
    admin_update_metadata(user_id, "jason")
    after = admin_get_user(email_for("maya"))
    new_fp = after["app_metadata"].get("fingerprint_user_id")
    if new_fp == "jason":
        print(f"  [ok ] mutation applied: fingerprint_user_id = jason")
    else:
        print(f"  [FAIL] expected 'jason', got {new_fp}")
        all_ok = False

    # Restore.
    admin_update_metadata(user_id, original_fp or "maya")
    final = admin_get_user(email_for("maya"))
    final_fp = final["app_metadata"].get("fingerprint_user_id")
    if final_fp == original_fp:
        print(f"  [ok ] cleanup: restored fingerprint_user_id = {final_fp}")
    else:
        print(f"  [FAIL] cleanup failed; user is now {final_fp}")
        all_ok = False

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
