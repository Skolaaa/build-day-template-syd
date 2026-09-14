---
name: rename-project
description: Rename this monorepo and everything that carries its name - workspace name, bun.lock, the Cloudflare Worker in wrangler.jsonc, .cta.json, README headings, and the browser tab title. Use when the user says "rename this project to X", "call this project X", or is turning the boilerplate into a real named app.
allowed-tools: Bash(bun .claude/skills/rename-project/rename.ts:*), Bash(git:*), Read, Edit
---

# Rename the project

Run the script with the new name. It derives the current name from the root
`package.json`, so nothing else needs to be passed in.

```bash
bun .claude/skills/rename-project/rename.ts <new-name>
```

The name must be a valid Cloudflare Worker name: lowercase letters, digits and
hyphens. The script also derives a display name from it (`my-app` -> `My App`)
for the README headings and the tab title.

## What it touches

| Target | Field |
| --- | --- |
| `package.json` | `name` |
| `bun.lock` | root workspace `name` (first match only, so a like-named dependency is safe) |
| `apps/*/wrangler.jsonc` | `name` (the deployed Worker) |
| `apps/*/.cta.json` | `projectName` |
| `README.md`, `apps/*/README.md` | first `# ` heading |
| `apps/*/src/routes/__root.tsx` | `title` in the document head |
| `apps/*/.env.example`, `apps/*/.env.local`, `packages/mongo/README.md` | the database name in `mongodb://host/<name>` URIs (`.env.local` is gitignored, so that one is a local convenience; an Atlas URI with its own database name is left alone) |

`apps/web/package.json` stays `"name": "web"` on purpose. That is the workspace
path identity `turbo --filter=web` resolves, not the project name. Likewise
`packages/mongo` stays `@repo/mongo`: the `@repo` scope is deliberately not the
project name.

Renaming the database does not move data. A local `.mongo-data` from before the
rename still holds the old database; the app simply starts using an empty one
under the new name. Delete `.mongo-data` if you want a clean slate.

## After it runs

Read the output. Two parts need your judgement.

- **`unchanged` lines.** A target that did not move. Either the regex missed it
  or it already said the right thing. Usually fine, but open it if unsure.
- **The "still mentions the old name" list.** The script deliberately leaves
  prose alone, because a word like `boilerplate` shows up in sentences
  ("without creating API boilerplate") where rewriting it produces nonsense.
  Decide per line, and edit the ones that are genuinely the project name.

The script finishes with `bun install --frozen-lockfile` to prove the lockfile
still matches `package.json`. If that fails, the lockfile name did not get
rewritten.

Renaming the Worker means the next `bun run deploy` creates a **new** Worker
rather than updating the old one. If the old name was ever deployed, tell the
user to delete that Worker and re-point any custom domain. Do not do it for
them.

Then commit, naming both the old and new name in the subject.
