#!/usr/bin/env bash
# One-time bootstrap for the EC2 instance. Run this once, manually, as the
# 'admin' user (the account GitHub Actions will SSH in as):
#
#   scp deploy/setup-ec2.sh deploy/transitops.service admin@<EC2_HOST>:~
#   ssh admin@<EC2_HOST> 'chmod +x setup-ec2.sh && ./setup-ec2.sh'
#
# It installs Node.js, creates the deploy directory, installs a user-level
# systemd service (so CI can restart the app without sudo), and enables
# lingering so the service keeps running after the SSH session ends / on
# reboot.
set -euo pipefail

DEPLOY_PATH="$HOME/transitops"
SERVICE_NAME="transitops"

echo "==> Installing Node.js 20 (NodeSource)"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "==> Installing rsync (used by the deploy workflow)"
sudo apt-get install -y rsync

echo "==> Creating deploy directory: $DEPLOY_PATH"
mkdir -p "$DEPLOY_PATH"

echo "==> Installing user-level systemd service"
mkdir -p "$HOME/.config/systemd/user"
cp "$(dirname "$0")/transitops.service" "$HOME/.config/systemd/user/${SERVICE_NAME}.service"

systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"

echo "==> Enabling lingering so the service survives logout/reboot"
sudo loginctl enable-linger "$(whoami)"

echo ""
echo "Bootstrap complete."
echo "The '${SERVICE_NAME}' service is enabled but has no app code yet,"
echo "so it will fail to start until the first deploy pushes a package.json"
echo "with a working 'npm start'. That's expected for now."
echo ""
echo "Next: add these secrets in GitHub (Settings > Secrets and variables > Actions):"
echo "  EC2_HOST     = this instance's public IP or DNS name"
echo "  EC2_SSH_KEY  = the private key matching a public key in ~/.ssh/authorized_keys for this user"
