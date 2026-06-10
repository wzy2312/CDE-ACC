FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    CDE_DATA_DIR=/data
COPY package*.json ./
RUN apk add --no-cache sqlite && npm ci --omit=dev
COPY . .
RUN mkdir -p /data/uploads /data/exports /data/attachments
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
