const assert = require("node:assert/strict");
const {
  normalizeIssueLocationFields,
  hasIssueLocation,
  migrateIssueBindings,
} = require("../lib/issue-location");

const normalized = normalizeIssueLocationFields({
  viewer_state: {
    viewport: {
      eye: [1, 2, 3],
      target: [4, 5, 6],
      up: [0, 1, 0],
    },
  },
  dbids: ["7", 8, -1, "bad"],
  model_urn: " urn:model:v1 ",
  sheet_guid: " sheet-a ",
  element_unique_id: " unique-1 ",
  element_id: 42,
  bound_model_version: " V1 ",
  migration_status: "unknown",
});

assert.deepEqual(normalized.viewerState.viewport.eye, [1, 2, 3]);
assert.deepEqual(normalized.dbIds, [7, 8]);
assert.equal(normalized.modelUrn, "urn:model:v1");
assert.equal(normalized.sheetGuid, "sheet-a");
assert.equal(normalized.elementUniqueId, "unique-1");
assert.equal(normalized.elementId, "42");
assert.equal(normalized.boundModelVersion, "V1");
assert.equal(normalized.migrationStatus, "synced");
assert.equal(hasIssueLocation(normalized), true);

const annotations = [
  {
    id: "synced",
    status: "open",
    versionId: "version-old",
    dbIds: [11],
    modelUrn: "urn:model:v1",
    elementUniqueId: "unique-1",
    elementId: "1001",
    boundModelVersion: "V1",
    migrationStatus: "synced",
  },
  {
    id: "deleted",
    status: "open",
    versionId: "version-old",
    dbIds: [12],
    modelUrn: "urn:model:v1",
    elementUniqueId: "unique-missing",
    boundModelVersion: "V1",
    migrationStatus: "synced",
  },
  {
    id: "pending",
    status: "open",
    versionId: "version-old",
    dbIds: [13],
    modelUrn: "urn:model:v1",
    elementUniqueId: "unique-many",
    boundModelVersion: "V1",
    migrationStatus: "synced",
  },
  {
    id: "resolved-ignored",
    status: "resolved",
    versionId: "version-old",
    dbIds: [14],
    modelUrn: "urn:model:v1",
    elementUniqueId: "unique-resolved",
    boundModelVersion: "V1",
    migrationStatus: "synced",
  },
];

const migration = migrateIssueBindings(annotations, {
  versionId: "version-new",
  modelUrn: "urn:model:v2",
  boundModelVersion: "V2",
  elementIndex: [
    { dbId: 201, elementUniqueId: "unique-1", elementId: "1001" },
    { dbId: 301, elementUniqueId: "unique-many" },
    { dbId: 302, elementUniqueId: "unique-many" },
    { dbId: 401, elementUniqueId: "unique-resolved" },
  ],
});

assert.equal(migration.synced, 1);
assert.equal(migration.deleted, 1);
assert.equal(migration.pending, 1);
assert.equal(migration.skipped, 1);
assert.deepEqual(annotations.find((item) => item.id === "synced").dbIds, [201]);
assert.equal(annotations.find((item) => item.id === "synced").modelUrn, "urn:model:v2");
assert.equal(annotations.find((item) => item.id === "synced").versionId, "version-new");
assert.equal(annotations.find((item) => item.id === "deleted").migrationStatus, "deleted");
assert.equal(annotations.find((item) => item.id === "pending").migrationStatus, "pending");
assert.deepEqual(annotations.find((item) => item.id === "resolved-ignored").dbIds, [14]);

console.log("issue location test passed");
