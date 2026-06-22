#!/usr/bin/env bash
# Install the GitHub Actions self-hosted runner for this repo.
# Run as the 'nail' user, after creating a runner token at
#   https://github.com/Kainny2000/nail-website/settings/actions/runners/new
set -euo pipefail

NAIL_USER="${NAIL_USER:-nail}"
RUNNER_DIR="${RUNNER_DIR:-/home/$NAIL_USER/actions-runner}"
RUNNER_VERSION="${RUNNER_VERSION:-2.319.1}"
RUNNER_TOKEN="${1:-}"

if [[ -z "$RUNNER_TOKEN" ]]; then
  echo "Usage: $0 <RUNNER_TOKEN>" >&2
  echo "Get a token from https://github.com/Kainny2000/nail-website/settings/actions/runners/new" >&2
  exit 1
fi

sudo -iu "$NAIL_USER" bash -lc "
  set -e
  mkdir -p '$RUNNER_DIR' && cd '$RUNNER_DIR'
  if [[ ! -f ./run.sh ]]; then
    curl -fsSL -o runner.tar.gz \\
      https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
    tar xzf runner.tar.gz
  fi
  ./config.sh \\
    --url 'https://github.com/Kainny2000/nail-website' \\
    --token '$RUNNER_TOKEN' \\
    --name \"nail-$(hostname)\" \\
    --labels 'self-hosted,linux,x64,home' \\
    --unattended \\
    --replace
  ./svc.sh install
  sudo ./svc.sh start
  echo 'Runner status:'
  ./svc.sh status
"
