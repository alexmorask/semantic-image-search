.PHONY: install up down seed api web deploy dataset embeddings logs
install:   ; cd backend && npm install && cd ../frontend && npm install
up:        ; docker compose up -d
down:      ; docker compose down
seed:      ; NODE_PATH=backend/node_modules node scripts/seed.js
api:       ; node backend/local-server.js
web:       ; cd frontend && npm install --silent && npm run dev
deploy:    ; bash scripts/deploy.sh
dataset:   ; python3 scripts/fetch_unsplash.py
embeddings:; python3 scripts/generate_embeddings.py
logs:      ; docker compose logs -f localstack
