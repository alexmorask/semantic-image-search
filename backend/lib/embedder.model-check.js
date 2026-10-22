const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { loadModel, embedImage, embedText } = require("./embedder");
const { dot } = require("./vectors");

const solidSquare = (r, g, b) =>
  sharp({ create: { width: 224, height: 224, channels: 3, background: { r, g, b } } }).png().toBuffer();

const assertUnitVector = (vector) => {
  assert.ok(Array.isArray(vector));
  assert.equal(vector.length, 512);
  assert.ok(Math.abs(Math.sqrt(dot(vector, vector)) - 1) < 1e-6);
};

test("concurrent callers share one model load", () => {
  assert.equal(loadModel(), loadModel());
});

test("images and text embed to normalized 512-number vectors", async () => {
  assertUnitVector(await embedImage(await solidSquare(255, 0, 0)));
  assertUnitVector(await embedText("a red square"));
});

test("an image scores higher against matching text than against non-matching text", async () => {
  const [red, blue] = await Promise.all([embedImage(await solidSquare(255, 0, 0)), embedImage(await solidSquare(0, 0, 255))]);
  const [redText, blueText] = await Promise.all([embedText("a red square"), embedText("a blue square")]);
  assert.ok(dot(red, redText) > dot(red, blueText), "red image should match 'a red square'");
  assert.ok(dot(blue, blueText) > dot(blue, redText), "blue image should match 'a blue square'");
});

test("bytes that aren't an image are rejected", async () => {
  await assert.rejects(embedImage(Buffer.from("this is not an image")), /unsupported image format/);
});
