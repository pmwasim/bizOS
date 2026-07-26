# ADR-0002: Use pnpm workspaces and Turborepo

Status: Accepted  
Date: 2026-07-26

## Context

The web, API, UI, contracts, infrastructure adapters, and future mobile support need shared
standards without publishing every internal package.

## Options considered

- Separate repositories: strong isolation but high contract and tooling coordination cost.
- npm workspaces only: fewer tools, but less efficient task graph and cache support.
- Nx: rich generators and constraints with a larger framework and migration surface.
- pnpm plus Turborepo: strict efficient installs, workspace protocols, and a small task runner.

## Decision

Use pnpm workspaces with exact versions and one lockfile. Use Turborepo for dependency-aware
development, lint, type, test, and build tasks.

## Consequences

Atomic cross-package changes are easy and CI can cache deterministic work. Package boundaries need
lint/architecture enforcement because filesystem proximity can encourage coupling. The package
manager and Node versions become repository contracts.

## Validation and review trigger

Re-evaluate if task graph time, remote caching, access control, or repository size materially blocks
teams.
