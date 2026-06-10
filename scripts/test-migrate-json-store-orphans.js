const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { buildSeedSql } = require("./migrate-json-store");

function sqliteCliAvailable() {
  try {
    execFileSync("sqlite3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!sqliteCliAvailable()) {
  console.log("migrate json store orphan test skipped: sqlite3 CLI unavailable");
  process.exit(0);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-migrate-orphans-"));
const dbPath = path.join(tempDir, "documents.db");
const schemaPath = path.join(__dirname, "..", "db", "schema.sql");

const now = new Date("2026-05-30T00:00:00.000Z").toISOString();
const store = {
  projects: [{
    id: "project-1",
    name: "Project 1",
    code: "P1",
    createdAt: now,
    updatedAt: now,
  }],
  users: [{
    id: "user-1",
    name: "User 1",
    email: "user1@example.com",
    createdAt: now,
    updatedAt: now,
  }],
  projectMembers: [{
    id: "member-1",
    projectId: "project-1",
    userId: "user-1",
    role: "member",
    createdAt: now,
    updatedAt: now,
  }, {
    id: "member-2",
    projectId: "project-1",
    userId: "user-1",
    role: "member",
    createdAt: now,
    updatedAt: now,
  }],
  folders: [{
    id: "folder-parent",
    projectId: "project-1",
    parentId: null,
    name: "Parent",
    createdAt: now,
    updatedAt: now,
  }, {
    id: "folder-1",
    projectId: "project-1",
    parentId: "folder-parent",
    name: "Shared Name",
    createdAt: now,
    updatedAt: now,
  }, {
    id: "folder-2",
    projectId: "project-1",
    parentId: "folder-parent",
    name: "Shared Name",
    createdAt: now,
    updatedAt: now,
  }],
  documents: [{
    id: "doc-1",
    projectId: "project-1",
    name: "model.nwd",
    storedFileName: "model.nwd",
    size: 1,
    uploadedAt: now,
    updatedAt: now,
    versions: [{
      id: "version-1",
      version: "V1",
      versionNo: 1,
      name: "model.nwd",
      storedFileName: "model.nwd",
      size: 1,
      uploadedAt: now,
      isCurrent: true,
    }],
  }],
  modelGeometryExtractionTasks: [{
    id: "task-valid",
    documentId: "doc-1",
    projectId: "project-1",
    status: "done",
    createdAt: now,
    updatedAt: now,
  }, {
    id: "task-orphan",
    documentId: "missing-doc",
    projectId: "project-1",
    status: "failed",
    createdAt: now,
    updatedAt: now,
  }],
};

execFileSync("sqlite3", [dbPath], {
  input: fs.readFileSync(schemaPath, "utf8"),
  encoding: "utf8",
});
execFileSync("sqlite3", [dbPath], {
  input: buildSeedSql(store),
  encoding: "utf8",
});

const tasks = JSON.parse(execFileSync("sqlite3", [
  "-json",
  dbPath,
  "SELECT id, document_id FROM model_geometry_extraction_tasks ORDER BY id;",
], { encoding: "utf8" }));
const folderCount = Number(execFileSync("sqlite3", [dbPath, "SELECT count(*) FROM folders;"], { encoding: "utf8" }).trim());
const memberCount = Number(execFileSync("sqlite3", [dbPath, "SELECT count(*) FROM project_members;"], { encoding: "utf8" }).trim());
const foreignKeyCheck = execFileSync("sqlite3", [dbPath, "PRAGMA foreign_key_check;"], { encoding: "utf8" }).trim();

assert.deepEqual(tasks, [{ id: "task-valid", document_id: "doc-1" }]);
assert.equal(folderCount, 3);
assert.equal(memberCount, 2);
assert.equal(foreignKeyCheck, "");

fs.rmSync(tempDir, { recursive: true, force: true });
console.log("migrate json store orphan test passed");
