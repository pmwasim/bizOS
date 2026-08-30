# syntax=docker/dockerfile:1.7
FROM node:24.20.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/authorization/package.json packages/authorization/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/storage/package.json packages/storage/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY turbo.json tsconfig.base.json eslint.config.mjs ./
COPY apps/api apps/api
COPY packages/authorization packages/authorization
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY packages/storage packages/storage
RUN pnpm --filter @bizo/api... build
RUN pnpm --filter @bizo/api --prod deploy /opt/bizo
RUN cp -R apps/api/dist /opt/bizo/dist

FROM node:24.20.0-bookworm-slim AS runtime
ENV NODE_ENV=production
# Build metadata for the release manifest / version endpoint (BIZ-011).
# Both the CI image build and Render can supply these; they default to unset.
ARG GIT_SHA
ARG BUILD_TIME
ENV GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}
WORKDIR /app
RUN groupadd --system --gid 1001 bizo \
    && useradd --system --uid 1001 --gid bizo --home-dir /app bizo
COPY --from=build --chown=bizo:bizo /opt/bizo ./
USER bizo
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3001/api/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
