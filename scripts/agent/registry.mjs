#!/usr/bin/env node
/**
 * registry — the work-in-progress registry for concurrent agents.
 *
 * Two agents editing the same area produce conflicting, hard-to-review changes. Before touching
 * files, an agent claims the paths it intends to edit. A claim is advisory (nothing enforces it at
 * the filesystem level) but it is checked, visible, and expiring, which is enough to keep parallel
 * work from colliding.
 *
 * Usage:
 *   node scripts/agent/registry.mjs status [--json]
 *   node scripts/agent/registry.mjs claim --agent <id> --task "<summary>" --scope <path> [...]
 *   node scripts/agent/registry.mjs check --scope <path> [--agent <id>]
 *   node scripts/agent/registry.mjs release --id <claim-id> | --agent <id>
 *   node scripts/agent/registry.mjs prune
 *
 * Options:
 *   --hours <n>   Claim lifetime in hours (default 4, maximum 24).
 *   --branch <b>  Git branch the claim belongs to.
 *   --force       Claim anyway, recording the overlap instead of refusing.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { readJsonFile, repositoryRoot, serializeJson } from "./lib/workspace.mjs";

const REGISTRY_VERSION = 1;
const DEFAULT_LIFETIME_HOURS = 4;
const MAXIMUM_LIFETIME_HOURS = 24;

const agentDirectory = join(repositoryRoot, ".agent");
const registryPath = join(agentDirectory, "registry.json");

const [command = "status", ...rest] = process.argv.slice(2);
const options = parseOptions(rest);

const handlers = {
  status: showStatus,
  claim: createClaim,
  check: checkScopes,
  release: releaseClaims,
  prune: pruneExpired,
};

const handler = handlers[command];

if (!handler) {
  console.error(
    `Unknown command "${command}". Expected one of: ${Object.keys(handlers).join(", ")}.`,
  );
  process.exitCode = 1;
} else {
  await handler();
}

async function readRegistry() {
  const registry = (await readJsonFile(registryPath)) ?? {
    version: REGISTRY_VERSION,
    note: "Advisory work claims held by agents. Managed by `pnpm agent:*` commands.",
    claims: [],
  };

  registry.claims ??= [];
  return registry;
}

async function writeRegistry(registry) {
  registry.claims.sort((left, right) => left.claimedAt.localeCompare(right.claimedAt));
  await mkdir(agentDirectory, { recursive: true });
  await writeFile(registryPath, serializeJson(registry), "utf8");
}

function isExpired(claim, now = new Date()) {
  return new Date(claim.expiresAt).getTime() <= now.getTime();
}

function activeClaims(registry, now = new Date()) {
  return registry.claims.filter((claim) => !isExpired(claim, now));
}

async function showStatus() {
  const registry = await readRegistry();
  const now = new Date();
  const active = activeClaims(registry, now);
  const expired = registry.claims.filter((claim) => isExpired(claim, now));

  if (options.json) {
    process.stdout.write(serializeJson({ active, expired }));
    return;
  }

  if (active.length === 0) {
    process.stdout.write("No active claims. The tree is free.\n");
  } else {
    process.stdout.write(`Active claims (${active.length}):\n`);
    for (const claim of active) {
      process.stdout.write(
        `  ${claim.id}  ${claim.agent}  expires ${claim.expiresAt}\n` +
          `    task:   ${claim.task}\n` +
          `    branch: ${claim.branch ?? "—"}\n` +
          `    scopes: ${claim.scopes.join(", ")}\n`,
      );
    }
  }

  if (expired.length > 0) {
    process.stdout.write(
      `\n${expired.length} expired claim(s) still recorded. Run \`pnpm agent:prune\` to clear them.\n`,
    );
  }
}

async function createClaim() {
  const agent = requireOption("agent");
  const task = requireOption("task");
  const scopes = normalizeScopes(options.scope);

  if (process.exitCode === 1) {
    return;
  }

  if (scopes.length === 0) {
    console.error("At least one --scope is required.");
    process.exitCode = 1;
    return;
  }

  const missing = scopes.filter((scope) => !existsSync(join(repositoryRoot, scopeRoot(scope))));
  if (missing.length > 0) {
    console.error(`These scopes do not exist in the repository: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const registry = await readRegistry();
  const conflicts = findConflicts(activeClaims(registry), scopes, agent);

  if (conflicts.length > 0 && !options.force) {
    console.error("Claim refused — these scopes overlap active claims:");
    for (const conflict of conflicts) {
      console.error(
        `  ${conflict.claim.agent} holds "${conflict.claim.scope}" until ${conflict.claim.expiresAt}` +
          ` (overlaps "${conflict.requested}")`,
      );
    }
    console.error(
      "Coordinate with the holder, pick a different scope, wait for expiry, or re-run with --force.",
    );
    process.exitCode = 1;
    return;
  }

  const hours = clampHours(options.hours);
  const claimedAt = new Date();
  const claim = {
    id: `clm_${randomUUID().slice(0, 8)}`,
    agent,
    task,
    scopes,
    branch: options.branch ?? null,
    claimedAt: claimedAt.toISOString(),
    expiresAt: new Date(claimedAt.getTime() + hours * 60 * 60 * 1000).toISOString(),
    forcedOverlap:
      conflicts.length > 0 ? conflicts.map((conflict) => conflict.claim.id) : undefined,
  };

  registry.claims.push(claim);
  await writeRegistry(registry);

  process.stdout.write(
    `Claimed ${claim.id} for ${agent} until ${claim.expiresAt}\n  scopes: ${scopes.join(", ")}\n`,
  );
  if (conflicts.length > 0) {
    process.stdout.write("  warning: forced over an existing claim. Record why in the journal.\n");
  }
}

async function checkScopes() {
  const scopes = normalizeScopes(options.scope);

  if (scopes.length === 0) {
    console.error("At least one --scope is required.");
    process.exitCode = 1;
    return;
  }

  const registry = await readRegistry();
  const conflicts = findConflicts(activeClaims(registry), scopes, options.agent);

  if (conflicts.length === 0) {
    process.stdout.write(`Clear: ${scopes.join(", ")}\n`);
    return;
  }

  console.error("Conflicting active claims:");
  for (const conflict of conflicts) {
    console.error(
      `  ${conflict.claim.agent} holds "${conflict.claim.scope}" (${conflict.claim.id}) until ` +
        `${conflict.claim.expiresAt}`,
    );
  }
  process.exitCode = 1;
}

async function releaseClaims() {
  const registry = await readRegistry();
  const before = registry.claims.length;

  if (options.id) {
    registry.claims = registry.claims.filter((claim) => claim.id !== options.id);
  } else if (options.agent) {
    registry.claims = registry.claims.filter((claim) => claim.agent !== options.agent);
  } else {
    console.error("Provide --id <claim-id> or --agent <id>.");
    process.exitCode = 1;
    return;
  }

  const removed = before - registry.claims.length;

  if (removed === 0) {
    console.error("No matching claim found.");
    process.exitCode = 1;
    return;
  }

  await writeRegistry(registry);
  process.stdout.write(`Released ${removed} claim(s).\n`);
}

async function pruneExpired() {
  const registry = await readRegistry();
  const now = new Date();
  const before = registry.claims.length;

  registry.claims = registry.claims.filter((claim) => !isExpired(claim, now));
  await writeRegistry(registry);

  process.stdout.write(`Pruned ${before - registry.claims.length} expired claim(s).\n`);
}

/**
 * Two scopes conflict when one is a path prefix of the other. `apps/api/src` conflicts with
 * `apps/api/src/documents`, but not with `apps/api/src/documents-archive`.
 */
