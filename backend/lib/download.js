const { UnusableImageError } = require("./errors");

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 10 * 1024 * 1024;

async function readCapped(body) {
  const chunks = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new UnusableImageError("image is larger than 10MB");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function fetchImage(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new UnusableImageError(`image download failed with HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new UnusableImageError("image is larger than 10MB");
  return {
    bytes: await readCapped(response.body),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

/**
 * Downloads an image over HTTP(S), giving up after 10 seconds or 10MB.
 * @param {string} url
 * @returns {Promise<{bytes: Buffer, contentType: string}>}
 * @throws {UnusableImageError} if the request fails, isn't 2xx, times out, or exceeds 10MB.
 */
async function downloadImage(url) {
  try {
    return await fetchImage(url, AbortSignal.timeout(TIMEOUT_MS));
  } catch (error) {
    if (error instanceof UnusableImageError) throw error;
    if (error.name === "TimeoutError") throw new UnusableImageError("image download timed out after 10s");
    throw new UnusableImageError(`image download failed: ${error.cause?.code || error.message}`);
  }
}

module.exports = { downloadImage };
