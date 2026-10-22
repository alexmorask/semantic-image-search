const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalize, dot, topK } = require("./vectors");

const length = (vector) => Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

test("normalize scales a vector to length 1", () => {
  const unit = normalize([3, 4]);
  close(unit[0], 0.6);
  close(unit[1], 0.8);
  close(length(normalize([0.2, -1.5, 7, 0.01])), 1);
});

test("normalize returns a plain array and leaves the input unchanged", () => {
  const input = new Float32Array([3, 4]);
  const unit = normalize(input);
  assert.ok(Array.isArray(unit));
  assert.deepEqual(Array.from(input), [3, 4]);
});

test("normalize rejects a zero vector", () => {
  assert.throws(() => normalize([0, 0, 0]), /zero vector/);
});

test("dot multiplies and sums matching components", () => {
  assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
});

test("dot of a normalized vector with itself is 1", () => {
  const unit = normalize([0.3, -2, 5]);
  close(dot(unit, unit), 1);
});

test("dot rejects vectors of different lengths", () => {
  assert.throws(() => dot([1, 2], [1, 2, 3]), /length/);
});

const items = [
  { id: "far", embedding: [0, 1] },
  { id: "near", embedding: [1, 0] },
  { id: "mid", embedding: normalize([1, 1]) },
];

test("topK ranks items by score, highest first", () => {
  const ranked = topK([1, 0], items, 3);
  assert.deepEqual(ranked.map((r) => r.item.id), ["near", "mid", "far"]);
  close(ranked[0].score, 1);
  close(ranked[2].score, 0);
});

test("topK returns at most limit results", () => {
  assert.deepEqual(topK([1, 0], items, 2).map((r) => r.item.id), ["near", "mid"]);
});

test("topK breaks score ties by id so order is deterministic", () => {
  const tied = [
    { id: "b", embedding: [1, 0] },
    { id: "c", embedding: [1, 0] },
    { id: "a", embedding: [1, 0] },
  ];
  assert.deepEqual(topK([1, 0], tied, 3).map((r) => r.item.id), ["a", "b", "c"]);
});

test("topK returns everything when there are fewer items than limit, and nothing when empty", () => {
  assert.equal(topK([1, 0], items, 50).length, 3);
  assert.deepEqual(topK([1, 0], [], 12), []);
});
