FROM node:22-slim AS fe
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# live build: relative URLs (empty VITE_GATEWAY_URL), served by the gateway
RUN VITE_GATEWAY_MODE=live VITE_GATEWAY_URL= VITE_UPSTREAM_MODE=replay npm run build
# replay build: static, no gateway needed (play.*)
RUN VITE_GATEWAY_MODE=replay npx vite build --outDir dist-replay

FROM caddy:2 AS caddy
COPY --from=fe /fe/dist-replay /srv/play
COPY deploy/Caddyfile /etc/caddy/Caddyfile

FROM python:3.13-slim AS gateway
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ backend/
COPY agent/ agent/
COPY --from=fe /fe/dist frontend/dist
RUN mkdir -p data/valio
VOLUME /app/data/valio
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
