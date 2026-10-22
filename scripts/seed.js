const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");

const endpoint = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";
const region = process.env.AWS_REGION || "us-east-1";
const TABLE = process.env.TABLE_NAME || "images";
const BUCKET = process.env.BUCKET_NAME || "images";
const creds = { accessKeyId: "test", secretAccessKey: "test" };

const ddb = new DynamoDBClient({ endpoint, region, credentials: creds });
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
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } catch (e) {
    if (e.name !== "BucketAlreadyOwnedByYou") throw e;
  }
  console.log(`bucket ${BUCKET} ready`);
}

(async () => {
  await ensureTable();
  await ensureBucket();
})().catch((e) => { console.error(e); process.exit(1); });
