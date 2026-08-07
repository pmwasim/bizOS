# Development journal

Append-only record of what each session changed and why. Git history answers _what_; the journal
answers _why_, _what was rejected_, and _what is still open_.

Create an entry with `pnpm journal:new -- --title "…" --agent <id>`, fill it as you work, and leave
it complete enough that another agent can resume without asking you a question.

Rules:

- One entry per work session. Never edit or delete another agent's entry.
- Correct a past entry by writing a new one that links back to it.
- Record verification commands and their real result, not the intended result.
- Regenerate this index with `pnpm journal:index`.

## Entries

- [2026-08-07 — PRD Phase 1 implementation: suppliers, inventory, projects, CRM, sales/delivery/credit notes](2026-08-07-prd-phase-1-implementation-suppliers-inventory-projects-crm-.md)
  - Agent: claude-sonnet-5 · Status: Complete (feature-functional and manually verified); zero
    automated test coverage added —
- [2026-08-07 — Diagnose and fix bizOS sign-in 404 (stale dev-server route cache)](2026-08-07-diagnose-and-fix-bizos-sign-in-404-stale-dev-server-route-ca.md)
  - Agent: claude-sonnet-5 · Status: Complete
- [2026-08-06 — Tech debt: brace-expansion resolution, web-tier ADR, and API boot optimization](2026-08-06-tech-debt-brace-expansion-adr-boot-optimization.md)
  - Agent: antigravity-opus · Status: Complete
- [2026-08-06 — Render cold starts, keep-warm, and the OpenNext spike](2026-08-06-render-cold-start-and-opennext-spike.md)
  - Agent: claude-opus (Cowork session) · Status: In progress — keep-warm and retry work complete
    and verified; OpenNext build spike blocked
- [2026-08-06 — PRD implementation: Phase 1-5 feature build-out](2026-08-06-prd-implementation-phase-1-5-feature-build-out.md)
  - Agent: opencode-main · Status: In progress
- [2026-08-06 — Multi-agent workspace tooling](2026-08-06-multi-agent-workspace-tooling.md)
  - Agent: claude-opus · Status: Complete
- [2026-08-06 — Module 7 Payment Recording](2026-08-06-module-7-payment-recording.md)
  - Agent: c0d88fc3-7c6c-444b-b0db-afbe4013189f · Status: Completed
- [2026-08-06 — Fix brace-expansion override conflict for CJS minimatch compatibility](2026-08-06-fix-brace-expansion-override-conflict-for-cjs-minimatch-comp.md)
  - Agent: antigravity-agent · Status: Complete
- [2026-08-06 — Cloudflare deployment and local CI-CD pipeline setup](2026-08-06-cloudflare-deployment-and-local-ci-cd-pipeline-setup.md)
  - Agent: antigravity · Status: Complete
