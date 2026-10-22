const fs = require("fs");
const path = require("path");

const API_BASE = process.env.API_BASE || "http://localhost:3001";
const CONCURRENCY = 4;
const file = process.argv[2] || path.join(__dirname, "..", "data", "unsplash_sample.json");

async function ingest({ id, url, description, keywords }) {
  const response = await fetch(`${API_BASE}/images`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, url, description, keywords }),
  });
  if (response.status !== 201) throw new Error(`HTTP ${response.status} ${await response.text()}`);
}

async function ingestAll(items) {
  const failures = [];
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      try {
        await ingest(item);
      } catch (error) {
        failures.push({ id: item.id, url: item.url, error: error.message });
      }
      done++;
      if (done % 50 === 0 || done === items.length) console.log(`${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return failures;
}

(async () => {
  const items = JSON.parse(fs.readFileSync(file, "utf8"));
  const started = Date.now();
  const failures = await ingestAll(items);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`ingested ${items.length - failures.length}/${items.length} from ${path.basename(file)} in ${seconds}s`);
  for (const failure of failures) console.log(`  failed ${failure.id} ${failure.url}: ${failure.error}`);
  process.exitCode = failures.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
