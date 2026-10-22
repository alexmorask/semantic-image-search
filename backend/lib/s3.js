const { S3Client } = require("@aws-sdk/client-s3");

const endpoint = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";
const region = process.env.AWS_REGION || "us-east-1";

const client = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  forcePathStyle: true,
});

module.exports = {
  s3: client,
  BUCKET: process.env.BUCKET_NAME || "images",
};
