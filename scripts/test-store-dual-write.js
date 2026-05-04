const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createJsonStoreRepository } = require("../lib/store-repository");
const { createSQLiteStoreRepository, sqliteCliAvailable } = require("../lib/sqlite-store-repository");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadCurrentStore() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "documents.json"), "utf8"));
}

function byId(items = []) {
  return [...items].sort((left, right) => String(left.id || "").localeCompare(String(right.id || "")));
}

function byBusinessKey(items = [], keyFn) {
  return [...items].sort((left, right) => keyFn(left).localeCompare(keyFn(right)));
}

function uniqueByBusinessKey(items = [], keyFn) {
  const records = new Map();
  for (const item of items || []) {
    records.set(keyFn(item), item);
  }
  return byBusinessKey([...records.values()], keyFn);
}

function normalizeComparableStore(store) {
  return {
    projects: byId(store.projects).map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      guestPolicy: item.guestPolicy || {},
    })),
    users: byId(store.users).map((item) => ({
      id: item.id,
      email: item.email,
      name: item.name,
      status: item.status,
      platformRole: item.platformRole,
    })),
    projectMembers: uniqueByBusinessKey(
      store.projectMembers,
      (item) => `${item.projectId || ""}:${item.userId || ""}:${item.removedAt || ""}`,
    ).map((item) => ({
      projectId: item.projectId,
      userId: item.userId,
      role: item.role,
      removedAt: item.removedAt || "",
    })),
    folders: byId(store.folders).map((item) => ({
      projectId: item.projectId,
      parentId: item.parentId || null,
      name: item.name,
      policyKey: item.policyKey || "",
    })),
    folderPermissions: byId(store.folderPermissions).map((item) => ({
      id: item.id,
      projectId: item.projectId,
      folderId: item.folderId,
      userId: item.userId,
      permission: item.permission,
    })),
    documents: byId(store.documents).map((item) => ({
      projectId: item.projectId,
      parentId: item.parentId || null,
      name: item.name,
      version: item.version,
      status: item.status,
      currentVersionId: item.currentVersionId,
      versionCount: Array.isArray(item.versionHistory) ? item.versionHistory.length : 0,
      annotationCount: Array.isArray(item.annotations) ? item.annotations.length : 0,
      replyCount: (item.annotations || []).reduce((sum, annotation) => sum + (annotation.replies || []).length, 0),
      workflowIds: [...(item.workflowIds || [])].sort(),
      apsUrn: item.aps?.urn || "",
    })),
    workflowTemplates: byId(store.workflowTemplates).map((item) => ({
      id: item.id,
      projectId: item.projectId,
      name: item.name,
      enabled: item.enabled !== false,
      stepCount: Array.isArray(item.steps) ? item.steps.length : 0,
      autoExportEnabled: Boolean(item.autoExport?.enabled),
    })),
    workflows: byId(store.workflows).map((item) => ({
      id: item.id,
      projectId: item.projectId,
      workflowName: item.workflowName,
      status: item.status,
      currentStepIndex: Number(item.currentStepIndex || 0),
      fileRefCount: Array.isArray(item.fileRefs) ? item.fileRefs.length : 0,
      stepCount: Array.isArray(item.steps) ? item.steps.length : 0,
      autoExportStatus: item.autoExport?.status || "",
    })),
    auditLogs: byId(store.auditLogs).map((item) => ({
      id: item.id,
      userId: item.userId,
      projectId: item.projectId,
      action: item.action,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
    })),
    jobs: byId(store.jobs).map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      resourceType: item.resourceType || "",
      resourceId: item.resourceId || "",
      attempts: Number(item.attempts || 0),
    })),
    systemEmailSettings: store.systemEmailSettings
      ? {
        enabled: Boolean(store.systemEmailSettings.enabled),
        host: store.systemEmailSettings.host || "",
        port: Number(store.systemEmailSettings.port || 0),
        senderEmail: store.systemEmailSettings.senderEmail || "",
      }
      : null,
    projectEmailNotificationSettings: byId(store.projectEmailNotificationSettings || []).map((item) => ({
      id: item.id,
      projectId: item.projectId,
      enabled: Boolean(item.enabled),
      digestMode: item.digestMode || "immediate",
      recipientCount: Object.values(item.recipients || {}).filter(Boolean).length,
      eventCount: Object.values(item.events || {}).filter(Boolean).length,
    })),
  };
}

function assertDeepEqual(left, right, label) {
  const leftJson = JSON.stringify(left, null, 2);
  const rightJson = JSON.stringify(right, null, 2);
  if (leftJson !== rightJson) {
    const leftLines = leftJson.split("\n");
    const rightLines = rightJson.split("\n");
    const index = leftLines.findIndex((line, lineIndex) => line !== rightLines[lineIndex]);
    throw new Error(`${label} mismatch at line ${index + 1}\njson: ${leftLines[index]}\nsqlite: ${rightLines[index]}`);
  }
}

if (!sqliteCliAvailable()) {
  console.log("store dual-write test skipped: sqlite3 CLI unavailable");
  process.exit(0);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-store-dual-write-"));

try {
  const sourceStore = loadCurrentStore();
  const jsonRepository = createJsonStoreRepository({
    storePath: path.join(tempDir, "store.json"),
    seedStore: () => sourceStore,
  });
  const sqliteRepository = createSQLiteStoreRepository({
    dbPath: path.join(tempDir, "store.db"),
    seedStore: () => sourceStore,
  });

  jsonRepository.write(sourceStore);
  sqliteRepository.write(sourceStore);

  const jsonStore = normalizeComparableStore(jsonRepository.read());
  const sqliteStore = normalizeComparableStore(sqliteRepository.read());
  assertDeepEqual(jsonStore, sqliteStore, "initial dual-write readback");

  const mutatedStore = {
    ...sourceStore,
    projects: [
      ...sourceStore.projects,
      {
        id: "project-dual-write",
        name: "双写测试项目",
        code: "DUAL",
        description: "dual write test",
        folderPolicyKey: "cde_standard",
        memberInitMode: "creator_only",
        memberSourceProjectId: "",
        templateInitMode: "default_templates",
        templateSourceProjectId: "",
        createdBy: "test",
        guestPolicy: { canDownload: false, canAnnotate: false, canReply: false },
        createdAt: "2026-04-25T00:00:00.000Z",
      },
    ],
  };

  jsonRepository.write(mutatedStore);
  sqliteRepository.write(mutatedStore);
  assertDeepEqual(
    normalizeComparableStore(jsonRepository.read()),
    normalizeComparableStore(sqliteRepository.read()),
    "mutated dual-write readback",
  );

  const jsonHealth = jsonRepository.health();
  const sqliteHealth = sqliteRepository.health();
  assert(jsonHealth.readable && jsonHealth.writable, "json repository should be healthy");
  assert(sqliteHealth.readable && sqliteHealth.writable && sqliteHealth.adapter === "sqlite", "sqlite repository should be healthy");

  console.log("store dual-write test passed");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
