const express = require("express");
const cors = require("cors");
const { route } = require("./handler");

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

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
