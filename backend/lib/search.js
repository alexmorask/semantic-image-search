const { embedText } = require("./embedding");
const { imageCache } = require("./image-cache");
const { topK } = require("./vectors");

/**
 * Finds the images closest in meaning to a text query.
 * Embeds the query while the cache loads (the first search waits for the full Scan).
 * @param {string} query
 * @param {number} limit Maximum number of results.
 * @param {number} minScore Results scoring below this are dropped, so fewer than limit may return.
 * @returns {Promise<Array<{id: string, url: string, description: string, score: number}>>} Highest score first.
 */
async function searchImages(query, limit, minScore) {
  const [queryVector] = await Promise.all([embedText(query), imageCache.ensureLoaded()]);
  return topK(queryVector, imageCache.all(), limit)
    .filter(({ score }) => score >= minScore)
    .map(({ item, score }) => ({
      id: item.id,
      url: item.url,
      description: item.description,
      score,
    }));
}

module.exports = { searchImages };
