const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createJsonStoreRepository } = require("../lib/store-repository");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-store-repo-test-"));
const storePath = path.join(tempDir, "documents.json");

try {
  const repository = createJsonStoreRepository({
    storePath,
    seedStore: () => ({ projects: [{ id: "project-1" }], documents: [] }),
  });

  assert(repository.ensureStore() === true, "ensureStore should create missing store");
  assert(repository.ensureStore() === false, "ensureStore should not recreate existing store");

  const seeded = repository.read();
  assert(seeded.projects?.[0]?.id === "project-1", "read should return seeded project");

  repository.write({ projects: [{ id: "project-2" }], documents: [{ id: "doc-1" }] });
  const updated = repository.read();
  assert(updated.projects?.[0]?.id === "project-2", "write should replace store atomically");
  assert(updated.documents?.[0]?.id === "doc-1", "write should persist documents");

  const health = repository.health();
  assert(health.exists && health.readable && health.writable, "health should report readable and writable store");

  console.log("store repository test passed");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
