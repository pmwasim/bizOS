# syntax=docker/dockerfile:1.7
FROM node:24.19.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY turbo.json tsconfig.base.json eslint.config.mjs ./
COPY scripts/prepare-next-standalone.mjs scripts/prepare-next-standalone.mjs
COPY apps/web apps/web
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY packages/ui packages/ui
RUN pnpm --filter @bizo/web... build

FROM node:24.19.0-bookworm-slim AS runtime
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN groupadd --system --gid 1001 bizo \
    && useradd --system --uid 1001 --gid bizo --home-dir /app bizo
COPY --from=build --chown=bizo:bizo /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=bizo:bizo /workspace/apps/web/.next/static ./apps/web/.next/static
USER bizo
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
