---
name: setup-cloudflare
description: Connect apps/web to a Cloudflare account and do the first deploy - wrangler login check, account into .env.local, Worker secrets from .env.local, deploy, health check. Use when project-init reaches Cloudflare or the user asks for a first deploy.
allowed-tools: AskUserQuestion, Bash(bun:*), Bash(cp:*), Bash(curl:*), Bash(rm:*), Bash(git:*)
---

# Set up Cloudflare

Puts the Worker named in `apps/web/wrangler.jsonc` on the user's Cloudflare
account. Nothing here touches a tracked file, so there is no commit at the end.

Run wrangler from the repo root as `bun x wrangler --cwd apps/web …`, so it
finds `wrangler.jsonc` and reads `apps/web/.env.local`. Change `.env.local` only
through `env.ts`; reading it would put secrets in the transcript.

## 1. Login

`bun x wrangler --cwd apps/web whoami`. Not logged in: the login is a browser
OAuth flow, so ask the user to run `! bun x wrangler login` and wait for them. If they would rather not right now, stop and say so in the
hand-back.

Done when `whoami` lists at least one account.

## 2. Account

One account listed: nothing to do. Several: ask with `AskUserQuestion` which
one, then

```bash
cp -n apps/web/.env.example apps/web/.env.local
bun .claude/skills/setup-cloudflare/env.ts account <account-id>
```

Wrangler reads `CLOUDFLARE_ACCOUNT_ID` from `.env.local` next to its config.

Done when `bun x wrangler --cwd apps/web secret list` either lists secrets or
says the Worker is not found. Both mean the account resolved; an account picker
error means it did not.

## 3. Ask before deploying

The deploy creates a public `workers.dev` URL. Ask with `AskUserQuestion`:
"Deploy to Cloudflare now?" No: go to step 5.

## 4. Deploy

```bash
bun run --cwd apps/web build
bun .claude/skills/setup-cloudflare/env.ts secrets-file
bun x wrangler --cwd apps/web deploy --secrets-file <path it printed>
rm <path it printed>
```

`secrets-file` selects the keys the deployed Worker reads and prints the path
plus the key names; if it prints "Nothing to upload", deploy without the flag.
The secrets ride along with the deploy because `wrangler secret put` needs a
Worker that already exists. Run the `rm` whether or not the deploy succeeded;
the file holds secrets.

Verify: `curl -s <deployed URL>/api/health` returns `{"status":"ok"…}`. A new
`workers.dev` name can take a minute to resolve; retry a few times before
calling it a failure.

Done when the health check passes and `bun x wrangler --cwd apps/web secret
list` shows the uploaded names.

## 5. Hand back

Report the account, the Worker name and the URL (or that the deploy was
skipped). Leave to the user:

- `MONGODB_URI` is not set on the Worker, so `/notes` shows its "could not reach
  MongoDB" panel. README "Deploy" steps 2 and 3 cover the Atlas string;
  `! cd apps/web && bun x wrangler secret put MONGODB_URI` sets it.
