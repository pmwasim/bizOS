# Private-beta operational closure report

Date: 2026-07-27 (UTC)  
Scope: production ops cutover on Ubuntu clone — **no product feature expansion**

## Verdict

**Product + deploy path: closed for private beta.**  
**Ops hardening: partially closed** — remaining items need Admin dashboard/login (Cloudflare token
rotation + Worker deploy) and optional paid Prisma Starter for managed backups.

Live stack verified after ops merge:

| Check                                               | Result                                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Web `https://bizos.qloudihub.com/`                  | HTTP 200                                                                                       |
| API `https://api.bizos.qloudihub.com/api/v1/health` | HTTP 200 `{"status":"ok"}`                                                                     |
| Unauth PDF proxy                                    | HTTP 401 JSON `Sign in to continue.`                                                           |
| DNS `bizos` / `api.bizos`                           | CNAME → Render hosts, **DNS-only** (`proxied=false`)                                           |
| Production health workflow                          | success (run after #22 merge)                                                                  |
| App deploy SHA                                      | `7b2c080` (PDF fix) — ops merge `2c8734f` is docs/workflows only; **no app redeploy required** |

## Closed this session

1. **Draft PR [#22](https://github.com/pmwasim/bizOS/pull/22) squash-merged** → `2c8734f` on
   `main`  
   Free CF health Worker source, production-health workflow, monitoring/rotation/runbook docs, QA
   cleanup evidence + SQL replay.
2. **GitHub env origin vars corrected** (were self-CNAMEs; broke edge bootstrap):
   - `WEB_ORIGIN_HOST=bizos-web.onrender.com`
   - `API_ORIGIN_HOST=bizos-api-3z63.onrender.com`
3. **Cloudflare edge bootstrap re-run** → success; CNAMEs refreshed DNS-only to Render.
4. **QA cutover tenants removed** (evidence:
   [qa-cutover-cleanup-evidence.md](./qa-cutover-cleanup-evidence.md)).
5. **Prisma backups inventory** — Primary `db_cms34xzjv4gsfzmf97wvbucqv` list **empty**; do **not**
   claim managed backup readiness.
6. **Production health** workflow on `main` probed web+API successfully.

## Blocked / Admin-gated (not claimed done)

| Item                                 | Evidence                                                                                            | Next action                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Rotate `CLOUDFLARE_API_TOKEN`        | Token active for Zone/DNS but lacks Zone Settings Edit + Workers; Worker deploy failed `10000` auth | Dashboard: create least-privilege token → `gh secret set` → revoke old |
| Deploy `bizos-health` Worker         | Run `30294011182` failed Wrangler auth                                                              | After token update: run **Deploy Cloudflare health worker**            |
| Infrastructure validation full green | CF token + R2 jobs failed on current secrets                                                        | Re-run after token (+ R2 if needed)                                    |
| Prisma managed backups               | Empty backup list; free tier has no daily snapshots                                                 | Approve Starter if recoverability required                             |
| Ephemeral Prisma branch DBs          | ~10 non-default DBs from PR/dependabot (free-tier pressure)                                         | Admin confirm delete of non-primary DBs only                           |

Packet: [admin-approval-ops-closure.md](./admin-approval-ops-closure.md)

## Explicit non-claims

- Managed Prisma backups are **not** ready.
- Cloudflare health Worker is **not** live until token rotation.
- Render MCP remains unauthorized for deploy listing; use GitHub **Production deploy**.
- No orange-cloud on Render CNAMEs (breaks with prohibited IP).

## References

- Handoff: [ubuntu-cutover-handoff.md](./ubuntu-cutover-handoff.md)
- Monitoring: [monitoring.md](./monitoring.md)
- Token rotation: [cloudflare-token-rotation.md](./cloudflare-token-rotation.md)
- Runbook: [production-runbook.md](./production-runbook.md)
