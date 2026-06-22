#!/usr/bin/env bash
# One-time server setup. Idempotent where practical. Run as root on Ubuntu/Debian.
#
# What it does:
#   1. Creates the 'nail' user (no password, no home directory login).
#   2. Installs Node 22 LTS via nvm for that user.
#   3. Installs Caddy with the Porkbun DNS plugin (built with xcaddy).
#   4. Installs fail2ban and configures SSH jail.
#   5. Configures UFW (allow 2222 SSH, 80, 443; deny everything else).
#   6. Enables unattended-upgrades.
#   7. Sets up PM2 to run the app under the 'nail' user.
#
# It does NOT:
#   - Configure Caddy (run scripts/install-caddy-config.sh after editing Caddyfile).
#   - Move DNS or set up Porkbun API keys (do those manually).
#   - Configure port forwarding on the router (do that in the router UI).
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (sudo $0)" >&2
  exit 1
fi

NAIL_USER="${NAIL_USER:-nail}"
APP_DIR="${APP_DIR:-/home/$NAIL_USER/app}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> Creating user $NAIL_USER"
if ! id "$NAIL_USER" >/dev/null 2>&1; then
  adduser "$NAIL_USER" --disabled-password --gecos ""
fi

echo "==> Installing OS packages"
apt update
apt install -y curl git rsync ca-certificates gnupg lsb-release ufw fail2ban \
  unattended-upgrades apt-transport-deb

echo "==> Configuring UFW"
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
yes | ufw enable
ufw status

echo "==> Hardening SSH (port 2222, key-only, no root)"
SSHD=/etc/ssh/sshd_config
cp -n "$SSHD" "$SSHD.bak"
sed -i 's/^#\?Port .*/Port 2222/' "$SSHD"
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' "$SSHD"
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' "$SSHD"
systemctl restart ssh || systemctl restart sshd || true

echo "==> fail2ban"
cat >/etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 15m
maxretry = 3
banaction = ufw

[sshd]
enabled  = true
port     = 2222
filter   = sshd
logpath  = /var/log/auth.log
EOF
systemctl enable --now fail2ban

echo "==> unattended-upgrades"
dpkg-reconfigure -plow unattended-upgrades

echo "==> Node.js $NODE_MAJOR LTS via nvm (for $NAIL_USER)"
sudo -iu "$NAIL_USER" bash -lc "
  set -e
  if [[ ! -d \$HOME/.nvm ]]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  . \$HOME/.nvm/nvm.sh
  nvm install --lts
  nvm use --lts
  nvm alias default 'lts/*'
"

echo "==> Cloning app repo"
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -iu "$NAIL_USER" bash -lc "git clone https://github.com/Kainny2000/nail-website.git $APP_DIR"
fi

echo "==> PM2"
sudo -iu "$NAIL_USER" bash -lc "
  set -e
  . \$HOME/.nvm/nvm.sh
  npm i -g pm2
"

echo
echo "==================================================================="
echo "  OS-level setup complete. Next steps (manual):"
echo "==================================================================="
echo "1. Port-forward 80, 443, 2222 on your router to this machine."
echo "2. Configure Porkbun nameservers at Squarespace for $DOMAIN"
echo "3. Add Porkbun API keys: sudo -iu $NAIL_USER"
echo "     mkdir -p ~/.porkbun && chmod 700 ~/.porkbun"
echo "     echo 'pk1_xxx' > ~/.porkbun/api_key && chmod 600 ~/.porkbun/api_key"
echo "     echo 'sk1_xxx' > ~/.porkbun/secret_key && chmod 600 ~/.porkbun/secret_key"
echo "4. Install Caddy + the Porkbun DNS plugin: bash deploy/install-caddy.sh"
echo "5. Drop your Caddyfile at /etc/caddy/Caddyfile and the Porkbun API env"
echo "   at /etc/caddy/caddy.env (chmod 600), then: sudo systemctl restart caddy"
echo "6. Copy .env.example to $APP_DIR/.env, fill in SESSION_SECRET and"
echo "   ADMIN_PASSWORD_HASH, then: sudo -iu $NAIL_USER bash -lc 'cd $APP_DIR && npm ci && npm run build && pm2 start ./dist/server/entry.mjs --name nail && pm2 startup systemd && pm2 save'"
echo "7. Install crons: bash deploy/install-crons.sh"
echo "8. Install the self-hosted GitHub Actions runner: bash deploy/install-runner.sh"
echo "9. Open https://$DOMAIN/admin and complete TOTP enrollment."
echo "==================================================================="
