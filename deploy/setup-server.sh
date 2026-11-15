#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu server (e.g. Vultr) for Achilles. Run as root:
#   scp deploy/setup-server.sh root@SERVER:/root/ && ssh root@SERVER 'bash /root/setup-server.sh "ssh-ed25519 AAAA... github-deploy"'
# The argument is the PUBLIC half of the key GitHub Actions deploys with (VULTR_SSH_KEY holds the private half).
set -euo pipefail

DEPLOY_PUBKEY="${1:?usage: setup-server.sh \"<deploy public key>\"}"
DEPLOY_USER=deploy
APP_DIR=/opt/achilles

echo "[1/5] Installing Docker and Compose from Ubuntu's repositories ..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y docker.io docker-compose-v2 ufw
systemctl enable --now docker

echo "[2/5] Creating the '$DEPLOY_USER' user (docker group, key-only login) ..."
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTH="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTH"
grep -qxF "$DEPLOY_PUBKEY" "$AUTH" || echo "$DEPLOY_PUBKEY" >> "$AUTH"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"; chmod 600 "$AUTH"

echo "[3/5] Preparing $APP_DIR ..."
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
if [ ! -f "$APP_DIR/.env" ]; then
  KEY=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)
  cat > "$APP_DIR/.env" <<EOF
DOCKERHUB_USER=CHANGE-ME
ACHILLES_TAG=latest
ACHILLES_WEB_BIND=127.0.0.1
ACHILLES_WEB_PORT=3000
ACHILLES_API_KEY=$KEY
ACHILLES_MONGODB_URI=
ACHILLES_MONGODB_DB=achilles
ACHILLES_LAB_TARGETS=
ACHILLES_FAKE_TOOLS=0
ACHILLES_MAX_CONCURRENT_SCANS=1
ACHILLES_CORS_ORIGINS=*
ACHILLES_AI_ORDER=grok,gemini,claude
ACHILLES_XAI_API_KEY=
ACHILLES_GEMINI_API_KEY=
ACHILLES_ANTHROPIC_API_KEY=
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env"; chmod 600 "$APP_DIR/.env"
fi

echo "[4/5] Firewall: allow SSH, HTTP, HTTPS only ..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[5/5] SSH: disable password logins (keys only) ..."
if [ ! -s /root/.ssh/authorized_keys ]; then
  echo "  ! root has no SSH key yet, so password login stays ON (otherwise you'd be locked out)."
  echo "    Add your key to /root/.ssh/authorized_keys and rerun this script."
  exit 0
fi
mkdir -p /etc/ssh/sshd_config.d
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/10-achilles.conf
systemctl reload ssh || systemctl reload sshd

echo
echo "Done. Next: edit $APP_DIR/.env (set DOCKERHUB_USER, and the Mongo/AI keys if you use them)."
echo "Then push to main; GitHub Actions deploys automatically."
echo "The site listens on 127.0.0.1:3000 only. Make it public over HTTPS with:"
echo "  bash deploy/setup-https.sh <your-domain>"
