const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(process.cwd(), "server.js"), "utf8");
const dockerfile = fs.readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const pythonResolverSource = source.match(/function resolvePythonBin\(\) \{[\s\S]*?\n\}/)?.[0] || "";

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
  source.indexOf("servePublicAssetRequest(pathname, req, res)") > 0 &&
    source.indexOf("servePublicAssetRequest(pathname, req, res)") < source.indexOf("await settleDocumentParsingStates();"),
  "server.js must serve public shell assets before document parsing settlement",
);
assert(
  source.indexOf('if (pathname === "/api/session" && req.method === "GET")') > 0 &&
    source.indexOf('if (pathname === "/api/session" && req.method === "GET")') < source.indexOf("await settleDocumentParsingStates();"),
  "server.js must answer GET /api/session before document parsing settlement",
);
assert(
  source.includes("function parseCookieValues(") &&
    source.includes("const sessionIds = parseCookieValues(req, SESSION_COOKIE_NAME)") &&
    source.includes("for (const candidateSessionId of sessionIds)"),
  "server.js must scan duplicate cde_session cookies and select a valid active session",
);
assert(
  source.includes("const compressedFileCache = new Map();") &&
    source.includes("function compressedFileCacheKey(") &&
    source.includes("compressedFileCache.set(cacheKey"),
  "server.js must cache compressed static files instead of recompressing app.js on every refresh",
);
assert(
  source.includes("function cacheControlForFileRequest(") &&
    source.includes('url.searchParams.has("v")') &&
    source.includes('"public, max-age=31536000, immutable"'),
  "server.js must allow immutable browser caching for versioned JS/CSS assets",
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
  !source.includes("/Users/zhiyuan/.cache/codex-runtimes"),
  "server.js must not hardcode Codex runtime paths for production",
);
assert(
  source.includes('process.env.CDE_PYTHON_BIN') && source.includes('"python3"'),
  "server.js must resolve PYTHON_BIN from env with python3 fallback",
);
assert(
  pythonResolverSource && !pythonResolverSource.includes("codex-runtimes") && !pythonResolverSource.includes("codex-primary-runtime"),
  "server.js must not default PYTHON_BIN to a Codex bundled runtime",
);
assert(
  source.includes('process.env.CDE_PDFJS_DIR') && source.includes('path.join(ROOT, "node_modules", "pdfjs-dist", "build")'),
  "server.js must resolve PDFJS_DIR from env or app node_modules",
);
assert(
  packageJson.dependencies && packageJson.dependencies["pdfjs-dist"],
  "package.json must declare pdfjs-dist because /vendor/pdfjs serves it from node_modules",
);
assert(
  source.includes("function storageBucketHealthOk(") && source.includes("bucketHealth.exists !== false"),
  "server.js must accept S3 storage health objects without an exists field",
);
assert(
  source.includes("storageBucketHealthOk(data.uploadsDir)") &&
    source.includes("storageBucketHealthOk(data.exportsDir)") &&
    source.includes("storageBucketHealthOk(data.attachmentsDir)"),
  "server.js health summary must use storageBucketHealthOk() for all storage buckets",
);
assert(
  /apk add --no-cache[^\n]*\bsqlite\b/.test(dockerfile),
  "Dockerfile must install sqlite so CDE_STORE_ADAPTER=sqlite works in production",
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
