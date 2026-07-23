# ---- Build stage: instala dependências (compila better-sqlite3 se necessário) ----
FROM node:20-bookworm AS build
WORKDIR /app

# Apenas manifests primeiro (cache de camadas eficiente).
COPY package*.json ./
RUN npm ci --omit=dev

# Código da aplicação.
COPY server ./server
COPY public ./public

# ---- Runtime stage: imagem enxuta só com o necessário para rodar ----
FROM node:20-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/questodia.db

# Pasta persistente do banco (montada como volume).
RUN mkdir -p /data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/public ./public
COPY package.json ./

EXPOSE 3000
VOLUME ["/data"]

# Verificação de saúde usando a rota /health da aplicação.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server/index.js"]
