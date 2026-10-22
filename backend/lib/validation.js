const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

const isString = (value) => typeof value === "string";

function isHttpUrl(value) {
  if (!isString(value)) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Validates a POST /search body.
 * @param {{query?: unknown, limit?: unknown}} body
 * @returns {{value: {query: string, limit: number}} | {error: string}}
 *   The trimmed query and a limit defaulted to 12 and capped at 50, or a message for a 400.
 */
function validateSearch({ query, limit = DEFAULT_LIMIT }) {
  if (!isString(query) || !query.trim()) return { error: "query must be a non-empty string" };
  if (!Number.isInteger(limit) || limit < 1) return { error: "limit must be a positive integer" };
  return { value: { query: query.trim(), limit: Math.min(limit, MAX_LIMIT) } };
}

/**
 * Validates a POST /images body.
 * The id becomes a DynamoDB key and part of an S3 key, so it is limited to letters, digits, "-" and "_".
 * @param {{url?: unknown, id?: unknown, description?: unknown, keywords?: unknown}} body
 * @returns {{value: {url: string, id: string|undefined, description: string, keywords: string[]}} | {error: string}}
 *   The fields with optional ones defaulted, or a message for a 400.
 */
function validateIngest({ url, id, description = "", keywords = [] }) {
  if (!isHttpUrl(url)) return { error: "url must be an http(s) URL" };
  if (id !== undefined && !(isString(id) && SAFE_ID.test(id))) {
    return { error: "id must be 1-128 letters, digits, '-' or '_'" };
  }
  if (!isString(description)) return { error: "description must be a string" };
  if (!Array.isArray(keywords) || !keywords.every(isString)) return { error: "keywords must be an array of strings" };
  return { value: { url, id, description, keywords } };
}

module.exports = { validateSearch, validateIngest };
