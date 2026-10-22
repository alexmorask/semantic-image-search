const { randomUUID } = require("node:crypto");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { ddb, TABLE } = require("./ddb");
const { s3, BUCKET } = require("./s3");
const { downloadImage } = require("./download");
const { EMBEDDING_MODEL, embedImage } = require("./embedding");
const { imageCache } = require("./image-cache");

const originalKey = (id) => `originals/${id}`;

/**
 * Ingests one image: download, embed, store the original in S3, write the record to DynamoDB,
 * and add it to the search cache.
 * Embedding happens before anything is stored, so an unusable image leaves nothing behind.
 * An existing id is overwritten in both S3 and DynamoDB.
 * @param {{url: string, id?: string, description?: string, keywords?: string[]}} input
 * @returns {Promise<{id: string, url: string, description: string, keywords: string[], s3Key: string,
 *   embedding: number[], embeddingModel: string, createdAt: string}>} The stored record.
 * @throws {Error} if the download, embedding, or either write fails.
 */
async function ingestImage({ url, id = randomUUID(), description = "", keywords = [] }) {
  const { bytes, contentType } = await downloadImage(url);
  const embedding = await embedImage(bytes);
  const record = {
    id,
    url,
    description,
    keywords,
    s3Key: originalKey(id),
    embedding,
    embeddingModel: EMBEDDING_MODEL,
    createdAt: new Date().toISOString(),
  };
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: record.s3Key, Body: bytes, ContentType: contentType }));
  await ddb.send(new PutCommand({ TableName: TABLE, Item: record }));
  imageCache.add(record);
  return record;
}

module.exports = { ingestImage };
