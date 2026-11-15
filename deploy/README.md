# Deploying Achilles (Ubuntu VPS, Docker, Nginx + Let's Encrypt)

```
Internet ──443/80──► nginx (host) ──► 127.0.0.1:3000 frontend container ──► backend container :8000
                      TLS, redirects     Next.js + /api/achilles proxy       (Docker network only)
```

Only nginx is public. The frontend container is bound to `127.0.0.1`, and the backend is never published.
Docker-published ports bypass ufw, so the loopback bind is what keeps them private, not the firewall.

## Files

| File | Purpose |
|---|---|
| `setup-server.sh` | One-time: Docker, `deploy` user, `/opt/achilles/.env`, ufw (22/80/443), key-only SSH |
| `setup-https.sh` | Nginx + Let's Encrypt for a domain, HTTP→HTTPS, renewal, optional HSTS |
| `nginx/achilles.conf.template` | The nginx site (Mozilla "intermediate" TLS: 1.2 + 1.3) |
| `../.github/workflows/docker.yml` | CI: tests, images to Docker Hub, deploy on push to `main` |

## First-time HTTPS

Prerequisites: an A record for the domain pointing at the server, and port 80 reachable (Let's Encrypt
HTTP-01 validation). The current app must be deployed once by CI so `/opt/achilles` exists.

```bash
# from your machine, in the repo root
scp -r deploy root@SERVER:/root/achilles-deploy
ssh root@SERVER 'bash /root/achilles-deploy/setup-https.sh cyberachilles.surf'
# optional: --email you@example.com (account recovery), --staging (test against LE staging first)
```

The script backs up `/opt/achilles/.env`, `/etc/nginx` and `/etc/letsencrypt` to
`/root/achilles-backups/<timestamp>.tgz`. It also validates every nginx change with `nginx -t` and rolls back if that fails.
Expect about a minute without HTTP while the container moves from public :80 to 127.0.0.1:3000 and nginx starts.

Verify, then enable HSTS:

```bash
curl -I http://cyberachilles.surf          # 301 -> https://cyberachilles.surf/
curl -I https://cyberachilles.surf         # 200, with CSP / nosniff / Referrer-Policy headers
openssl s_client -connect cyberachilles.surf:443 -servername cyberachilles.surf -tls1_1 </dev/null  # must fail
ssh root@SERVER 'certbot renew --dry-run'
ssh root@SERVER 'bash /root/achilles-deploy/setup-https.sh cyberachilles.surf --enable-hsts'
```

HSTS is `max-age=31536000` without `includeSubDomains` or `preload`. Add those only once every
subdomain serves HTTPS, because preload is very hard to undo.

## Renewal

`certbot.timer` (systemd, survives reboots) runs twice a day and renews certificates within 30 days of expiry.
`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx` reloads nginx after a renewal.
Check it with `systemctl list-timers certbot.timer` and `certbot renew --dry-run`.

## Adding `www`

There is no `www` record today. To serve `www.cyberachilles.surf`:
1. Add DNS `CNAME www → cyberachilles.surf`.
2. Add `www.cyberachilles.surf` to `server_name` in the template.
3. Run `certbot certonly --webroot -w /var/www/letsencrypt -d cyberachilles.surf -d www.cyberachilles.surf --expand`, then rerun `setup-https.sh`.

## DNS / CDN notes

- `cyberachilles.surf` uses **Porkbun** nameservers. Records are managed in Porkbun, not GoDaddy or Cloudflare.
- Nothing proxies the site: the A record points directly at the VPS, so the Let's Encrypt certificate on the origin is the certificate visitors see.
- If you ever put Cloudflare in front, move the nameservers to Cloudflare, proxy the A record, and set SSL/TLS mode to **Full (strict)**.
  The Let's Encrypt origin cert keeps working with that, and HTTP-01 renewals still pass through the proxy.
  Never use "Flexible" mode: it sends traffic between Cloudflare and the server unencrypted and loops with the nginx redirect.

## App-level security headers

Set by Next.js (`frontend/next.config.mjs`), so they apply with or without nginx:
`Content-Security-Policy` (same-origin only; it allows `'unsafe-inline'` because Next's inline bootstrap and the
print report need it), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. HSTS is set by nginx.
