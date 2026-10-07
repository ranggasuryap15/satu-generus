# @file Dockerfile
# @purpose Environment Docker development container untuk SvelteKit aplikasi Satu Generus
# @usedBy docker compose up, docker build
# @dependencies Node.js 22-slim, build tools native addons (python3, make, g++)
# @publicFunctions N/A (Docker container image)
# @sideEffects Menjalankan dev server Vite pada port 5173 dengan host 0.0.0.0
FROM node:22-slim

WORKDIR /app

# Install dependensi sistem untuk kompilasi better-sqlite3 native addon
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

# Buat folder /data dengan permission yang tepat untuk file SQLite
RUN mkdir -p /data

EXPOSE 5173

ENV HOST=0.0.0.0
ENV PORT=5173
ENV DATABASE_URL=/data/sqlite.db

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

