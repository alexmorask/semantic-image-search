.PHONY: install up down seed warm api embed web web-lambda test test-model ingest deploy dataset logs
install:   ; cd backend && npm install && cd ../frontend && npm install
up:        ; docker compose up -d
down:      ; docker compose down
seed:      ; NODE_PATH=backend/node_modules node scripts/seed.js
warm:      ; node scripts/warm-model.js
api:       ; node backend/local-server.js
embed:     ; node backend/embedding-server.js
web:       ; cd frontend && npm install --silent && npm run dev
web-lambda:; cd frontend && npm install --silent && LAMBDA_URL=$(LAMBDA_URL) VITE_API_BASE=/api npm run dev
test:      ; cd backend && npm test
test-model:; cd backend && npm run test:model
deploy:    ; bash scripts/deploy.sh
dataset:   ; python3 scripts/fetch_unsplash.py
ingest:    ; node scripts/ingest.js
logs:      ; docker compose logs -f localstack
