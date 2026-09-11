ARG NODE_IMAGE=node:22.19.0-alpine3.22
FROM ${NODE_IMAGE}

WORKDIR /app

ENV NODE_ENV=production

COPY --chown=node:node packages/publication-manifest/ packages/publication-manifest/
COPY --chown=node:node services/arkovia-gateway/ services/arkovia-gateway/

USER node
WORKDIR /app/services/arkovia-gateway

EXPOSE 8787

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.ARKCAST_GATEWAY_PORT||'8787')+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.mjs"]
