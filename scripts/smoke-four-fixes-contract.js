const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");
const server = fs.readFileSync("server.js", "utf8");
const overflowShell = app.match(/function renderOverflowMenuShell[\s\S]*?\n\}/)?.[0] || "";
const batchMove = app.match(/async function batchMoveSelectedDocuments\(\)[\s\S]*?\n\}/)?.[0] || "";
const checks = [
  ["row menu portal rendered at document.body", /row-action-menu-portal/.test(app) && /document\.body\.appendChild\(menu\)/.test(app) && /routeRowActionPortalClick/.test(app)],
  ["outside click allows row action portal", /closest\("\.row-action-menu-portal"\)/.test(app)],
  ["row overflow shell does not render clipped inline menu", /void menuHtml/.test(overflowShell) && !/\$\{menuHtml\}/.test(overflowShell)],
  ["batch move uses folder picker instead of prompt", /function folderPickerAction/.test(app) && /folderPickerAction/.test(batchMove) && !/promptAction/.test(batchMove)],
  ["batch download zip has no external /usr/bin/zip", !server.includes('spawn("/usr/bin/zip"') && /async function zipDirectory/.test(server) && /ZIP_CRC32_TABLE/.test(server)],
  ["share expiry defaults to env-adjustable 30 days", /CDE_SHARE_DEFAULT_EXPIRY_DAYS/.test(server) && /30/.test(server.match(/function defaultShareExpiryDate\(\)[\s\S]{0,500}/)?.[0] || "")],
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
