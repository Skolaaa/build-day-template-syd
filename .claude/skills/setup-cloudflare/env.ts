#!/usr/bin/env bun
/**
 * Edits apps/web/.env.local for the setup-cloudflare skill without printing a
 * secret. Commands:
 *
 *   account <id>   set CLOUDFLARE_ACCOUNT_ID (wrangler reads it from there)
 *   secrets-file   write the keys the deployed Worker needs to a temp file for
 *                  `wrangler deploy --secrets-file`, and print its path
 */
import { tmpdir } from "node:os";
import { $, file, write } from "bun";

// Everything else in .env.local is local-only: DEV_LOGIN_* must never reach a
// deployed Worker, MONGODB_URI points at the local mongod, and
// CLOUDFLARE_ACCOUNT_ID is for wrangler itself.
const DEPLOYED_KEYS = [
  "CLERK_SECRET_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "VITE_CLERK_PUBLISHABLE_KEY",
] as const;

const root = (await $`git rev-parse --show-toplevel`.text()).trim();
const envPath = `${root}/apps/web/.env.local`;
const envFile = file(envPath);
if (!(await envFile.exists())) {
  console.error(`${envPath} does not exist. Copy apps/web/.env.example first.`);
  process.exit(1);
}
let text = await envFile.text();

const get = (key: string): string =>
  text.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1].trim() ?? "";

const set = (key: string, value: string) => {
  const line = `${key}=${value}`;
  const existing = new RegExp(`^${key}=.*$`, "m");
  text = existing.test(text)
    ? text.replace(existing, line)
    : `${text.trimEnd()}\n${line}\n`;
};

const usage = () => {
  console.error(
    "usage: bun .claude/skills/setup-cloudflare/env.ts account <id> | secrets-file"
  );
  process.exit(1);
};

const [, , command, accountId] = process.argv;

if (command === "account" && accountId) {
  set("CLOUDFLARE_ACCOUNT_ID", accountId);
  await write(envPath, text);
  console.log(`CLOUDFLARE_ACCOUNT_ID=${accountId}`);
} else if (command === "secrets-file") {
  const present = DEPLOYED_KEYS.filter((key) => get(key) !== "");
  if (present.length === 0) {
    console.log("Nothing to upload: deploy without --secrets-file.");
    process.exit(0);
  }
  const path = `${tmpdir()}/worker-secrets-${crypto.randomUUID()}.env`;
  await write(
    path,
    `${present.map((key) => `${key}=${get(key)}`).join("\n")}\n`
  );
  console.log(`${path}\n${present.join("\n")}`);
} else {
  usage();
}
