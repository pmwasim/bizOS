# ADR-0015: Managed Node hosting behind Cloudflare for MVP

Status: Accepted

Date: 2026-07-27

Deciders: Release engineering

## Context

The quotation MVP deploys a NestJS API and Next.js web app with PostgreSQL and SMTP. Cloudflare
Workers alone cannot host unmodified NestJS, Prisma, Auth.js, or PDFKit without a rewrite.
Cloudflare Containers can run the existing Dockerfiles but require the Workers Paid plan ($5
USD/month minimum) and are not available on the Workers Free plan.

## Decision drivers

- Minimize application rewrites for private beta.
- Prefer managed container or Node hosting behind Cloudflare DNS/TLS.
- Stay on free tiers when possible; escalate paid resources explicitly.
- Keep Redis/R2/BullMQ unprovisioned until the synchronous MVP path needs them.

## Options considered

- Option A: Cloudflare Workers or Containers for both apps — Containers need Workers Paid; Workers
  need framework adapters and would rewrite Auth.js/Nest/PDF paths.
- Option B: Managed Node/container hosting (Render free/starter, Railway, Fly) with Cloudflare as
  DNS/TLS/CDN edge — fewest app changes; Render free sleeps after idle; paid starter avoids sleep.
- Self-managed VPS — rejected while managed options exist.

## Decision

Choose Option B for the MVP release path:

1. PostgreSQL: existing Prisma Postgres (eu-central-1) with TLS and automated backups.
2. Application runtime: managed Docker/Node web services for `@bizo/web` and `@bizo/api` behind
   Cloudflare.
3. Edge: Cloudflare DNS, Full (strict) TLS, proxy, secure headers, and rate limits for
   `bizos.qloudihub.com` and `api.bizos.qloudihub.com`.
4. Do not provision Redis, BullMQ, or R2 for this release.

Prefer a free Render (or equivalent) path while paid always-on instances await Admin approval.
Record Workers Paid Cloudflare Containers as the future single-vendor migration path once spend is
approved.

## Consequences

- Production remains compatible with the existing Dockerfiles and environment contract.
- Free hosting may cold-start after idle; private-beta users must tolerate wake latency unless paid
  always-on instances are approved.
- DNS and edge security stay on the existing `qloudihub.com` Cloudflare zone without unrelated
  record changes.

## Validation and review trigger

Revisit when Workers Paid is approved, a second region is required, or Redis/R2 become active.
