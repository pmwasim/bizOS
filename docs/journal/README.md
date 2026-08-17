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

- [2026-08-17 — Take over bizOS autonomously: fabrication sweep, beta claims, MMF-2](2026-08-17-take-over-bizos-autonomously-fabrication-sweep-beta-claims-m.md)
  - Agent: claude-cowork · Status: Ready for review
- [2026-08-17 — Define the MMF and deliver "Money customers owe"](2026-08-17-define-the-mmf-and-deliver-money-customers-owe.md)
  - Agent: claude-cowork · Status: Ready for review
- [2026-08-17 — Close the MMF-1 write-back gap and assert A7, A8, A11](2026-08-17-close-the-mmf-1-write-back-gap-and-assert-a7-a8-a11.md)
  - Agent: claude-cowork · Status: Ready for review
- [2026-08-15 — Stabilize PR81 for production release](2026-08-15-stabilize-pr81-for-production-release.md)
  - Agent: claude-cowork · Status: Complete
- [2026-08-15 — Prevent cumulative payment over-allocation across completed payments (Issue #59)](2026-08-15-prevent-cumulative-payment-over-allocation-across-completed-.md)
  - Agent: antigravity · Status: Done
- [2026-08-15 — Merge PR81 and cut production over to the production build](2026-08-15-merge-pr81-and-cut-production-over-to-the-production-build.md)
  - Agent: claude-cowork · Status: Complete
- [2026-08-15 — Cut over production to 564276e (PR #94 restored module routes and review fixes)](2026-08-15-cut-over-production-to-564276e-pr-94-restored-module-routes-.md)
  - Agent: antigravity · Status: Complete
- [2026-08-15 — Close the two open PR94 findings and record a production restart I caused](2026-08-15-close-the-two-open-pr94-findings-and-record-a-production-res.md)
  - Agent: claude-cowork · Status: Complete
- [2026-08-15 — Branch audit: recover unmerged phase-1 work and fix three broken document write paths](2026-08-15-branch-audit-recover-unmerged-phase-1-work-and-fix-three-bro.md)
  - Agent: claude-cowork · Status: Complete
- [2026-08-15 — Audit issue 60 blobs and close the payment void gap](2026-08-15-audit-issue-60-blobs-and-close-the-payment-void-gap.md)
  - Agent: claude-cowork · Status: Complete
- [2026-08-15 — Address PR94 review feedback: sales-order link to delivery notes, supplier deactivation, and minor-unit forms](2026-08-15-address-pr94-review-feedback-sales-order-link-to-delivery-no.md)
  - Agent: antigravity · Status: Complete
- [2026-08-15 — Add public pricing page with multi-currency country selector and billing toggle](2026-08-15-add-public-pricing-page-with-multi-currency-country-selector.md)
  - Agent: antigravity · Status: Done
- [2026-08-07 — Retire obsolete Render production path](2026-08-07-retire-render-production-path.md)
  - Agent: chatgpt-gpt-5.6-thinking · Status: Complete — GitHub CI verified; live Ubuntu incident
    remains open
- [2026-08-07 — Harden payment state-transition authorization](2026-08-07-payment-state-transition-authorization.md)
  - Agent: chatgpt-gpt-5.6-thinking · Status: Complete — GitHub CI verified
- [2026-08-07 — Harden payment boundary and runtime artifact handling](2026-08-07-harden-payment-boundary-and-runtime-artifacts.md)
  - Agent: chatgpt-gpt-5.6-thinking · Status: Complete — GitHub CI verified
- [2026-08-06 — Render cold starts, keep-warm, and the OpenNext spike](2026-08-06-render-cold-start-and-opennext-spike.md)
  - Agent: claude-opus (Cowork session) · Status: In progress — keep-warm and retry work complete
    and verified; OpenNext build spike blocked
- [2026-08-06 — Multi-agent workspace tooling](2026-08-06-multi-agent-workspace-tooling.md)
  - Agent: claude-opus · Status: Complete
- [2026-08-06 — Module 7 Payment Recording](2026-08-06-module-7-payment-recording.md)
  - Agent: c0d88fc3-7c6c-444b-b0db-afbe4013189f · Status: Completed
- [2026-08-06 — Fix brace-expansion override conflict for CJS minimatch compatibility](2026-08-06-fix-brace-expansion-override-conflict-for-cjs-minimatch-comp.md)
  - Agent: antigravity-agent · Status: Complete
