const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateSearch, validateIngest } = require("./validation");

test("validateSearch accepts a query and applies the default limit", () => {
  assert.deepEqual(validateSearch({ query: "a dog" }), { value: { query: "a dog", limit: 12 } });
});

test("validateSearch trims the query and keeps a valid limit", () => {
  assert.deepEqual(validateSearch({ query: "  a dog  ", limit: 3 }), { value: { query: "a dog", limit: 3 } });
});

test("validateSearch caps the limit at 50", () => {
  assert.equal(validateSearch({ query: "a dog", limit: 500 }).value.limit, 50);
});

test("validateSearch rejects a missing, empty, blank, or non-string query", () => {
  for (const query of [undefined, "", "   ", 42, null, ["a dog"]]) {
    assert.match(validateSearch({ query }).error, /query/, `query ${JSON.stringify(query)}`);
  }
});

test("validateSearch rejects a limit that isn't a positive integer", () => {
  for (const limit of [0, -1, 2.5, "12", null, NaN]) {
    assert.match(validateSearch({ query: "a dog", limit }).error, /limit/, `limit ${JSON.stringify(limit)}`);
  }
});

const url = "https://images.unsplash.com/photo-1?w=400";

test("validateIngest accepts a url alone and fills the optional fields' defaults", () => {
  assert.deepEqual(validateIngest({ url }), { value: { url, id: undefined, description: "", keywords: [] } });
});

test("validateIngest keeps valid optional fields", () => {
  const body = { url, id: "droTbsEL2HA", description: "a dog", keywords: ["dog", "snow"] };
  assert.deepEqual(validateIngest(body), { value: body });
});

test("validateIngest accepts http as well as https", () => {
  assert.equal(validateIngest({ url: "http://example.com/a.jpg" }).value.url, "http://example.com/a.jpg");
});

test("validateIngest rejects a missing, malformed, or non-http(s) url", () => {
  for (const bad of [undefined, "", "not a url", "ftp://example.com/a.jpg", "file:///etc/passwd", 42]) {
    assert.match(validateIngest({ url: bad }).error, /url/, `url ${JSON.stringify(bad)}`);
  }
});

test("validateIngest rejects an id that isn't a safe key", () => {
  for (const id of ["", "a/b", "../x", "has space", "x".repeat(129), 7]) {
    assert.match(validateIngest({ url, id }).error, /id/, `id ${JSON.stringify(id)}`);
  }
});

test("validateIngest rejects a description that isn't a string", () => {
  assert.match(validateIngest({ url, description: 5 }).error, /description/);
});

test("validateIngest rejects keywords that aren't an array of strings", () => {
  for (const keywords of ["dog", [1, 2], ["dog", null]]) {
    assert.match(validateIngest({ url, keywords }).error, /keywords/, `keywords ${JSON.stringify(keywords)}`);
  }
});
