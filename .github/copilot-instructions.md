# GitHub Copilot instructions

The operating instructions for every AI agent working on bizOS live in one place:
**[AGENTS.md](../AGENTS.md)**. Read it in full before proposing changes.

This file is a pointer, not a copy. Two sets of instructions drift, and whichever one an agent opens
first would then decide how it behaves.

Non-negotiables worth repeating here, because they are the ones most often broken by a
suggestion-shaped tool:

- Conventional Commits with the scopes Commitlint enforces.
- No placeholder, skipped test, weakened assertion, silenced rule, or hidden retry.
- A change that invalidates a handbook statement updates that document in the same change.
- Merging to `main`, tagging, production deploys, and credential handling are human decisions.
