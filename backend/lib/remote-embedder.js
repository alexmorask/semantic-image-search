const { EMBEDDING_MODEL } = require("./model");
const { UnusableImageError } = require("./errors");

const TIMEOUT_MS = 30_000;

/**
 * Creates an embedder that calls a separate embedding service over HTTP, with the same
 * embedImage/embedText interface as the in-process embedder.
 * Every response must name the same model this code expects, so vectors from different
 * models are never mixed (decision 24).
 * @param {string} baseUrl The embedding service, e.g. http://host.docker.internal:3002.
 * @returns {{embedImage: (bytes: Buffer|Uint8Array) => Promise<number[]>, embedText: (text: string) => Promise<number[]>}}
 */
function createRemoteEmbedder(baseUrl) {
  async function post(path, body, contentType) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = await response.json();
    if (response.status === 422) throw new UnusableImageError(payload.error);
    if (!response.ok) throw new Error(`embedding service returned HTTP ${response.status}: ${payload.error}`);
    if (payload.model !== EMBEDDING_MODEL) {
      throw new Error(`embedding service model ${payload.model} doesn't match ${EMBEDDING_MODEL}`);
    }
    return payload.embedding;
  }

  return {
    embedImage: (bytes) => post("/embed/image", bytes, "application/octet-stream"),
    embedText: (text) => post("/embed/text", JSON.stringify({ text }), "application/json"),
  };
}

module.exports = { createRemoteEmbedder };
