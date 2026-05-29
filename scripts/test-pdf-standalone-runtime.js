const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const runtime = fs.readFileSync(path.join(root, "pdf-runtime.js"), "utf8");
const html = fs.readFileSync(path.join(root, "pdf.html"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  pkg.dependencies && pkg.dependencies["@embedpdf/snippet"],
  "pdf standalone must depend on @embedpdf/snippet for the native PDF viewer",
);
assert(
  runtime.includes('from "/vendor/embedpdf/embedpdf.js"') && runtime.includes("EmbedPDF.init"),
  "pdf runtime must initialize EmbedPDF from the locally served snippet bundle",
);
assert(
  runtime.includes('const EMBEDPDF_WASM_PATH = "/vendor/embedpdf/pdfium.wasm"') &&
    runtime.includes("wasmUrl: localEmbedPdfAssetUrl(EMBEDPDF_WASM_PATH)") &&
    runtime.includes("function localEmbedPdfAssetUrl("),
  "pdf runtime must point EmbedPDF at the locally served PDFium wasm asset with an absolute URL for blob workers",
);
assert(
  !runtime.includes("from \"/vendor/pdfjs/pdf.mjs\"") && !html.includes("pdfCanvas") && !html.includes("annotationLayer"),
  "pdf standalone must remove the hand-built pdf.js canvas and annotation layer",
);
assert(
  html.includes('id="embedPdfViewer"') &&
    html.includes('id="cdeAnnotationSidebarShell"') &&
    html.includes('id="cdeReviewPanelShell"') &&
    html.includes('data-cde-panel-tab="annotations"'),
  "pdf html must host the native EmbedPDF viewer and CDE shells that mount into native sidebars",
);
assert(
  html.includes(".workspace {\n        position: relative;\n        min-height: 0;\n        padding: 0;") &&
    html.includes("border: 0;") &&
    html.includes("border-radius: 0;") &&
    html.includes("box-shadow: none;"),
  "pdf html must let the native viewer sit flush with the workspace without the rejected outer gutter",
);
assert(
  html.includes(".cde-annotation-sidebar .item-list {\n        align-content: start;\n        grid-auto-rows: max-content;") &&
    runtime.includes(".cde-annotation-sidebar .item-list {\n    align-content: start;\n    grid-auto-rows: max-content;"),
  "pdf annotation sidebar list rows must stay content-height instead of stretching one annotation to fill the native sidebar",
);
assert(
  !html.includes('id="cdeAnnotationRail"') &&
    !html.includes('class="annotation-rail"') &&
    !html.includes('id="cdeNativePanel"') &&
    !html.includes('id="cdeDockCollapseButton"') &&
    !html.includes('id="cdeDockRestoreButton"'),
  "pdf html must not keep the rejected outer annotation rail or outer CDE dock controls",
);
assert(
  runtime.includes("registerCdeCommands") &&
    runtime.includes("custom.cde.export-reviewed") &&
    runtime.includes("custom.cde.comment-report") &&
    runtime.includes("custom.cde.toggle-review-panel") &&
    runtime.includes('"panel:toggle-comment"') &&
    !runtime.includes('{ type: "command-button", id: "cde-comment-report"') &&
    !runtime.includes('{ type: "command-button", id: "cde-export-reviewed"') &&
    !runtime.includes('"custom.cde.annotations-panel"') &&
    !runtime.includes('"custom.cde.comments-panel"') &&
    !runtime.includes('"custom.cde.workflow-panel"') &&
    !runtime.includes('id: "cde-annotations"') &&
    !runtime.includes('id: "cde-comments"') &&
    !runtime.includes('id: "cde-workflow"'),
  "pdf runtime must register export and right-sidebar toggle actions without the three CDE toolbar panel entries",
);
assert(
  html.includes('id="commentReportButton"') &&
    html.includes('id="exportButton"') &&
    runtime.includes('commentReportButton: el("commentReportButton")') &&
    runtime.includes('exportButton: el("exportButton")') &&
    runtime.includes('elements.commentReportButton?.addEventListener("click", () => void exportCommentReport())') &&
    runtime.includes('elements.exportButton?.addEventListener("click", () => void exportReviewedPdf())'),
  "pdf standalone must place export buttons in the top CDE header rather than the native EmbedPDF toolbar",
);
assert(
  runtime.includes('const CDE_LEFT_SIDEBAR_ID = "sidebar-panel"') &&
    runtime.includes('const CDE_ANNOTATION_TAB_ID = "outline"') &&
    runtime.includes('const CDE_REVIEW_SIDEBAR_ID = "cde-review-panel"') &&
    runtime.includes('const CDE_LEFT_SIDEBAR_WIDTH = "320px"') &&
    runtime.includes('const CDE_REVIEW_SIDEBAR_WIDTH = "320px"') &&
    runtime.includes("mergeCdeSidebarSchema") &&
    runtime.includes("mountCdeNativePanels") &&
    runtime.includes("mountCdeAnnotationIntoNativeOutline") &&
    runtime.includes("findNativeLeftSidebarBody") &&
    runtime.includes("activateNativeOutlineTab") &&
    runtime.includes("state.nativeLeftOutlineActivated") &&
    runtime.includes(`defaultTab: CDE_ANNOTATION_TAB_ID`) &&
    runtime.includes("scope.setSidebarTab(CDE_LEFT_SIDEBAR_ID, CDE_ANNOTATION_TAB_ID)") &&
    runtime.includes("installCdeNativePanelStyles") &&
    runtime.includes("MutationObserver") &&
    runtime.includes('setActiveSidebar("left", "main", CDE_LEFT_SIDEBAR_ID, CDE_ANNOTATION_TAB_ID') &&
    runtime.includes('setActiveSidebar("right", "main", CDE_REVIEW_SIDEBAR_ID'),
  "pdf runtime must mount CDE annotations into the native Outline tab while preserving native thumbnails, and mount review shell into the right native sidebar",
);
assert(
  runtime.includes('[data-epdf-i="main-toolbar"] > [data-epdf-i="mode-tabs"]') &&
    runtime.includes("transform: translate(-50%, -50%)"),
  "pdf runtime must visually center the native mode tab group in the main toolbar on desktop",
);
assert(
  !runtime.includes("mountCdeShell(leftHost, elements.cdeAnnotationSidebarShell)") &&
    runtime.includes("mountCdeReviewIntoNativeSidebar(activeHost)") &&
    runtime.includes("mountCdeShell(body || activeHost, shell)") &&
    runtime.includes('host.replaceChildren(shell);'),
  "pdf runtime must not replace the entire native left sidebar because that removes EmbedPDF thumbnails",
);
assert(
  runtime.includes("wireNativeAnnotationEvents") &&
    runtime.includes("onAnnotationEvent") &&
    runtime.includes("onStateChange") &&
    runtime.includes("syncNativeAnnotationEvent") &&
    runtime.includes("syncCdeSelectionFromNative") &&
    runtime.includes("selectNativeAnnotationForCde") &&
    runtime.includes("syncNativeAnnotationFromCde") &&
    runtime.includes("deleteNativeAnnotationForCde") &&
    runtime.includes("syncCdeAnnotationsToNativeLayer") &&
    runtime.includes("annotationApi.importAnnotations") &&
    runtime.includes("annotationApi.selectAnnotation") &&
    runtime.includes("annotationApi.updateAnnotation") &&
    runtime.includes("annotationApi.deleteAnnotation"),
  "pdf runtime must bridge EmbedPDF native annotation selection, create/update/delete, and legacy CDE annotations bidirectionally",
);
assert(
  runtime.includes("item?.object || item?.annotation || item || null"),
  "pdf runtime must unwrap EmbedPDF tracked annotations from the `.object` field so native canvas selection maps back to CDE records",
);
assert(
  runtime.includes("wireNativeAnnotationEvents();\n  scheduleCdeNativeAnnotationSync();"),
  "pdf runtime must schedule legacy CDE annotation import after the EmbedPDF annotation plugin is available",
);
assert(
  runtime.includes('if (event.type === "create" && !canCreateAnnotation())') &&
    !runtime.includes("if (!state.document || readOnlyMode() || !canCreateAnnotation())"),
  "pdf runtime must not block native update/delete synchronization just because the user lacks create permission",
);
assert(
  runtime.includes('deleteAnnotation(existing, { skipConfirm: true, quiet: true, skipNative: true })') &&
    runtime.includes("!options.skipNative"),
  "pdf runtime must avoid echo-deleting a native annotation after the native canvas already emitted a delete event",
);
assert(
  runtime.includes("syncAnnotationDraftFromInputs") &&
    runtime.includes('elements.annotationTitleInput?.addEventListener("input", syncAnnotationDraftFromInputs)') &&
    runtime.includes('elements.annotationDetailInput?.addEventListener("input", syncAnnotationDraftFromInputs)') &&
    runtime.includes("displayAnnotation(annotation)") &&
    runtime.includes("clearAnnotationDraft(annotation.id)"),
  "pdf runtime must keep left annotation cards and right detail inputs in sync while editing text",
);
assert(
  !html.includes('id="nativeSidebarButton"') &&
    !html.includes('id="nativeCommentButton"') &&
    !html.includes('id="cdePanelToggleButton"') &&
    !runtime.includes("initializeResponsiveDock") &&
    !runtime.includes("panel-collapsed"),
  "pdf standalone must remove duplicated topbar PDF controls and rejected outer dock collapse state",
);
assert(
  runtime.includes('const CDE_SEARCH_SIDEBAR_ID = "search-panel"') &&
    runtime.includes("mountCdeReviewIntoNativeSidebar") &&
    runtime.includes("releaseCdeReviewSidebarShell") &&
    runtime.includes('shell.closest("[data-sidebar-id]")') &&
    runtime.includes('activeHost.getAttribute("data-sidebar-id")') &&
    runtime.includes('elements.cdeNativePanels?.append(shell)'),
  "pdf runtime must release the CDE review shell when native Search owns the right sidebar slot",
);
assert(
  runtime.includes("renderWorkflowPanel") &&
    runtime.includes("runWorkflowAction") &&
    runtime.includes("/api/workflows") &&
    runtime.includes("/api/documents/${encodeURIComponent(state.document.id)}/actions"),
  "pdf runtime must preserve workflow launch, action, step, and activity handling",
);
assert(
  server.includes('pathname.startsWith("/vendor/embedpdf/")') &&
    server.includes('"node_modules", "@embedpdf", "snippet", "dist"'),
  "server must serve local EmbedPDF assets for the standalone page",
);

console.log("pdf standalone EmbedPDF contract smoke passed");
