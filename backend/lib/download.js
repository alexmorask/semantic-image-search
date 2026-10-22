/**
 * Downloads an image over HTTP(S).
 * @param {string} url
 * @returns {Promise<{bytes: Buffer, contentType: string}>}
 * @throws {Error} if the request fails or the response isn't 2xx.
 */
async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed with HTTP ${response.status}: ${url}`);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

module.exports = { downloadImage };
