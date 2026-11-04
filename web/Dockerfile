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
# The whole workspace, not only the manifests: npm ci checks every workspace of package-lock.json,
# and the set of workspaces keeps growing (mobile, api-client). .dockerignore keeps this small.
COPY --chown=node:node . .
RUN npm ci --workspace=@wolbachia/web --include-workspace-root

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
