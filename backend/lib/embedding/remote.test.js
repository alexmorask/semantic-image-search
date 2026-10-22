const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createRemoteEmbedder } = require("./remote");
const { EMBEDDING_MODEL } = require("./model");
const { UnusableImageError } = require("../errors");

const replies = {
  "/embed/text": [200, { model: EMBEDDING_MODEL, embedding: [0.6, 0.8] }],
  "/embed/image": [422, { error: "image could not be decoded: unsupported image format" }],
  "/wrong-model/embed/text": [200, { model: "some/other-model", embedding: [1, 0] }],
  "/broken/embed/text": [500, { error: "internal error" }],
};

const received = [];
let server;
let baseUrl;

before(async () => {
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      received.push({ path: req.url, contentType: req.headers["content-type"], body: Buffer.concat(chunks) });
      const [status, body] = replies[req.url];
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server.close());

test("embedText posts the text as JSON and returns the service's vector", async () => {
  assert.deepEqual(await createRemoteEmbedder(baseUrl).embedText("a dog"), [0.6, 0.8]);
  const request = received.at(-1);
  assert.equal(request.contentType, "application/json");
  assert.deepEqual(JSON.parse(request.body), { text: "a dog" });
});

test("embedImage posts raw bytes, and a 422 from the service becomes UnusableImageError", async () => {
  const bytes = Buffer.from("not really an image");
  await assert.rejects(createRemoteEmbedder(baseUrl).embedImage(bytes), (error) => {
    assert.ok(error instanceof UnusableImageError);
    assert.match(error.message, /could not be decoded/);
    return true;
  });
  const request = received.at(-1);
  assert.equal(request.contentType, "application/octet-stream");
  assert.deepEqual(request.body, bytes);
});

test("a vector from a different model is rejected, so models are never mixed", async () => {
  await assert.rejects(createRemoteEmbedder(`${baseUrl}/wrong-model`).embedText("a dog"), /some\/other-model/);
});

test("any other service failure is an ordinary error (a 500 to our caller, not a 422)", async () => {
  await assert.rejects(createRemoteEmbedder(`${baseUrl}/broken`).embedText("a dog"), (error) => {
    assert.ok(!(error instanceof UnusableImageError));
    assert.match(error.message, /HTTP 500/);
    return true;
  });
});
