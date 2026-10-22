const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, TABLE } = require("./ddb");
const { createVectorCache } = require("./vector-cache");

/**
 * Reads the whole images table one Scan page at a time, following LastEvaluatedKey until it runs out.
 * A single Scan returns at most 1MB, which is far fewer than 400 records with 512-number vectors.
 * @returns {AsyncGenerator<Array<{id: string, url: string, description: string, embedding: number[]}>>}
 */
async function* scanImagePages() {
  let ExclusiveStartKey;
  do {
    const page = await ddb.send(new ScanCommand({
      TableName: TABLE,
      ProjectionExpression: "id, #url, description, embedding",
      ExpressionAttributeNames: { "#url": "url" },
      ExclusiveStartKey,
    }));
    yield page.Items || [];
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
}

const imageCache = createVectorCache(scanImagePages);

module.exports = { imageCache, scanImagePages };
