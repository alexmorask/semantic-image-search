const { ingestImage } = require("./lib/ingest");
const { searchImages } = require("./lib/search");
const { validateSearch, validateIngest } = require("./lib/validation");
const { UnusableImageError } = require("./lib/errors");

const INVALID_JSON = { statusCode: 400, body: { error: "request body must be valid JSON" } };
const badRequest = (error) => ({ statusCode: 400, body: { error } });

async function ingest(input) {
  try {
    const { id, url, description, embeddingModel, createdAt } = await ingestImage(input);
    return { statusCode: 201, body: { id, url, description, embeddingModel, createdAt } };
  } catch (error) {
    if (error instanceof UnusableImageError) return { statusCode: 422, body: { error: error.message } };
    throw error;
  }
}

async function dispatch(method, path, body) {
  if (method === "GET" && path.endsWith("/health")) {
    return { statusCode: 200, body: { ok: true } };
  }
  if (method === "POST" && path.endsWith("/search")) {
    const { value, error } = validateSearch(body);
    if (error) return badRequest(error);
    const results = await searchImages(value.query, value.limit, value.minScore);
    return { statusCode: 200, body: { query: value.query, count: results.length, results } };
  }
  if (method === "POST" && path.endsWith("/images")) {
    const { value, error } = validateIngest(body);
    if (error) return badRequest(error);
    return ingest(value);
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
    return await dispatch(method, path, body || {});
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
  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return toLambdaResponse(INVALID_JSON);
  }
  return toLambdaResponse(await route(method, path, body));
};

function toLambdaResponse(r) {
  return {
    statusCode: r.statusCode,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    body: JSON.stringify(r.body),
  };
}

// shared with the local dev server
exports.route = route;
exports.INVALID_JSON = INVALID_JSON;
