const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const clientFiles = [
  "app.js",
  "auth-bootstrap.js",
  "invite.html",
  "onlyoffice.html",
  "drawingviewer.html",
  "apsviewer.js",
  "pdf-runtime.js",
];

for (const file of clientFiles) {
  const source = read(file);
  assert(
    !source.includes("payload.error ||"),
    `${file} must not surface raw backend payload.error strings to English users`,
  );
  assert(
    !source.includes("X-CDE-Language"),
    `${file} must not add broad custom language headers to session/viewer requests; export language travels in request bodies`,
  );
}

const pdfRuntime = read("pdf-runtime.js");
assert(
  pdfRuntime.includes("const STANDALONE_EN_TEXT = {"),
  "pdf-runtime.js must define a standalone English dictionary",
);
assert(
  pdfRuntime.includes("function localizeStandaloneText("),
  "pdf-runtime.js must localize standalone PDF text in English mode",
);
assert(
  pdfRuntime.includes("function localizeUserMessage("),
  "pdf-runtime.js must sanitize backend/runtime messages before showing them",
);
assert(
  /function showState\([^)]*\) \{[\s\S]*localizeStandaloneText\(title\)[\s\S]*localizeStandaloneText\(message\)/.test(pdfRuntime),
  "pdf-runtime.js showState() must localize state title and message",
);
assert(
  /function notify\([^)]*\) \{[\s\S]*localizeUserMessage\(message/.test(pdfRuntime),
  "pdf-runtime.js notify() must sanitize toast text",
);
assert(
  pdfRuntime.includes('date.toLocaleString(currentLanguage() === "en" ? "en-US" : "zh-CN"'),
  "pdf-runtime.js must format dates using the active language",
);

const standaloneErrorFiles = ["auth-bootstrap.js", "invite.html", "onlyoffice.html", "drawingviewer.html", "apsviewer.js", "pdf-runtime.js"];
for (const file of standaloneErrorFiles) {
  const source = read(file);
  assert(
    source.includes("localizeUserMessage("),
    `${file} must define or use localizeUserMessage() for API/runtime failures`,
  );
}

const drawingViewer = read("drawingviewer.html");
assert(
  /const payload = await response\.json\(\)\.catch\(\(\) => \(\{\}\)\);[\s\S]*localizeUserMessage\(serverMessage/.test(drawingViewer),
  "drawingviewer.html must sanitize server error payloads before rendering them",
);

const app = read("app.js");
assert(
  app.includes("language: currentLanguage()"),
  "app.js export calls must pass the active language explicitly in the export request body",
);

const apsViewer = read("apsviewer.js");
assert(
  /function updateOverlay\([^)]*\) \{[\s\S]*dom\.stateMessage\.textContent = localizeStandaloneText\(message\);/.test(apsViewer),
  "apsviewer.js updateOverlay() must translate normal state text without replacing it with an error fallback",
);
assert(
  apsViewer.includes("localizeUserMessage(error.message, t(\"未知错误，请稍后重试。\", \"Unknown error. Please try again later.\"))"),
  "apsviewer.js boot errors must still sanitize thrown runtime messages",
);

const server = read("server.js");
assert(
  server.includes("function requestLanguage("),
  "server.js must resolve the requested UI/report language",
);
assert(
  server.includes("CDE_REPORT_LANGUAGE"),
  "server.js must pass CDE_REPORT_LANGUAGE to report export scripts",
);

const reportScripts = [
  "export_comment_report.py",
  "export_workflow_comment_report.py",
  "export_review_pdf.py",
  "export_workflow_report.py",
  "export_quantity_takeoff.py",
  "export_construction_schedule.py",
  "export_drawing_precheck_report.py",
  "export_drawing_redline_report.py",
  "export_drawing_register.py",
  "export_model_clash_heatmap.py",
];

for (const file of reportScripts) {
  const source = read(file);
  assert(
    source.includes("report_i18n"),
    `${file} must opt into report_i18n so generated files can be English`,
  );
}

const reportProbe = spawnSync(
  "python3",
  [
    "-c",
    `
import re
from report_i18n import localize_text

samples = [
    "P6 项目：P6DEMO",
    "评论清单已汇总 PDF/系统批注、回复、备注、流程审批意见和 Office 原生评论。",
    "当前状态：已解决",
    "发起者：系统",
    "初审人：未命名审批人",
    "未关联文件",
    "已生成批注 issue-1",
    "Issue 联动",
    "模型：未命名模型",
    "图纸名称：未命名图纸",
    "热力图 H1 · 网格 2m",
]

for sample in samples:
    translated = localize_text(sample)
    if re.search(r"[\\u4e00-\\u9fff]", translated):
        raise SystemExit(f"{sample} -> {translated}")
`,
  ],
  {
    cwd: root,
    env: { ...process.env, CDE_REPORT_LANGUAGE: "en" },
    encoding: "utf8",
  },
);
assert(
  reportProbe.status === 0,
  `report_i18n.py must localize representative generated report labels without CJK remnants: ${reportProbe.stderr || reportProbe.stdout}`,
);

console.log("i18n overseas readiness smoke passed");
