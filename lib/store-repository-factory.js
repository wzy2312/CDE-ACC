const path = require("node:path");
const { createJsonStoreRepository } = require("./store-repository");
const { createSQLiteStoreRepository } = require("./sqlite-store-repository");

const STORE_ADAPTERS = Object.freeze({
  json: "json",
  sqlite: "sqlite",
});

function normalizeStoreAdapter(adapter) {
  return String(adapter || STORE_ADAPTERS.json).trim().toLowerCase() || STORE_ADAPTERS.json;
}

function createStoreRepository(options = {}) {
  const adapter = normalizeStoreAdapter(options.adapter);
  const dataDir = options.dataDir || path.dirname(options.storePath || "");

  if (adapter === STORE_ADAPTERS.json) {
    return createJsonStoreRepository({
      storePath: options.storePath,
      seedStore: options.seedStore,
    });
  }

  if (adapter === STORE_ADAPTERS.sqlite) {
    return createSQLiteStoreRepository({
      dbPath: options.sqlitePath || path.join(dataDir, "documents.db"),
      schemaPath: options.schemaPath,
      seedStore: options.seedStore,
    });
  }

  throw new Error(`Unsupported CDE_STORE_ADAPTER "${options.adapter}". Expected json or sqlite.`);
}

module.exports = {
  STORE_ADAPTERS,
  createStoreRepository,
  normalizeStoreAdapter,
};
