const express = require("express");
const cors = require("cors");
const { route, INVALID_JSON } = require("./handler");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  const r = await route("GET", "/health", {});
  res.status(r.statusCode).json(r.body);
});

app.post("/search", async (req, res) => {
  const r = await route("POST", "/search", req.body || {});
  res.status(r.statusCode).json(r.body);
});

app.post("/images", async (req, res) => {
  const r = await route("POST", "/images", req.body || {});
  res.status(r.statusCode).json(r.body);
});

app.delete("/images/:id", async (req, res) => {
  const r = await route("DELETE", req.path, {});
  res.status(r.statusCode).json(r.body);
});

app.use((error, _req, res, next) => {
  if (error.type !== "entity.parse.failed") return next(error);
  res.status(INVALID_JSON.statusCode).json(INVALID_JSON.body);
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
