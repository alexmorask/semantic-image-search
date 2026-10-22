.PHONY: install up down seed warm api web test deploy dataset embeddings logs
install:   ; cd backend && npm install && cd ../frontend && npm install
up:        ; docker compose up -d
down:      ; docker compose down
seed:      ; NODE_PATH=backend/node_modules node scripts/seed.js
warm:      ; node scripts/warm-model.js
api:       ; node backend/local-server.js
web:       ; cd frontend && npm install --silent && npm run dev
test:      ; cd backend && npm test
deploy:    ; bash scripts/deploy.sh
dataset:   ; python3 scripts/fetch_unsplash.py
embeddings:; python3 scripts/generate_embeddings.py
logs:      ; docker compose logs -f localstack
