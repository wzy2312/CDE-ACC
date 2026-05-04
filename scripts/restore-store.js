const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataDir = path.resolve(process.env.CDE_DATA_DIR || path.join(root, "data"));
const backupPath = process.argv[2] ? path.resolve(process.argv[2]) : "";

function copyDirIfExists(source, target) {
  if (fs.existsSync(source)) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(source, target, { recursive: true });
  }
}

function main() {
  if (!backupPath) {
    throw new Error("Usage: node scripts/restore-store.js <backup-directory>");
  }
  const storePath = path.join(backupPath, "documents.json");
  if (!fs.existsSync(storePath)) {
    throw new Error(`Backup store not found: ${storePath}`);
  }
  fs.mkdirSync(dataDir, { recursive: true });
  fs.copyFileSync(storePath, path.join(dataDir, "documents.json"));
  copyDirIfExists(path.join(backupPath, "uploads"), path.join(dataDir, "uploads"));
  copyDirIfExists(path.join(backupPath, "exports"), path.join(dataDir, "exports"));
  copyDirIfExists(path.join(backupPath, "attachments"), path.join(dataDir, "attachments"));
  console.log(`backup restored to: ${dataDir}`);
}

main();
