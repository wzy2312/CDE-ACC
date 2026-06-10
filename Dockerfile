FROM docker.m.daocloud.io/library/node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    CDE_DATA_DIR=/data \
    PYTHON_BIN=/opt/cde-python/bin/python
RUN sed -i 's|http://deb.debian.org/debian-security|http://repo.huaweicloud.com/debian-security|g; s|http://deb.debian.org/debian|http://repo.huaweicloud.com/debian|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      python3-venv \
      sqlite3 \
      poppler-utils \
      fonts-wqy-microhei \
      fonts-noto-cjk \
      tesseract-ocr \
      tesseract-ocr-eng \
      tesseract-ocr-chi-sim \
    && python3 -m venv /opt/cde-python \
    && /opt/cde-python/bin/pip install --no-cache-dir \
      -i https://repo.huaweicloud.com/repository/pypi/simple \
      --trusted-host repo.huaweicloud.com \
      --timeout 120 \
      --retries 5 \
      numpy \
      openpyxl \
      pillow \
      pypdf \
      PyMuPDF \
      pytesseract \
      reportlab \
      pdf2image \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com
COPY . .
RUN mkdir -p /data/uploads /data/exports /data/attachments
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
