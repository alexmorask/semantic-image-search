#!/usr/bin/env bash
# Deploys the handler to LocalStack Lambda behind a Function URL. The Lambda has no model:
# it calls the embedding service (make embed) on the host for vectors (decision 24).
set -euo pipefail

ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
REGION="${AWS_REGION:-us-east-1}"
TABLE="${TABLE_NAME:-images}"
BUCKET="${BUCKET_NAME:-images}"
EMBEDDING_URL="${LAMBDA_EMBEDDING_URL:-http://host.docker.internal:3002}"
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION="$REGION"

AWS="aws --endpoint-url=$ENDPOINT"
command -v awslocal >/dev/null 2>&1 && AWS="awslocal"

echo "==> packaging lambda (no node_modules: the nodejs20.x runtime provides the AWS SDK)"
( cd backend && rm -f ../function.zip && zip -qr ../function.zip handler.js lib -x 'lib/*.test.js' 'lib/*.model-check.js' )
ls -lh function.zip | awk '{print "    function.zip: " $5}'

echo "==> lambda function"
$AWS lambda delete-function --function-name image-search >/dev/null 2>&1 || true
$AWS lambda create-function --function-name image-search \
  --runtime nodejs20.x --handler handler.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --timeout 60 --memory-size 512 \
  --environment "Variables={EMBEDDING_URL=$EMBEDDING_URL,TABLE_NAME=$TABLE,BUCKET_NAME=$BUCKET}" >/dev/null
$AWS lambda wait function-active-v2 --function-name image-search

echo "==> function url"
URL=$($AWS lambda create-function-url-config --function-name image-search --auth-type NONE \
  --query FunctionUrl --output text)
URL="${URL%/}"

echo ""
echo "Deployed. Function URL: $URL"
echo "  Needs the embedding service running on the host: make embed"
echo "  Health: curl $URL/health"
echo "  Frontend through a same-origin proxy (no browser CORS): make web-lambda LAMBDA_URL=$URL"
