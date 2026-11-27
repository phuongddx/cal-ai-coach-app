# CoachCal API image. Build context is the REPOSITORY ROOT (the API imports the workspace packages):
#   docker build -f apps/api/Dockerfile -t coachcal-api .
#
# The workspace packages (@coachcal/api-contract, @coachcal/core) ship TypeScript source, so the
# container runs the source through tsx (`node --import tsx`), the same way `npm start` does.
# `npm run build` runs in the build stage as a compile gate: an image is only produced from code that
# type-checks.

FROM node:24-slim AS build
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
# Installs the API workspace and the workspace packages it uses (tsx comes with the API's dev dependencies).
RUN npm ci --workspace=@coachcal/api --include-workspace-root=false --no-audit --no-fund \
 && npm run build --workspace=@coachcal/api \
 && rm -rf apps/api/dist

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787
WORKDIR /app
# node:24-slim already has the unprivileged user `node` (uid 1000).
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps/api ./apps/api
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
WORKDIR /app/apps/api
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# One process, no shell: SIGTERM from `docker stop` reaches Node and the API closes cleanly.
CMD ["node", "--import", "tsx", "src/index.ts"]
