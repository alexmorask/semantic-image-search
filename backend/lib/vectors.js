/**
 * Dot product of two vectors. For vectors of length 1 this equals their cosine similarity.
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number}
 * @throws {Error} if the vectors differ in length, e.g. embeddings from different models.
 */
function dot(a, b) {
  if (a.length !== b.length) throw new Error(`vector length mismatch: ${a.length} vs ${b.length}`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Scales a vector to length 1 without modifying the input.
 * @param {ArrayLike<number>} vector Plain array or typed array (CLIP returns a Float32Array).
 * @returns {number[]} A new plain array, ready to store in DynamoDB.
 * @throws {Error} on a zero vector, which has no direction and signals a broken embedding.
 */
function normalize(vector) {
  const magnitude = Math.sqrt(dot(vector, vector));
  if (magnitude === 0) throw new Error("cannot normalize a zero vector");
  return Array.from(vector, (x) => x / magnitude);
}

function compareIds(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function byScoreThenId(a, b) {
  return b.score - a.score || compareIds(a.item.id, b.item.id);
}

/**
 * Scores every item against the query and returns the best matches.
 * Ties are broken by id, so the same input always gives the same order.
 * @param {ArrayLike<number>} query Normalized query vector.
 * @param {Array<{id: string, embedding: ArrayLike<number>}>} items Items with normalized embeddings.
 * @param {number} limit Maximum number of results.
 * @returns {Array<{item: object, score: number}>} Highest score first.
 */
function topK(query, items, limit) {
  return items
    .map((item) => ({ item, score: dot(query, item.embedding) }))
    .sort(byScoreThenId)
    .slice(0, limit);
}

module.exports = { normalize, dot, topK };
