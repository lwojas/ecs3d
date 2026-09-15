FROM node:20-alpine AS build

WORKDIR /app

COPY scripts/editor/package*.json ./scripts/editor/
RUN npm ci --prefix scripts/editor

COPY assets ./assets
COPY scripts/editor ./scripts/editor

ARG VITE_CONTENT_SERVER_URL=http://lynn2:4000
ARG VITE_CONTENT_PROJECT=raycaster
ENV VITE_CONTENT_SERVER_URL=${VITE_CONTENT_SERVER_URL}
ENV VITE_CONTENT_PROJECT=${VITE_CONTENT_PROJECT}

RUN npm run build --prefix scripts/editor

FROM nginx:alpine

COPY scripts/editor/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/scripts/editor/dist /usr/share/nginx/html

EXPOSE 80
