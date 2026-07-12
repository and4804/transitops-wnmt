# Deployment

CI/CD is handled by [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):
on every push to `main`, GitHub Actions builds the app (if `package.json`
exists), rsyncs the repo to the EC2 instance, and restarts the
`transitops` systemd service.

## One-time EC2 setup

1. Launch a Debian EC2 instance and note its public IP/DNS. Open port 22
   (SSH) and whatever port your app will serve on (e.g. 3000/443) in its
   security group.
2. Generate a dedicated deploy key pair (don't reuse your personal key):
   ```
   ssh-keygen -t ed25519 -f transitops_deploy_key -C "transitops-ci"
   ```
3. Add the public key to the instance's `admin` user:
   ```
   ssh-copy-id -i transitops_deploy_key.pub admin@<EC2_HOST>
   ```
4. Copy the bootstrap files and run the setup script on the instance:
   ```
   scp deploy/setup-ec2.sh deploy/transitops.service admin@<EC2_HOST>:~
   ssh admin@<EC2_HOST> 'chmod +x setup-ec2.sh && ./setup-ec2.sh'
   ```
   This installs Node.js, creates `~/transitops`, and registers a
   user-level systemd service (`systemctl --user`) so CI can restart the
   app without needing sudo.
5. In the GitHub repo, go to **Settings > Secrets and variables >
   Actions** and add:
   - `EC2_HOST` — the instance's public IP or DNS name
   - `EC2_SSH_KEY` — contents of the *private* key file
     (`transitops_deploy_key`) generated in step 2

## After that

Every push to `main` will:
1. Install deps / build / test (skipped if no `package.json` yet)
2. rsync the repo to `/home/admin/transitops` on the instance
3. Run `npm ci --omit=dev` on the instance (if `package.json` exists)
4. `systemctl --user restart transitops`

Until real app code with a `package.json` + `npm start` exists, step 4
will keep failing to start — that's expected. Once the app is added,
deploys should just work.

## Manual redeploy / rollback

Trigger the workflow manually from the Actions tab ("Run workflow") to
redeploy the current `main` without a new push. To roll back, revert the
offending commit on `main` and push — the workflow will redeploy the
reverted state.
