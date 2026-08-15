# CLAUDE.md

The operating instructions for every AI agent working on bizOS live in one place:
**[AGENTS.md](AGENTS.md)**. Read it in full before touching the repository.

This file exists only so that Claude Code and Claude Cowork land on the same protocol as every other
agent. It is deliberately a pointer and not a copy — two sets of instructions drift, and the one an
agent happens to open first would then decide how it behaves.

More than one agent may be working here at the same time. Claim before you edit
(`pnpm agent:claim`), open a journal entry when you start substantive work (`pnpm journal:new`), and
release when you finish (`pnpm agent:release`). The rationale is in
[docs/multi-agent-protocol.md](docs/multi-agent-protocol.md).
