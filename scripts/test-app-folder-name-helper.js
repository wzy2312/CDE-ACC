const fs = require("node:fs");
const path = require("node:path");

const appPath = path.join(process.cwd(), "app.js");
const source = fs.readFileSync(appPath, "utf8");

if (!/function folderName\s*\(/.test(source)) {
  throw new Error("app.js is missing folderName() helper");
}

const uses = source.match(/folderName\(/g) || [];
if (uses.length < 2) {
  throw new Error(`Expected folderName() to be used in app.js, found ${uses.length} reference(s)`);
}

console.log(`app folderName helper smoke passed: ${uses.length} references`);
