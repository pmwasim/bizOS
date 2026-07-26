# ADR-0012: Govern plugins and AI agents through application capabilities

Status: Accepted  
Date: 2026-07-26

## Context

Plugins and AI can expand bizOS, but direct database/code authority would defeat tenant isolation,
audit, and predictable workflows.

## Options considered

- In-process arbitrary plugins: powerful and operationally simple, with unacceptable blast radius.
- Database/API keys with broad access: easy integration and weak least privilege.
- Governed capability manifests and isolated execution.

## Decision

Extensions declare versioned capabilities, scopes, resources, data use, and events. They call the
same authorized application commands and queries as other clients. Execution is isolated and
bounded. AI retrieval is permission-filtered; actions show evidence and require confirmation when
material. Prompt content never changes policy.

## Consequences

The platform needs manifests, signing, review, revocation, quotas, sandboxing, audit, and
compatibility tooling before third-party execution launches. Capability design is slower but safer
and reusable across humans, integrations, and agents.

## Validation and review trigger

Threat-model and penetration-test the extension runtime before enabling untrusted packages or
autonomous writes.
