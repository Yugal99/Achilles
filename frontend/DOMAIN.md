# Domain setup (GoDaddy) and running Achilles

This needs your GoDaddy login, so it can't be automated from the repo. Do these steps once.

## 1. Pick where it runs
| Part | Where | Port |
| --- | --- | --- |
| Frontend (this folder) | Vultr VM or Vercel | 3100 locally (`pnpm build && pnpm start -p 3100`) |
| Scanner API (`backend-a`) | Vultr VM (the Kali/Fedora box) | 8000 (`./run.sh`), keep it private |

The browser only talks to the frontend. The frontend's `/api/achilles/*` route forwards to the scanner using
`ACHILLES_API_URL` + `ACHILLES_API_KEY`, so the scanner never needs to be public.

## 2. Point the domain (GoDaddy → My Products → your domain → DNS)
**Frontend on a Vultr VM** (replace `203.0.113.10` with the VM's public IP):

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | `203.0.113.10` | 600 |
| CNAME | `www` | `@` | 1 hour |

**Frontend on Vercel instead:** add the domain in Vercel → Settings → Domains, then use the records Vercel shows
(usually `A @ 76.76.21.21` and `CNAME www cname.vercel-dns.com`).

Remove GoDaddy's default "parked" A record first, or the old one will keep answering.

## 3. HTTPS (Vultr VM)
Easiest is Caddy, which gets and renews the certificate itself:
```
# /etc/caddy/Caddyfile
yourdomain.com, www.yourdomain.com {
    reverse_proxy localhost:3100
}
```
`sudo systemctl reload caddy`. Wait for DNS (a few minutes up to an hour), then open `https://yourdomain.com`.

## 4. Environment on the server
```
ACHILLES_API_URL=http://localhost:8000/api/v1
ACHILLES_API_KEY=<same as backend-a/.env>
```
Firewall: open 80 and 443 only. Keep 8000 closed to the internet.

## 5. Checks
- `curl -I https://yourdomain.com` returns 200.
- `curl https://yourdomain.com/api/achilles/health` returns `{"ok":true,...}`.
- Landing page → Try Demo works with no scanner at all (canned scan).

## Verifying a customer's domain with a GoDaddy DNS TXT record
The app shows the exact record. In GoDaddy DNS add: Type `TXT`, Name `@` (or `_achilles`), Value
`achilles-verify=<token shown in the app>`, then press **Verify ownership**.
