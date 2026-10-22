const { EMBEDDING_MODEL, loadModel } = require("../backend/lib/embedding/local");

(async () => {
  const started = Date.now();
  await loadModel();
  console.log(`${EMBEDDING_MODEL} ready in ${((Date.now() - started) / 1000).toFixed(1)}s`);
})().catch((e) => { console.error(e); process.exit(1); });
