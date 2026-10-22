const toEntry = ({ id, url, description, embedding }) => ({ id, url, description, embedding });

/**
 * Creates an in-memory cache of image vectors, filled from a paged source on first use.
 * "Loaded" means every page has been read; a cache that only holds ingested records is not loaded.
 * Concurrent loads share one scan. Records added at any time are kept, and the scan only adds
 * records the cache doesn't already have, so it never replaces a newer copy (decision 17).
 * Records removed before the load finishes are remembered until it does, so a page read
 * before the removal can't bring them back.
 * @param {() => AsyncIterable<Array<{id: string, url: string, description: string, embedding: number[]}>>} loadPages
 * @returns {{ensureLoaded: () => Promise<void>, isLoaded: () => boolean, add: (record: object) => void,
 *   remove: (id: string) => void, all: () => object[]}}
 */
function createVectorCache(loadPages) {
  const entries = new Map();
  const removedBeforeLoad = new Set();
  let loaded = false;
  let loading;

  async function scanAll() {
    for await (const page of loadPages()) {
      for (const record of page) {
        if (!entries.has(record.id) && !removedBeforeLoad.has(record.id)) entries.set(record.id, toEntry(record));
      }
    }
    loaded = true;
    removedBeforeLoad.clear();
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
    remove(id) {
      entries.delete(id);
      if (!loaded) removedBeforeLoad.add(id);
    },
    all: () => Array.from(entries.values()),
  };
}

module.exports = { createVectorCache };
