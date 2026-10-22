const toEntry = ({ id, url, description, embedding }) => ({ id, url, description, embedding });

/**
 * Creates an in-memory cache of image vectors, filled from a paged source on first use.
 * "Loaded" means every page has been read; a cache that only holds ingested records is not loaded.
 * Concurrent loads share one scan. Records added at any time are kept, and the scan only adds
 * records the cache doesn't already have, so it never replaces a newer copy (decision 17).
 * @param {() => AsyncIterable<Array<{id: string, url: string, description: string, embedding: number[]}>>} loadPages
 * @returns {{ensureLoaded: () => Promise<void>, isLoaded: () => boolean, add: (record: object) => void, all: () => object[]}}
 */
function createVectorCache(loadPages) {
  const entries = new Map();
  let loaded = false;
  let loading;

  async function scanAll() {
    for await (const page of loadPages()) {
      for (const record of page) {
        if (!entries.has(record.id)) entries.set(record.id, toEntry(record));
      }
    }
    loaded = true;
  }

  return {
    ensureLoaded() {
      if (loaded) return Promise.resolve();
      loading ??= scanAll().catch((error) => {
        loading = undefined;
        throw error;
      });
      return loading;
    },
    isLoaded: () => loaded,
    add(record) {
      entries.set(record.id, toEntry(record));
    },
    all: () => Array.from(entries.values()),
  };
}

module.exports = { createVectorCache };
