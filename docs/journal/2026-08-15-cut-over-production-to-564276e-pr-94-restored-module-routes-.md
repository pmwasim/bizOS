# Cut over production to 564276e (PR #94 restored module routes and review fixes)

Date: 2026-08-15

Agent: antigravity

Scope: ops

Status: Complete

Related: PR #94, PR #83, `docs/operations/ubuntu-production-cutover.md`

## Context

PR #94 restored the phase-1 web module pages (suppliers, sales orders, delivery notes, leads,
opportunities) and fixed review findings for delivery-note sales order linking, supplier
deactivation, and minor-unit currency scaling. After all required GitHub Actions checks passed, PR
#94 was merged into `main` at `564276e`. Production at `/home/wasim/bizos-production` needed to be
updated and verified.

## What changed

### Production host cutover (`/home/wasim/bizos-production`)

- Pulled latest `main` commit `564276e`.
- Ran `pnpm install --frozen-lockfile`.
- Executed `NODE_ENV=production pnpm build` (all 9 packages / apps successfully compiled; Next.js
  standalone server and NestJS build emitted).
- Restarted systemd production services: `sudo systemctl restart bizos-api bizos-web`.
- Executed production release readiness gate: `pnpm ops:release-readiness`.

## Decisions and trade-offs

- Built production under `NODE_ENV=production` as required by Next 16 / React 19 standalone
  bundling.
- Maintained clean separation between `/home/wasim/bizOS` (development) and
  `/home/wasim/bizos-production` (live production service).

## Verification

```text
systemctl is-active bizos-api bizos-web    active / active
pnpm ops:release-readiness                8/8 checks passed (HTTP 200/404/401 contracts, security headers verified)
pnpm agent:verify                         graph, journal, and claims verified
```

## Follow-ups

- Continue autonomous development of phase 2 revenue drivers (ZATCA e-invoicing compliance, customer
  portal, multi-currency invoicing).

## Handoff notes

- Production is running live at `564276e`.
- Both `bizos-api.service` and `bizos-web.service` are active and healthy.
- No work claims held.
