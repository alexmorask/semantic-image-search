const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const LOWEST_SCORE = -1;
const HIGHEST_SCORE = 1;
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

const isScore = (value) => Number.isFinite(value) && value >= LOWEST_SCORE && value <= HIGHEST_SCORE;

/**
 * Validates a POST /search body.
 * minScore defaults to -1, the lowest possible cosine similarity, so leaving it out filters nothing.
 * @param {{query?: unknown, limit?: unknown, minScore?: unknown}} body
 * @returns {{value: {query: string, limit: number, minScore: number}} | {error: string}}
 *   The trimmed query, a limit defaulted to 12 and capped at 50, and a minScore in [-1, 1],
 *   or a message for a 400.
 */
function validateSearch({ query, limit = DEFAULT_LIMIT, minScore = LOWEST_SCORE }) {
  if (!isString(query) || !query.trim()) return { error: "query must be a non-empty string" };
  if (!Number.isInteger(limit) || limit < 1) return { error: "limit must be a positive integer" };
  if (!isScore(minScore)) return { error: "minScore must be a number between -1 and 1" };
  return { value: { query: query.trim(), limit: Math.min(limit, MAX_LIMIT), minScore } };
}

/**
 * Validates an image id. The id becomes a DynamoDB key and part of an S3 key,
 * so it is limited to 1-128 letters, digits, "-" and "_".
 * @param {unknown} id
 * @returns {{value: string} | {error: string}} The id, or a message for a 400.
 */
function validateImageId(id) {
  if (!isString(id) || !SAFE_ID.test(id)) return { error: "id must be 1-128 letters, digits, '-' or '_'" };
  return { value: id };
}

/**
 * Validates a POST /images body. An id is optional, but must pass validateImageId when given.
 * @param {{url?: unknown, id?: unknown, description?: unknown, keywords?: unknown}} body
 * @returns {{value: {url: string, id: string|undefined, description: string, keywords: string[]}} | {error: string}}
 *   The fields with optional ones defaulted, or a message for a 400.
 */
function validateIngest({ url, id, description = "", keywords = [] }) {
  if (!isHttpUrl(url)) return { error: "url must be an http(s) URL" };
  const checkedId = id === undefined ? {} : validateImageId(id);
  if (checkedId.error) return checkedId;
  if (!isString(description)) return { error: "description must be a string" };
  if (!Array.isArray(keywords) || !keywords.every(isString)) return { error: "keywords must be an array of strings" };
  return { value: { url, id, description, keywords } };
}

module.exports = { validateSearch, validateIngest, validateImageId };
