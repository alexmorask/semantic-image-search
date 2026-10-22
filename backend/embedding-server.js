const express = require("express");
const { EMBEDDING_MODEL, loadModel, embedImage, embedText } = require("./lib/embedding/local");
const { UnusableImageError } = require("./lib/errors");

const MAX_IMAGE = "10mb";

const app = express();

async function respond(res, embed) {
  try {
    res.json({ model: EMBEDDING_MODEL, embedding: await embed() });
  } catch (error) {
    if (error instanceof UnusableImageError) return res.status(422).json({ error: error.message });
    console.error("embedding failed:", error);
    res.status(500).json({ error: "internal error" });
  }
}

app.get("/health", (_req, res) => res.json({ ok: true, model: EMBEDDING_MODEL }));

app.post("/embed/text", express.json(), (req, res) => {
  const text = req.body && req.body.text;
  if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text must be a non-empty string" });
  return respond(res, () => embedText(text));
});

app.post("/embed/image", express.raw({ type: "application/octet-stream", limit: MAX_IMAGE }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "body must be image bytes" });
  return respond(res, () => embedImage(req.body));
});

app.use((error, _req, res, next) => {
  if (error.type === "entity.too.large") return res.status(413).json({ error: `image is larger than ${MAX_IMAGE}` });
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "request body must be valid JSON" });
  return next(error);
});

const port = process.env.EMBEDDING_PORT || 3002;
loadModel()
  .then(() => app.listen(port, () => console.log(`embedding service (${EMBEDDING_MODEL}) on http://localhost:${port}`)))
  .catch((error) => {
    console.error("could not load the model:", error);
    process.exit(1);
  });
