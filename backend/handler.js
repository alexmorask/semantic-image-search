const { ingestImage } = require("./lib/ingest");
const { searchImages } = require("./lib/search");

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

async function dispatch(method, path, body) {
  if (method === "GET" && path.endsWith("/health")) {
    return { statusCode: 200, body: { ok: true } };
  }
  if (method === "POST" && path.endsWith("/search")) {
    const limit = Math.min(body.limit || DEFAULT_LIMIT, MAX_LIMIT);
    const results = await searchImages(body.query, limit);
    return { statusCode: 200, body: { query: body.query, count: results.length, results } };
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
