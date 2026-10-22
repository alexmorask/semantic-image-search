// Loads data/sample_images.json into the DynamoDB table on LocalStack.
const fs = require("fs");
const path = require("path");
const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");

const endpoint = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";
const region = process.env.AWS_REGION || "us-east-1";
const TABLE = process.env.TABLE_NAME || "images";
const BUCKET = process.env.BUCKET_NAME || "images";
const creds = { accessKeyId: "test", secretAccessKey: "test" };

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint, region, credentials: creds }));
const s3 = new S3Client({ endpoint, region, credentials: creds, forcePathStyle: true });

async function ensureTable() {
  try {
    await ddb.send(new CreateTableCommand({
      TableName: TABLE,
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }));
    console.log(`created table ${TABLE}`);
  } catch (e) {
    if (e.name === "ResourceInUseException") console.log(`table ${TABLE} already exists`);
    else throw e;
  }
}

async function ensureBucket() {
  try { await s3.send(new CreateBucketCommand({ Bucket: BUCKET })); console.log(`created bucket ${BUCKET}`); }
  catch (e) { console.log(`bucket ${BUCKET} ready`); }
}

async function load() {
  const items = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "sample_images.json"), "utf8"));
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: batch } }));
  }
  console.log(`seeded ${items.length} items into ${TABLE}`);
}

(async () => {
  await ensureTable();
  await ensureBucket();
  // DynamoDB on LocalStack is ready immediately; a tiny wait avoids a cold-create race.
  await new Promise((r) => setTimeout(r, 500));
  await load();
})().catch((e) => { console.error(e); process.exit(1); });
