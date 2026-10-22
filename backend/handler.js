const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, TABLE } = require("./lib/ddb");
const { ingestImage } = require("./lib/ingest");

// Small sample => a Scan is fine. Real scale is a design discussion for the live round.
async function loadItems() {
  const out = await ddb.send(new ScanCommand({ TableName: TABLE }));
  return out.Items || [];
}

// ---------------------------------------------------------------------------
// TODO(candidate): replace this naive keyword match with real semantic search.
//   1. Embed the incoming query with your chosen model or API.
//   2. Score each image's embedding against the query (e.g. cosine similarity).
//      Image embeddings can come from `make embeddings` (data/embeddings.json),
//      or load them however your design calls for.
//   3. Return the top N by score.
// The naive version below only exists so the pipeline runs end to end today.
// ---------------------------------------------------------------------------
function naiveSearch(items, query, limit) {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  return items
    .map((it) => {
      const hay = (String(it.description || "") + " " + (it.keywords || []).join(" ")).toLowerCase();
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { id: it.id, url: it.url, description: it.description, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit || 12);
}

async function dispatch(method, path, body) {
  if (method === "GET" && path.endsWith("/health")) {
    return { statusCode: 200, body: { ok: true } };
  }
  if (method === "POST" && path.endsWith("/search")) {
    const items = await loadItems();
    const results = naiveSearch(items, body.query, body.limit);
    return { statusCode: 200, body: { query: body.query || "", count: results.length, results } };
  }
  if (method === "POST" && path.endsWith("/images")) {
    const { id, url, description, embeddingModel, createdAt } = await ingestImage(body);
    return { statusCode: 201, body: { id, url, description, embeddingModel, createdAt } };
  }
  return { statusCode: 404, body: { error: "not found" } };
}

/**
 * Routes one request for both the Lambda handler and the local Express server.
 * Any unexpected error is logged and becomes a 500, so a request never hangs or leaks internals.
 * @param {string} method HTTP method.
 * @param {string} path Request path.
 * @param {object} body Parsed JSON body.
 * @returns {Promise<{statusCode: number, body: object}>}
 */
async function route(method, path, body) {
  try {
    return await dispatch(method, path, body);
  } catch (error) {
    console.error(`${method} ${path} failed:`, error);
    return { statusCode: 500, body: { error: "internal error" } };
  }
}

// Lambda entrypoint (API Gateway v2 / Function URL event shape)
exports.handler = async (event) => {
  const method =
    (event.requestContext && event.requestContext.http && event.requestContext.http.method) ||
    event.httpMethod ||
    "GET";
  const path = event.rawPath || event.path || "/";
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) {}
  const r = await route(method, path, body);
  return {
    statusCode: r.statusCode,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    body: JSON.stringify(r.body),
  };
};

// shared with the local dev server
exports.route = route;
