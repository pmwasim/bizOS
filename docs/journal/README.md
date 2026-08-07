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
