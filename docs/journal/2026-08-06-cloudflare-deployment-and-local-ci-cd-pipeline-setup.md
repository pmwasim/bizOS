# Cloudflare deployment and local CI-CD pipeline setup

Date: 2026-08-06

Agent: antigravity

Scope: `scripts/ops/deploy-local.sh`, `package.json`, `/etc/systemd/system/`

Status: Complete

Related: [ADR-0015](../decisions/0015-managed-hosting-behind-cloudflare.md)

## Context

User requested full deployment of bizOS at `https://bizos.qloudihub.com/` using Cloudflare Tunnel on
this Ubuntu host with continuous 24/7 background availability, zero monthly budget cost, and
automated CI/CD pipeline integration.

## What changed

1. **Cloudflare Tunnel (`cloudflared`)**:
   - Installed `cloudflared` v2026.7.3 system package.
   - Authenticated with Cloudflare and created named tunnel `bizos`
     (`33e71432-65a4-4cc8-ae59-cd00e21d06a2`).
   - Routed DNS CNAME `bizos.qloudihub.com` to the `bizos` tunnel.
   - Configured `/etc/cloudflared/config.yml` with `protocol: http2` and `edge-ip-version: "4"` to
     ensure instant connection to Cloudflare edge POPs (`ruh04`/`mrs06`).
   - Provisioned `cloudflared.service` systemd unit configured to start on boot with
     `Restart=always`.

2. **bizOS Application Systemd Services**:
   - `bizos-api.service`: Managed NestJS backend (`apps/api/dist/main.js`) running on port 3001 with
     automatic restart.
   - `bizos-web.service`: Managed Next.js frontend web app (`@bizo/web`) running on port 3000 with
     automatic restart.

3. **Automated CI/CD Script**:
   - Created `scripts/ops/deploy-local.sh` and wired `"ops:deploy:local"` into root `package.json`.
   - Performs database migration, seeding, backend API build, systemd service reloads, and
     end-to-end HTTP 200 health checks.

4. **Dependency Resolution**:
   - Cleaned global `brace-expansion` override from root `package.json` resolutions while preserving
     major-version security overrides in `pnpm-workspace.yaml`.

## Decisions and trade-offs

- **Cloudflare Tunnel Protocol**: Selected `protocol: http2` and `edge-ip-version: "4"` to guarantee
  instant TCP edge handshakes and bypass ISP/firewall UDP/QUIC timeouts.
- **Systemd Process Management**: Provisioned `bizos-api.service`, `bizos-web.service`, and
  `cloudflared.service` under systemd `Type=simple` with `Restart=always` for zero-cost 24/7
  background availability across reboots.

## Verification

```text
pnpm ops:deploy:local            # PASSED — API (200), Web (200), Live Cloudflare Domain (200)
pnpm test                        # PASSED — 25 test files passed (158 tests)
node scripts/check-doc-links.mjs  # PASSED — All local Markdown links resolve
curl -s -I https://bizos.qloudihub.com/ # PASSED — HTTP/2 200 OK
```

## Follow-ups

- None. Deployment, systemd persistence, DNS routing, and CI/CD pipelines are fully operational.

## Handoff notes

- `pnpm ops:deploy:local` executes the full local CI/CD deployment and verifies all 3 health
  endpoints.
- System services `bizos-api`, `bizos-web`, and `cloudflared` will automatically restart on server
  boot or process exit.
