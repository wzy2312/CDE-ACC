const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(process.cwd(), "server.js"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  source.includes('const HOST = String(process.env.HOST || process.env.CDE_HOST || "0.0.0.0").trim() || "0.0.0.0";'),
  "server.js must bind HOST from env with 0.0.0.0 fallback",
);
assert(
  source.includes('if (pathname === "/auth-bootstrap.js") {'),
  "server.js must serve /auth-bootstrap.js",
);
assert(
  source.includes('if (pathname === "/styles-critical.css") {'),
  "server.js must serve /styles-critical.css",
);
assert(
  source.includes('server.listen(PORT, HOST, () => {'),
  "server.js must listen on HOST instead of hardcoded 127.0.0.1",
);
assert(
  source.includes('pathname.match(/^\\/api\\/workflows\\/([^/]+)\\/report-export$/)'),
  "server.js must expose the workflow report export route",
);
assert(
  source.includes("function resolveWorkflowExportDestination("),
  "server.js must define resolveWorkflowExportDestination()",
);
assert(
  source.includes("function prependWorkflowExportFile("),
  "server.js must define prependWorkflowExportFile()",
);

console.log("server runtime contract smoke passed");
