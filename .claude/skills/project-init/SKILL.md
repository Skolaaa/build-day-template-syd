---
name: project-init
description: Turn this boilerplate into a named project - asks for the name, renames, keeps (and connects) or strips Clerk auth, puts the name in the README, and connects Cloudflare for a first deploy.
disable-model-invocation: true
allowed-tools: AskUserQuestion, Skill, Bash(git:*), Bash(bun:*), Read, Edit, Write
---

# Initialise the project

Runs once, right after cloning the boilerplate.

Start from a clean `git status`. If the tree is dirty, stop and ask the user to
commit or stash first.

## 1. Ask for the name

Use `AskUserQuestion`: "What should this project be called?" Offer the repo
directory's basename as the first option; the user can type another via "Other".

The name must be a valid Cloudflare Worker name: lowercase letters, digits and
hyphens. If the answer is not (`My App`, `my_app`), convert it to kebab-case
(`my-app`) and confirm the converted name with the user before going on.

Done when you hold one confirmed kebab-case name.

## 2. Rename

Invoke the `rename-project` skill with the name and follow it through, including
its commit. Its "still mentions the old name" list includes hits inside
`.claude/skills/`; leave those as they are.

Done when `git status` is clean and the commit names both the old and new name.
`remove-clerk` needs that clean tree to start.

## 3. Ask about auth

Use `AskUserQuestion`: "Keep Clerk authentication?"

- **Keep Clerk**: invoke the `setup-clerk` skill and follow it through. It
  picks or creates the Clerk application and puts its keys in
  `apps/web/.env.local`.
- **Remove Clerk**: invoke the `remove-clerk` skill and follow it through,
  including its verification.

Done when the chosen branch is complete.

## 4. Put the name in the README

`rename-project` already set the `# ` heading of `README.md` to the display name
(`my-app` -> `My App`). Make the intro sentence under it name the project too:

```markdown
# My App

`my-app` is a [Turborepo](https://turborepo.com) monorepo, managed with Bun workspaces.
```

Read the whole `README.md` afterwards. Done when it names the project and no
line still calls it the boilerplate.

## 5. Cloudflare

Invoke the `setup-cloudflare` skill and follow it through. It signs the user
in, records the account, and asks before it deploys. This comes last so the
deploy ships the renamed, Clerk-decided app.

Done when the skill has handed back, whether or not the user chose to deploy.

## 6. Hand back

Report the name, whether Clerk was kept (and which Clerk app), the Worker URL
or that the deploy was skipped, and the uncommitted diff from steps 3 and 4.
Commit only if the user asks. Pass on the follow-ups the invoked skills raised
(an old deployed Worker, `MONGODB_URI` on the Worker, a Clerk production
instance, Clerk secrets or the dashboard app after a removal); leave those to
the user.
