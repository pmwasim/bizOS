# ADR-0001: Record architecture decisions

Status: Accepted  
Date: 2026-07-26  
Deciders: Platform architecture

## Context

bizOS is intended to grow across modules, countries, integrations, and teams. Important choices
otherwise become folklore and are repeated without their original constraints.

## Options considered

- Decisions only in pull requests: close to code but hard to discover later.
- A mutable architecture document: simple but erases history and alternatives.
- Lightweight ADRs in the repository: discoverable, versioned, and explicit.

## Decision

Record durable product-engineering decisions as ADRs in `docs/decisions`. Each compares credible
alternatives, states consequences, and names a validation or replacement trigger.

## Consequences

Material decisions add small writing and review cost. The repository gains an inspectable decision
history. ADRs do not replace code, tests, runbooks, or current-state architecture documentation.

## Validation and review trigger

Review the ADR index each quarter and whenever implementation repeatedly contradicts an accepted
decision.
