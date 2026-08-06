# Release runbook — 2026-07-28 (stable private-beta release)

Status: Ready for owner execution Owner: repo/Render owner (`pmwasim`)

This is the exact, ordered sequence to take the prepared work live on `https://bizos.qloudihub.com`.
Every engineering gate is already green; the remaining steps require owner credentials (GitHub
merge + `Production deploy` dispatch + production secrets) that the Cloud Agent cannot use.
Estimated hands-on time: a few minutes plus deploy wait.

---

## 0. Why this order

- **BIZ-001 (P1):** `main` currently lets a Default ERP business create a quotation but then fails
  invoice creation (`QUOTATION_NOT_READY`). **Do not deploy `main` without PR #32.** Merging #32 is
  the single release-blocking fix.
- **PR #35 (deploy preflight)** must be merged **before** the next deploy so a green deploy run is
  guaranteed to mean a real rollout (BIZ-004).
- The rest are additive and merge cleanly in the order below (each resolves shared files forward).

## 1. Merge the pull requests (in this order)

For each: open the PR → **Ready for review** → **Merge** (squash). All quality gates are green; the
only failing check is the non-blocking external `Prisma Compute Deploy` job, which is not part of
the merge gate.

| #   | PR  | Title                                    | Notes                      |
| --- | --- | ---------------------------------------- | -------------------------- |
| 1   | #36 | Truthful release docs                    | docs-only                  |
| 2   | #32 | Config-aware invoice readiness (BIZ-001) | **release blocker**        |
| 3   | #34 | Customer payments slice                  | adds one DB migration      |
| 4   | #35 | Deploy preflight gate (BIZ-004)          | **merge before deploying** |
| 5   | #37 | Release version endpoint (BIZ-011)       | enables SHA verification   |
| 6   | #38 | Signed client-IP forwarding (BIZ-003)    | needs secret (step 2)      |
| 7   | #39 | Release-readiness check                  | post-deploy tool (step 5)  |

If you want the **minimal** safe release, merge **#32 and #35** (plus #36 for honest copy) and
deploy; the rest can follow in a second release.

## 2. Add the new production secret (for PR #38)

PR #38 only takes effect once this secret is present on **both** services. Generate and set it:

```bash
openssl rand -hex 32
```

- Render `bizos-web` → env `CLIENT_IP_SIGNATURE_SECRET`
- Render `bizos-api` → env `CLIENT_IP_SIGNATURE_SECRET` (same value)

Until this is set, the API preserves the current (unsigned) behaviour, so there is no rush — but the
throttle-spoof fix is inactive without it.

## 3. Deploy to production

1. Confirm `main` CI is green for the merged head SHA.
2. Actions → **Production deploy** → **Run workflow**:
   - `git_sha`: the merged `main` head SHA (40-hex)
   - leave `skip_migrate` **false** (PR #34 ships a migration)
3. The preflight job (from #35) now fails fast if `RENDER_*` or `DATABASE_URL` secrets are missing —
   so a green run means the rollout actually completed.
4. Wait for the workflow's web/API health waits to pass (free-tier cold starts can exceed 10 min).

## 4. Verify the release is stable

```bash
RELEASE_EXPECT_SHA=<merged-main-head-sha> pnpm ops:release-readiness
```

Expect `5/5 checks passed`. The `gitSha.matchesTarget` check activates once the deployed image
includes PR #37. Then run the authenticated smoke (already in the repo):

```bash
node e2e/prod-invoice-smoke.mjs
```

Optionally, manually verify the **Default ERP no-PO path** (the BIZ-001 fix): sign up, skip guided
setup (Default ERP), create + send a quotation, and confirm **Create invoice** works **without** a
customer PO.

## 5. If something goes wrong (rollback)

1. Actions → **Production deploy** → **Run workflow** with `rollback_to_sha` = the prior known-good
   SHA (see previous workflow summaries).
2. Do **not** reverse the payments migration automatically — it is additive and safe to leave; old
   code simply does not read the new tables.
3. Re-run step 4 to confirm the rollback is serving.

---

## Remaining release blockers not covered by this runbook

These still need an owner decision or production access before general availability / paid
customers; they do **not** block this private-beta release:

- **BIZ-002** automated encrypted backup + restore drill (needs R2/age credentials +
  isolated-restore approval)
- **BIZ-005** migration/rollback compatibility gate (depends on BIZ-002)
- **BIZ-008** privacy/terms/password-reset/export/delete (needs a jurisdiction/legal decision)
- **BIZ-009** dependency-aware readiness + verified alerting
- **BIZ-012** CSP/HSTS enforcement (readiness check currently reports the missing HSTS)
