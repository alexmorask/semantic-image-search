const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { ddb, TABLE } = require("./ddb");
const { s3, BUCKET } = require("./s3");
const { imageCache } = require("./image-cache");

/**
 * Deletes an image: its DynamoDB record first (the source of truth), then its original in S3,
 * then its search cache entry. If the S3 delete fails, the record is already gone and the
 * orphaned original is left for a cleanup sweep, rather than leaving a record that can't be re-embedded.
 * @param {string} id A validated image id.
 * @returns {Promise<boolean>} false if no image had that id.
 * @throws {Error} if DynamoDB or S3 fails.
 */
async function deleteImage(id) {
  const { Attributes } = await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id }, ReturnValues: "ALL_OLD" }));
  if (!Attributes) return false;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: Attributes.s3Key }));
  imageCache.remove(id);
  return true;
}

module.exports = { deleteImage };