function findConflicts(claims, requestedScopes, agent) {
  const conflicts = [];

  for (const claim of claims) {
    if (agent && claim.agent === agent) {
      continue;
    }

    for (const held of claim.scopes) {
      for (const requested of requestedScopes) {
        if (pathsOverlap(held, requested)) {
          conflicts.push({ claim: { ...claim, scope: held }, requested });
        }
      }
    }
  }

  return conflicts;
}

function pathsOverlap(left, right) {
  const a = scopeRoot(left);
  const b = scopeRoot(right);

  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

/** Strip a trailing glob so `apps/api/**` and `apps/api` compare as the same subtree. */
function scopeRoot(scope) {
  return scope
    .replace(/\/\*\*$/, "")
    .replace(/\/\*$/, "")
    .replace(/\/+$/, "");
}

function normalizeScopes(raw) {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return [
    ...new Set(
      values
        .flatMap((value) => value.split(","))
        .map((value) => value.trim().replace(/^\.\//, "").replace(/^\/+/, ""))
        .filter((value) => value.length > 0),
    ),
  ].sort();
}

function clampHours(value) {
  const hours = Number.parseFloat(value ?? DEFAULT_LIFETIME_HOURS);

  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_LIFETIME_HOURS;
  }

  return Math.min(hours, MAXIMUM_LIFETIME_HOURS);
}

function requireOption(name) {
  const value = options[name];

  if (typeof value !== "string" || value.trim().length === 0) {
    console.error(`--${name} is required.`);
    process.exitCode = 1;
    return "";
  }

  return value.trim();
}

function parseOptions(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (next === undefined || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    if (key === "scope") {
      parsed.scope = [...(Array.isArray(parsed.scope) ? parsed.scope : []), next];
    } else {
      parsed[key] = next;
    }

    index += 1;
  }

  return parsed;
}
