# GitHub governance

Status: Accepted

## Branch strategy

`main` is always releasable and protected. Work uses short-lived branches:

- `feat/<description>`
- `fix/<description>`
- `docs/<description>`
- `chore/<description>`
- `security/<private-description>` only when disclosure is safe

Release branches are avoided. Urgent fixes branch from the current production tag and merge back
through the same checks.

## Pull requests

Pull requests require a linked issue or decision context, Conventional Commit title, scoped change,
tests, documentation, security/tenant analysis, and rollback notes. CODEOWNERS review is required
for owned areas. Authors do not provide the only approval for high-risk changes.

## Required checks

- CI quality gate
- CodeQL
- dependency review
- secret scanning/push protection
- future migration, integration, container, and end-to-end gates when those paths exist

Use merge queue and squash merge. Delete branches after merge. Require conversation resolution,
linear history, signed commits/tags when the team can operate them reliably, and no force pushes.

## Labels

Labels use namespaces: `type:`, `area:`, `priority:`, `status:`, `risk:`, and `size:`. One type and
priority should be present. Risk labels trigger additional review.

## Milestones

- Phase 0 - Engineering Foundation
- Phase 1 - Document Workflow Core
- Phase 2 - Payments and Statements
- Phase 3 - Integrations and Automation

Milestones represent outcomes with exit criteria, not dates promised without capacity evidence.

## Project recommendation

Use one organization/repository Project with views:

- Roadmap grouped by milestone
- Current work grouped by status
- Architecture decisions filtered to `type: architecture`
- Security and reliability filtered to `risk: security` or `risk: reliability`
- Research filtered to `type: research`

Fields: Status, Priority, Area, Milestone, Size, Risk, Target release, and Owner. Automations add
new issues to Inbox, move merged pull requests to Done, and mark stale blocked work for review.

## Repository settings

Enable issues, Projects, discussions when community support is staffed, private vulnerability
reporting, dependency graph, Dependabot alerts/updates, secret scanning, push protection, and
automatic branch deletion. Disable the wiki because `/docs` is versioned with code.
