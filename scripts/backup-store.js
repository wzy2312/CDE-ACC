const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataDir = path.resolve(process.env.CDE_DATA_DIR || path.join(root, "data"));
const backupDir = path.resolve(process.env.CDE_BACKUP_DIR || path.join(dataDir, "backups"));
const storePath = path.join(dataDir, "documents.json");
const uploadsDir = path.join(dataDir, "uploads");
const exportsDir = path.join(dataDir, "exports");
const attachmentsDir = path.join(dataDir, "attachments");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function copyDirIfExists(source, target) {
  if (fs.existsSync(source)) {
    fs.cpSync(source, target, { recursive: true });
  }
}

function main() {
  if (!fs.existsSync(storePath)) {
    throw new Error(`Store not found: ${storePath}`);
  }
  const id = timestamp();
  const target = path.join(backupDir, id);
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(storePath, path.join(target, "documents.json"));
  copyDirIfExists(uploadsDir, path.join(target, "uploads"));
  copyDirIfExists(exportsDir, path.join(target, "exports"));
  copyDirIfExists(attachmentsDir, path.join(target, "attachments"));
  fs.writeFileSync(path.join(target, "manifest.json"), JSON.stringify({ id, createdAt: new Date().toISOString(), dataDir, files: ["documents.json", "uploads", "exports", "attachments"] }, null, 2));
  console.log(`backup created: ${target}`);
}

main();
