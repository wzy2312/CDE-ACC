const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(process.cwd(), "app.js"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  source.includes('const WORKSPACE_RESTORE_STORAGE_KEY = "cde.workspaceRestore.v1";'),
  "app.js must define a workspace restore storage key",
);
assert(
  source.includes("function readWorkspaceRestoreState("),
  "app.js must read saved workspace restore state",
);
assert(
  source.includes("function restoreWorkspaceStateAfterDataLoad("),
  "app.js must restore workspace state after documents/workflows load",
);
assert(
  !source.includes("safeText("),
  "app.js workspace restore must not call server-only safeText() in the browser",
);
assert(
  source.includes("function persistWorkspaceRestoreState("),
  "app.js must persist current workspace state for refresh restore",
);
assert(
  source.includes("restoreWorkspaceStateAfterDataLoad();") &&
    source.indexOf("restoreWorkspaceStateAfterDataLoad();") < source.indexOf("if (!state.selectedId && state.documents[0])"),
  "workspace state must be restored before default document selection",
);
assert(
  source.includes('elements.workspace?.addEventListener("scroll", handleWorkspaceScrollState'),
  "workspace scroll must persist restore state",
);

console.log("workspace restore state contract passed");
