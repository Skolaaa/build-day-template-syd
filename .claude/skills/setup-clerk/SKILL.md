---
name: setup-clerk
description: Connect apps/web to a Clerk application - create or pick the app, link it, pull dev keys into .env.local, optionally enable the one-click dev login. Use when the user keeps Clerk in project-init or asks to connect the app to Clerk.
allowed-tools: AskUserQuestion, Bash(clerk:*), Bash(bun:*), Bash(cp:*), Bash(git:*)
---

# Set up Clerk

Connects `apps/web` to a Clerk application: dev-instance keys in `.env.local`
and, if wanted, the one-click dev login. Nothing here touches a tracked file,
so there is no commit at the end.

Two rules for the whole run:

- Run every `clerk` command from the repo root and pass `--app <id>` wherever
  the command accepts it. clerk 2.x resolves the linked app from the git
  directory, and from a subdirectory it resolves the wrong one.
- `.env.local` holds the secret key. Change it only through `clerk env pull`
  and `env.ts`; reading it would put the secret in the transcript.

## 1. CLI and login

`clerk whoami --json`. Command missing: `bun add -g clerk`. Not logged in: the
login is a browser OAuth flow with no headless form, so ask the user to run
`! clerk auth login` and wait for them.

Done when `whoami` prints an email.

## 2. Pick the application

`clerk apps list --json` gives `application_id` and `name` per app. Ask with
`AskUserQuestion`: "Which Clerk application?" First option: create one named
after the README's display name (`My App`). Then the existing apps by name.

Create: `clerk apps create "<Display Name>" --json` and read the app id from
its output; if the shape is unclear, `clerk apps list --json` and find it by
name.

Done when you hold one app id.

## 3. Link and pull keys

```bash
clerk link --app <id>
cp -n apps/web/.env.example apps/web/.env.local
clerk env pull --app <id> --file apps/web/.env.local
bun .claude/skills/setup-clerk/env.ts sync
```

`clerk env pull` merges into the file. It writes two of the three names the app
reads (which two depends on its framework detection); `sync` fills the third and
prints each name with its prefix.

Done when all three print, `pk_test_…` for the publishable keys and `sk_test_…`
for the secret.

## 4. Dev login

Ask with `AskUserQuestion`: "Enable the one-click dev login? (`/login` signs in
a dedicated dev user without Clerk's UI, local builds only.)" Options: yes as
`dev@<project-name>.test`, yes with another address (the user types it), no.

No: go to step 5. Yes:

```bash
bun .claude/skills/setup-clerk/env.ts dev-login <email>
bun run --cwd apps/web create-dev-user
```

`create-dev-user` calls Clerk's Backend API with the secret key, so it doubles
as the proof that the keys work. If Clerk rejects the address, ask the user for
another and rerun both commands.

Done when it prints `Created dev user` or `Updated password`.

## 5. Hand back

Report the app name and id, and whether the dev login is on. Leave to the user:

- The dev instance also serves the deployed Worker. A production instance is a
  separate `clerk deploy` wizard and needs a custom domain.
