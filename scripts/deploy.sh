#!/usr/bin/env bash
# Deploys the handler to LocalStack Lambda behind an HTTP API (the serverless path).
# The local API server (make api) is the reliable default; use this to validate on LocalStack.
set -euo pipefail

ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
REGION="${AWS_REGION:-us-east-1}"
TABLE="${TABLE_NAME:-images}"
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION="$REGION"

AWS="aws --endpoint-url=$ENDPOINT"
command -v awslocal >/dev/null 2>&1 && AWS="awslocal"

echo "==> packaging lambda"
( cd backend && npm install --omit=dev --silent && rm -f ../function.zip && zip -qr ../function.zip handler.js lib node_modules )

echo "==> lambda function"
$AWS lambda delete-function --function-name image-search >/dev/null 2>&1 || true
$AWS lambda create-function --function-name image-search \
  --runtime nodejs18.x --handler handler.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --timeout 30 \
  --environment "Variables={AWS_ENDPOINT_URL=http://localstack:4566,TABLE_NAME=$TABLE,AWS_REGION=$REGION}" >/dev/null
# Inside the lambda container LocalStack is reachable at http://localstack:4566

echo "==> http api"
API_ID=$($AWS apigatewayv2 create-api --name image-search-api --protocol-type HTTP --query ApiId --output text)
LAMBDA_ARN=$($AWS lambda get-function --function-name image-search --query Configuration.FunctionArn --output text)
INT_ID=$($AWS apigatewayv2 create-integration --api-id "$API_ID" \
  --integration-type AWS_PROXY --integration-uri "$LAMBDA_ARN" \
  --payload-format-version 2.0 --query IntegrationId --output text)
$AWS apigatewayv2 create-route --api-id "$API_ID" --route-key 'GET /health'  --target "integrations/$INT_ID" >/dev/null
$AWS apigatewayv2 create-route --api-id "$API_ID" --route-key 'POST /search' --target "integrations/$INT_ID" >/dev/null
$AWS apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' --auto-deploy >/dev/null
$AWS lambda add-permission --function-name image-search --statement-id apigw \
  --action lambda:InvokeFunction --principal apigateway.amazonaws.com >/dev/null 2>&1 || true

echo ""
echo "Deployed. API id: $API_ID"
echo "Invoke URL (LocalStack): http://localhost:4566/_aws/execute-api/$API_ID/\$default"
echo "  Health: curl http://localhost:4566/_aws/execute-api/$API_ID/\$default/health"
echo "Note: the invoke URL format can vary by LocalStack version; check 'make logs' if a route 404s."
echo "Point the frontend at it:  VITE_API_BASE=http://localhost:4566/_aws/execute-api/$API_ID/\$default"
