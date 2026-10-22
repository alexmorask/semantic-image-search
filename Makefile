.PHONY: install up down seed warm api web test test-model ingest deploy dataset embeddings logs
install:   ; cd backend && npm install && cd ../frontend && npm install
up:        ; docker compose up -d
down:      ; docker compose down
seed:      ; NODE_PATH=backend/node_modules node scripts/seed.js
warm:      ; node scripts/warm-model.js
api:       ; node backend/local-server.js
web:       ; cd frontend && npm install --silent && npm run dev
test:      ; cd backend && npm test
test-model:; cd backend && npm run test:model
deploy:    ; bash scripts/deploy.sh
dataset:   ; python3 scripts/fetch_unsplash.py
ingest:    ; node scripts/ingest.js
embeddings:; python3 scripts/generate_embeddings.py
logs:      ; docker compose logs -f localstack
