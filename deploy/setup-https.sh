#!/usr/bin/env bash
# HTTPS for an Achilles server: Nginx (host) + Let's Encrypt (certbot, HTTP-01 webroot).
# Run as root on the server, from a copy of this repo's deploy/ folder:
#
#   bash setup-https.sh <domain> [--email you@example.com] [--staging]   # issue cert, serve HTTPS
#   bash setup-https.sh <domain> --enable-hsts                          # later, once HTTPS is verified
#
# What it changes (everything is backed up first to /root/achilles-backups/<timestamp>.tgz):
#   - installs nginx + certbot (apt)
#   - /opt/achilles/.env: the web container listens on 127.0.0.1:3000 only (no longer public on :80)
#   - /etc/nginx/sites-available/achilles (+ symlink), disables the stock "default" site
#   - /etc/letsencrypt: certificate for <domain>, renewal via certbot.timer + an nginx reload hook
# Idempotent: rerunning re-renders the config and reuses the existing certificate.
set -euo pipefail

DOMAIN="${1:-}"; shift || true
EMAIL=""; STAGING=0; HSTS=0
while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="${2:?--email needs a value}"; shift 2 ;;
    --staging) STAGING=1; shift ;;
    --enable-hsts) HSTS=1; shift ;;
    *) echo "unknown option: $1"; exit 2 ;;
  esac
done
[ -n "$DOMAIN" ] || { echo "usage: setup-https.sh <domain> [--email addr] [--staging] [--enable-hsts]"; exit 2; }
[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$HERE/nginx/achilles.conf.template"
APP_DIR=/opt/achilles
SITE=/etc/nginx/sites-available/achilles
HSTS_SNIPPET=/etc/nginx/snippets/achilles-hsts.conf
WEBROOT=/var/www/letsencrypt
UPSTREAM=127.0.0.1:3000
[ -f "$TEMPLATE" ] || { echo "missing $TEMPLATE"; exit 1; }

say() { printf '\n==> %s\n' "$*"; }

# ---------------------------------------------------------------- HSTS-only mode
if [ "$HSTS" -eq 1 ]; then
  say "Enabling HSTS (max-age 1 year, no includeSubDomains, no preload)"
  [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] || { echo "no certificate for $DOMAIN yet; run without --enable-hsts first"; exit 1; }
  cp -a "$HSTS_SNIPPET" "$HSTS_SNIPPET.bak" 2>/dev/null || true
  echo 'add_header Strict-Transport-Security "max-age=31536000" always;' > "$HSTS_SNIPPET"
  if nginx -t; then systemctl reload nginx; echo "HSTS on."; else
    mv "$HSTS_SNIPPET.bak" "$HSTS_SNIPPET"; echo "nginx -t failed; HSTS change reverted"; exit 1; fi
  exit 0
fi

# ---------------------------------------------------------------- preflight
say "Preflight"
SERVER_IPS=" $(hostname -I) "
DNS_IPS=$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u | tr '\n' ' ')
echo "  $DOMAIN resolves to: ${DNS_IPS:-nothing}"
echo "  this server's IPs:   $SERVER_IPS"
for ip in $DNS_IPS; do
  case "$SERVER_IPS" in *" $ip "*) ;; *) echo "  ! $DOMAIN points at $ip, which is not this server. Fix DNS first."; exit 1 ;; esac
done
[ -n "$DNS_IPS" ] || { echo "  ! $DOMAIN has no A record"; exit 1; }
[ -f "$APP_DIR/.env" ] && [ -f "$APP_DIR/docker-compose.yml" ] || { echo "  ! $APP_DIR is not set up (run setup-server.sh and deploy once)"; exit 1; }
grep -q 'ACHILLES_WEB_BIND' "$APP_DIR/docker-compose.yml" || { echo "  ! $APP_DIR/docker-compose.yml is older than this script; deploy the latest main first"; exit 1; }

# ---------------------------------------------------------------- backup
TS=$(date +%Y%m%d-%H%M%S)
say "Backing up current config to /root/achilles-backups/$TS.tgz"
mkdir -p /root/achilles-backups; chmod 700 /root/achilles-backups
tar -czf "/root/achilles-backups/$TS.tgz" --ignore-failed-read \
  "$APP_DIR/.env" "$APP_DIR/docker-compose.yml" /etc/nginx /etc/letsencrypt 2>/dev/null || true

# ---------------------------------------------------------------- packages
say "Installing nginx and certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
# policy-rc.d keeps apt from starting nginx while Docker still holds port 80.
printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d; chmod +x /usr/sbin/policy-rc.d
trap 'rm -f /usr/sbin/policy-rc.d' EXIT
apt-get install -y -qq nginx certbot
rm -f /usr/sbin/policy-rc.d
nginx -v

