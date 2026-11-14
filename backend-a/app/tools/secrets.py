"""Secret patterns for the leaked-key checker. Values are always masked before leaving this module."""
from __future__ import annotations

import base64
import json
import re


def mask(s: str) -> str:
    s = s.strip()
    if len(s) <= 12:
        return s[:2] + "…" + "*" * 4
    return f"{s[:6]}…{s[-4:]}"


# (id, regex, severity, title, why, fix)
PATTERNS = [
    ("openai-key", r"\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_\-]{40,}", "critical", "OpenAI API key in client code",
     "Anyone visiting the site can copy this key and run up your OpenAI bill.",
     "Revoke the key at platform.openai.com, move OpenAI calls to a server/edge function, read the key from a server-side env var."),
    ("openai-key-legacy", r"\bsk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}\b", "critical", "OpenAI API key in client code",
     "Anyone visiting the site can copy this key and run up your OpenAI bill.",
     "Revoke the key, move OpenAI calls to a server/edge function."),
    ("anthropic-key", r"\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_\-]{80,}", "critical", "Anthropic API key in client code",
     "Anyone can use this key at your expense.", "Revoke it in the Anthropic console and call the API from a server."),
    ("xai-key", r"\bxai-[A-Za-z0-9]{50,}", "critical", "xAI (Grok) API key in client code",
     "Anyone can use this key at your expense.", "Revoke it and call the API from a server."),
    ("stripe-secret", r"\b(?:sk|rk)_live_[A-Za-z0-9]{20,}", "critical", "Stripe live secret key in client code",
     "Full access to your Stripe account: refunds, customer data, payouts.",
     "Roll the key in the Stripe dashboard immediately; only the publishable key (pk_) belongs in the browser."),
    ("stripe-test-secret", r"\bsk_test_[A-Za-z0-9]{20,}", "medium", "Stripe test secret key in client code",
     "Test-mode only, but shows secret keys are being bundled into the frontend.",
     "Move it server-side before you switch to live keys."),
    ("supabase-secret", r"\bsb_secret_[A-Za-z0-9_\-]{20,}", "critical", "Supabase secret key in client code",
     "Bypasses Row Level Security: full read/write on every table.",
     "Rotate it in Supabase > Project Settings > API, use only the publishable/anon key in the browser."),
    ("aws-access-key", r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b", "high", "AWS access key ID in client code",
     "If the matching secret is also exposed, attackers control your AWS account.",
     "Deactivate the key in IAM and use server-side credentials or presigned URLs."),
    ("github-token", r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})", "critical",
     "GitHub token in client code", "Grants access to your repositories.", "Revoke it in GitHub settings."),
    ("slack-token", r"\bxox[abprs]-[A-Za-z0-9\-]{10,}", "high", "Slack token in client code",
     "Can read or post messages in your workspace.", "Revoke it in the Slack app settings."),
    ("sendgrid-key", r"\bSG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}\b", "high", "SendGrid API key in client code",
     "Attackers can send email as you (phishing from your domain).", "Revoke it in SendGrid and send email from a server."),
    ("private-key", r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----", "critical", "Private key in client code",
     "A private key is fully exposed.", "Replace the key pair and remove it from the bundle."),
    ("google-api-key", r"\bAIza[0-9A-Za-z_\-]{35}\b", "low", "Google/Firebase API key in client code",
     "Firebase web keys are public by design, but an unrestricted Google key can be abused for paid APIs (Maps, Gemini).",
     "In Google Cloud Console restrict the key to your domains and to the APIs you use; secure Firebase with Security Rules."),
]
_COMPILED = [(p[0], re.compile(p[1]), *p[2:]) for p in PATTERNS]
JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")


def _jwt_payload(tok: str) -> dict:
    try:
        part = tok.split(".")[1]
        part += "=" * (-len(part) % 4)
        return json.loads(base64.urlsafe_b64decode(part))
    except Exception:
        return {}


def scan_text(text: str):
    """Yield (id, value, severity, title, why, fix) for each secret found (deduped by value)."""
    seen = set()
    for pid, rx, sev, title, why, fix in _COMPILED:
        for m in rx.finditer(text):
            v = m.group(0)
            if v in seen:
                continue
            seen.add(v)
            yield pid, v, sev, title, why, fix
    for m in JWT_RE.finditer(text):
        v = m.group(0)
        if v in seen:
            continue
        seen.add(v)
        p = _jwt_payload(v)
        role = p.get("role")
        if p.get("iss") == "supabase" or "supabase" in str(p.get("iss", "")) or role in ("anon", "service_role"):
            if role == "service_role":
                yield ("supabase-service-role", v, "critical", "Supabase service_role key in client code",
                       "The service_role key bypasses Row Level Security: anyone can read, change or delete every row.",
                       "Rotate the JWT secret / service key in Supabase now, use only the anon key in the browser, "
                       "and do privileged work in an Edge Function.")
            else:
                yield ("supabase-anon-key", v, "info", "Supabase anon key in client code",
                       "Normal and public by design, but it means your data is only as safe as your Row Level Security policies.",
                       "Make sure RLS is enabled on every table in Supabase > Authentication > Policies.")
        elif p.get("exp") is None and p:
            yield ("hardcoded-jwt", v, "medium", "Hard-coded non-expiring JWT in client code",
                   "A long-lived token in the bundle can be replayed by anyone.", "Issue short-lived tokens at login instead.")
