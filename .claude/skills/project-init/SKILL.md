---
name: project-init
description: Turn this boilerplate into a named project - asks for the name, renames, keeps or strips Clerk auth, and puts the name in the README.
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

- **Keep Clerk**: go to step 4.
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

## 5. Hand back

Report the name, whether Clerk was kept, and the uncommitted diff from steps 3
and 4. Commit only if the user asks. Pass on any
outward-facing follow-ups `rename-project` or `remove-clerk` raised (an old
deployed Worker, Clerk secrets, the Clerk dashboard app); leave those to the user.
