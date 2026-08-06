# Fix brace-expansion override conflict for CJS minimatch compatibility

Date: 2026-08-06

Agent: antigravity-agent

Scope: pnpm-workspace.yaml, pnpm-lock.yaml

Status: Complete

Related:
[Render cold starts, keep-warm, and the OpenNext spike](./2026-08-06-render-cold-start-and-opennext-spike.md)

## Context

The previous journal entry (`docs/journal/2026-08-06-render-cold-start-and-opennext-spike.md`)
reported an OpenNext build failure caused by a module resolution error:
`SyntaxError: The requested module 'brace-expansion' does not provide an export named 'default'`

Investigating `pnpm-workspace.yaml` revealed that commit `654226c` had set a blunt global override
`"brace-expansion": "^5.0.9"`. Because `brace-expansion` v5 is an ESM module with named/default
export changes, forcing v5 onto CommonJS packages (such as `minimatch@8` and `minimatch@3`) broke
CJS module interop.

## What changed

1. **Major-version-aware `brace-expansion` overrides**: Updated `pnpm-workspace.yaml` to specify
   safe patch/minor releases per major version branch instead of forcing v5 globally:
   - `brace-expansion@<1.1.18` -> `1.1.18` (fixes CVE-2026-14257, GHSA-rgw5-rvv9-x895,
     GHSA-mh99-v99m-4gvg)
   - `brace-expansion@>=2.0.0 <2.1.4` -> `2.1.4`
   - `brace-expansion@>=3.0.0 <3.0.6` -> `3.0.6`
   - `brace-expansion@>=4.0.0 <4.0.1` -> `4.0.1`
   - `brace-expansion@>=5.0.0 <5.0.9` -> `5.0.9`

2. **Lockfile update**: Ran `pnpm install` to update `pnpm-lock.yaml` with the non-breaking,
   version-compatible resolutions.

3. **Host environment cleanup**: Resolved Node 22 + Corepack 0.24 dynamic import issue
   (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`) on the host by disabling corepack and linking
   npm-installed pnpm `11.17.0` to `~/.local/bin/pnpm`.

## Decisions and trade-offs

- **Granular overrides over blunt forced upgrade**: Overriding `brace-expansion` per major version
  range allows `minimatch@3`/`minimatch@8` to use CJS-compatible safe releases (`1.1.18`/`2.1.4`),
  while modern ESM consumers receive `5.0.9`. This satisfies security audit requirements without
  breaking CJS importers.

## Verification

```text
pnpm install     # passed — clean resolution, 10 workspaces synced
pnpm audit       # passed — 0 vulnerabilities found
pnpm test        # passed — 18/18 turbo tasks succeeded, 158 tests passed in @bizo/api, 15 in @bizo/web
@bizo/web:build  # passed — generated static pages cleanly
```

## Follow-ups

1. **Verify OpenNext build**: Test `@opennextjs/cloudflare` build with the fixed `brace-expansion`
   resolution.
2. **Deploy keep-warm worker**: `wrangler secret put WAKE_SECRET` and set `KEEP_WARM_URL` /
   `KEEP_WARM_SECRET` on Render API service.

## Handoff notes

- `pnpm-workspace.yaml` overrides are now compatible with both CJS `minimatch` consumers and ESM
  packages.
- `pnpm audit` passes with 0 vulnerabilities.
- All test suites run and pass cleanly via `pnpm test`.
