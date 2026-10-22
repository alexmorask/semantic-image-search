const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createVectorCache } = require("./vector-cache");

const image = (id, version = "v1") => ({ id, url: `https://img/${id}`, description: version, embedding: [1, 0] });

function pagesFrom(...pages) {
  let scans = 0;
  const loadPages = async function* () {
    scans++;
    for (const page of pages) yield page;
  };
  return { loadPages, scans: () => scans };
}

function gate() {
  let open;
  const opened = new Promise((resolve) => { open = resolve; });
  return { opened, open };
}

const descriptions = (cache) => Object.fromEntries(cache.all().map((entry) => [entry.id, entry.description]));

test("ensureLoaded reads every page before reporting loaded", async () => {
  const source = pagesFrom([image("a"), image("b")], [image("c")]);
  const cache = createVectorCache(source.loadPages);
  assert.equal(cache.isLoaded(), false);
  await cache.ensureLoaded();
  assert.equal(cache.isLoaded(), true);
  assert.deepEqual(cache.all().map((entry) => entry.id).sort(), ["a", "b", "c"]);
});

test("concurrent callers share one scan, and a loaded cache never scans again", async () => {
  const source = pagesFrom([image("a")]);
  const cache = createVectorCache(source.loadPages);
  await Promise.all([cache.ensureLoaded(), cache.ensureLoaded(), cache.ensureLoaded()]);
  await cache.ensureLoaded();
  assert.equal(source.scans(), 1);
});

test("a record added before the first load doesn't count as loaded", async () => {
  const source = pagesFrom([image("a"), image("b")]);
  const cache = createVectorCache(source.loadPages);
  cache.add(image("new"));
  assert.equal(cache.isLoaded(), false);
  await cache.ensureLoaded();
  assert.deepEqual(cache.all().map((entry) => entry.id).sort(), ["a", "b", "new"]);
});

test("records added mid-scan are kept, and the scan never overwrites a newer copy", async () => {
  const betweenPages = gate();
  const cache = createVectorCache(async function* () {
    yield [image("a")];
    await betweenPages.opened;
    yield [image("b", "stale"), image("c")];
  });
  const loading = cache.ensureLoaded();
  await new Promise(setImmediate);
  cache.add(image("b", "fresh"));
  cache.add(image("mid-scan"));
  betweenPages.open();
  await loading;
  assert.deepEqual(descriptions(cache), { a: "v1", b: "fresh", c: "v1", "mid-scan": "v1" });
});

test("after loading, add inserts new records and replaces existing ones", async () => {
  const cache = createVectorCache(pagesFrom([image("a")]).loadPages);
  await cache.ensureLoaded();
  cache.add(image("a", "v2"));
  cache.add(image("b"));
  assert.deepEqual(descriptions(cache), { a: "v2", b: "v1" });
});

test("a failed scan leaves the cache unloaded, and the next call retries", async () => {
  let attempts = 0;
  const cache = createVectorCache(async function* () {
    attempts++;
    if (attempts === 1) throw new Error("dynamodb unavailable");
    yield [image("a")];
  });
  await assert.rejects(cache.ensureLoaded(), /dynamodb unavailable/);
  assert.equal(cache.isLoaded(), false);
  await cache.ensureLoaded();
  assert.equal(cache.isLoaded(), true);
  assert.equal(attempts, 2);
});

test("entries keep only what search needs", async () => {
  const cache = createVectorCache(pagesFrom([{ ...image("a"), keywords: ["x"], s3Key: "originals/a" }]).loadPages);
  await cache.ensureLoaded();
  assert.deepEqual(cache.all(), [{ id: "a", url: "https://img/a", description: "v1", embedding: [1, 0] }]);
});
