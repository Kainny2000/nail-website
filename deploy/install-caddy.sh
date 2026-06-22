#!/usr/bin/env bash
# Build Caddy with the Porkbun DNS module (github.com/caddy-dns/porkbun).
# Required for Let's Encrypt DNS-01 challenges so certs issue/renew even
# when the box has just changed its public IP.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

# Install Go (needed for xcaddy).
if ! command -v go >/dev/null 2>&1; then
  apt install -y golang-go
fi

# Install xcaddy.
if ! command -v xcaddy >/dev/null 2>&1; then
  go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
  export PATH="$PATH:/root/go/bin"
fi

# Build Caddy with the Porkbun DNS module.
mkdir -p /opt/caddy-build
cd /opt/caddy-build
xcaddy build --with github.com/caddy-dns/porkbun

# Stop the distro caddy if present.
systemctl stop caddy 2>/dev/null || true
systemctl disable caddy 2>/dev/null || true

# Install the new binary.
install -m 755 caddy /usr/local/bin/caddy
ln -sf /usr/local/bin/caddy /usr/bin/caddy

# Restore the systemd unit (the distro one was disabled above).
if [[ ! -f /etc/systemd/system/caddy.service ]]; then
  curl -fsSL https://raw.githubusercontent.com/caddyserver/caddy/v2.7.6/dist/init/linux-systemd/caddy.service \
    -o /etc/systemd/system/caddy.service
  sed -i 's|/usr/bin/caddy|/usr/local/bin/caddy|' /etc/systemd/system/caddy.service
  systemctl daemon-reload
fi

systemctl enable caddy
echo "Caddy built with Porkbun module:"
/usr/local/bin/caddy version
