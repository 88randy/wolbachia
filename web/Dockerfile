# syntax=docker/dockerfile:1
# Web app image. Build context is the REPOSITORY ROOT (the app consumes packages/tokens and
# packages/i18n):   docker build -f web/Dockerfile --target runtime .
#
# Stages: deps -> dev (Vite dev server, used by compose) | build -> runtime (nginx, static files).
# Keep NODE_VERSION equal to .nvmrc; CI fails the build otherwise (see web.yml).

ARG NODE_VERSION=22.13.0
ARG NGINX_VERSION=1.30

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /repo
RUN chown node:node /repo
USER node
# 1) Only the manifests (COPY --parents keeps their folders), so the npm layer is cached until
#    a dependency changes. npm ci checks every workspace of package-lock.json, hence the globs
#    (web, packages/*, and mobile once it has a package.json); .dockerignore keeps the rest out.
COPY --chown=node:node --parents package.json package-lock.json */package.json packages/*/package.json ./
RUN npm ci --workspace=@wolbachia/web --include-workspace-root
# 2) Then the sources.
COPY --chown=node:node . .

FROM deps AS dev
ENV NODE_ENV=development
WORKDIR /repo/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
# Vite writes VITE_* into the public bundle at build time. Never pass a secret here.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build --workspace=@wolbachia/web

FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine AS runtime
COPY web/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY web/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