# ---------------------------------------------------------------- app: stop listening publicly
say "Moving the web container to 127.0.0.1:3000 (nginx becomes the only public listener)"
setenv() {  # key value -> set or append in .env
  if grep -q "^$1=" "$APP_DIR/.env"; then sed -i "s|^$1=.*|$1=$2|" "$APP_DIR/.env"; else echo "$1=$2" >> "$APP_DIR/.env"; fi
}
# Image name/tag of what is running now, so the restart doesn't change versions.
RUNNING=$(docker inspect --format '{{.Config.Image}}' "$(docker ps -q --filter label=com.docker.compose.service=frontend | head -1)" 2>/dev/null || true)
if [ -n "$RUNNING" ]; then
  HUB_USER=${RUNNING%%/*}; TAG=${RUNNING##*:}
  grep -q '^DOCKERHUB_USER=CHANGE-ME' "$APP_DIR/.env" && setenv DOCKERHUB_USER "$HUB_USER"
else
  HUB_USER=$(grep '^DOCKERHUB_USER=' "$APP_DIR/.env" | cut -d= -f2); TAG=latest
fi
setenv ACHILLES_WEB_BIND 127.0.0.1
setenv ACHILLES_WEB_PORT 3000
setenv ACHILLES_CORS_ORIGINS "https://$DOMAIN"
(cd "$APP_DIR" && DOCKERHUB_USER="$HUB_USER" ACHILLES_TAG="$TAG" docker compose up -d)
for i in $(seq 1 30); do curl -fsS -o /dev/null "http://$UPSTREAM/" && break; sleep 2; done
curl -fsS -o /dev/null "http://$UPSTREAM/" || { echo "  ! app not answering on $UPSTREAM"; exit 1; }
echo "  app answers on $UPSTREAM"

# ---------------------------------------------------------------- nginx stage 1: HTTP only
mkdir -p "$WEBROOT/.well-known/acme-challenge" /etc/nginx/snippets
[ -f "$HSTS_SNIPPET" ] || echo '# HSTS off until HTTPS is verified (setup-https.sh <domain> --enable-hsts)' > "$HSTS_SNIPPET"
rm -f /etc/nginx/sites-enabled/default
# Hide the nginx version in error pages/headers.
echo 'server_tokens off;' > /etc/nginx/conf.d/achilles-hardening.conf

install_site() {  # file -> validate and reload, or restore the previous site
  local new=$1
  [ -f "$SITE" ] && cp -a "$SITE" "$SITE.prev"
  cp "$new" "$SITE"; ln -sf "$SITE" /etc/nginx/sites-enabled/achilles
  if nginx -t; then
    systemctl enable nginx >/dev/null 2>&1
    if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl start nginx; fi
  else
    echo "  ! nginx -t failed; restoring previous site"
    if [ -f "$SITE.prev" ]; then mv "$SITE.prev" "$SITE"; else rm -f "$SITE" /etc/nginx/sites-enabled/achilles; fi
    exit 1
  fi
}

CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ ! -f "$CERT" ]; then
  say "nginx stage 1: HTTP only (ACME challenge + app), so the site stays up during issuance"
  STAGE1=$(mktemp)
  cat > "$STAGE1" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name $DOMAIN;
    location ^~ /.well-known/acme-challenge/ { root $WEBROOT; default_type text/plain; }
    location / {
        proxy_pass http://$UPSTREAM;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  install_site "$STAGE1"; rm -f "$STAGE1"

  say "Requesting a Let's Encrypt certificate for $DOMAIN (HTTP-01 webroot)"
  ARGS=(certonly --webroot -w "$WEBROOT" -d "$DOMAIN" --non-interactive --agree-tos --key-type ecdsa)
  if [ -n "$EMAIL" ]; then ARGS+=(--email "$EMAIL"); else ARGS+=(--register-unsafely-without-email); fi
  [ "$STAGING" -eq 1 ] && ARGS+=(--staging)
  certbot "${ARGS[@]}"
else
  say "Certificate for $DOMAIN already exists; reusing it"
fi

# ---------------------------------------------------------------- nginx stage 2: full TLS config
say "nginx stage 2: HTTPS on 443, HTTP -> HTTPS (301)"
FULL=$(mktemp)
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__UPSTREAM__|$UPSTREAM|g" "$TEMPLATE" > "$FULL"
install_site "$FULL"; rm -f "$FULL" "$SITE.prev"

# ---------------------------------------------------------------- renewal
say "Renewal: certbot.timer + reload nginx after each renewal"
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx <<'EOF'
#!/bin/sh
nginx -t && systemctl reload nginx
EOF
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
systemctl enable --now certbot.timer
systemctl list-timers certbot.timer --no-pager | head -3

say "Done. Verify:"
cat <<EOF
  curl -I http://$DOMAIN            # expect 301 -> https://$DOMAIN/
  curl -I https://$DOMAIN           # expect 200
  certbot renew --dry-run
Then turn on HSTS:  bash $HERE/setup-https.sh $DOMAIN --enable-hsts
Backup of the previous config: /root/achilles-backups/$TS.tgz
EOF
