# Deploy (Hostinger VPS, Docker)

Server: repo at `/opt/agent-kitchen`, secrets in `/opt/agent-kitchen/.env` (never committed).

- First deploy: `sudo -u deploy bash -c "cd /opt/agent-kitchen && git pull && docker compose up -d --build"`
- Later deploys: `gh workflow run deploy.yml` (secrets: DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS, DEPLOY_USER, DEPLOY_HOST)
- Logs: `docker compose logs -f gateway`
- LLM check: `docker compose logs gateway | grep -i template` (template fallback = LLM not reached)
- Rollback: `git checkout <commit> && docker compose up -d --build`
- URLs: bytemegaming.tech (live gateway + game), play.bytemegaming.tech (static replay build, works even if gateway is down)
- Rule: no deploys in the hour before the pitch.
