const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(21080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 2500;
const BOOTSTRAP_PASSWORD = "cde@123456";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, pathname, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      `${BASE_URL}${pathname}`,
      {
        method,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          let json = null;
          if (responseBody) {
            try {
              json = JSON.parse(responseBody);
            } catch {
              json = null;
            }
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: responseBody, json });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${method} ${pathname}`));
    });
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function waitForServer(child) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await request("GET", "/healthz");
      if (response.statusCode === 200) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(150);
  }

  throw new Error(`Timed out waiting for ${BASE_URL}/healthz: ${lastError?.message || "no response"}`);
}

function assertStatus(response, expected, label) {
  if (response.statusCode !== expected) {
    throw new Error(`${label} expected ${expected}, received ${response.statusCode}: ${response.body.slice(0, 160)}`);
  }
  return response;
}

function assertIncludes(body, snippets, label) {
  for (const snippet of snippets) {
    if (!body.includes(snippet)) {
      throw new Error(`${label} is missing expected snippet: ${snippet}`);
    }
  }
}

function assertExcludes(body, snippets, label) {
  for (const snippet of snippets) {
    if (body.includes(snippet)) {
      throw new Error(`${label} still contains deprecated snippet: ${snippet}`);
    }
  }
}

function sessionCookie(response) {
  const cookies = response.headers["set-cookie"] || [];
  const session = cookies.find((item) => item.startsWith("cde_session="));
  if (!session) {
    throw new Error("Login response did not set cde_session cookie");
  }
  return session.split(";")[0];
}

async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  const timeout = setTimeout(() => {
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  }, 2000);

  try {
    await once(child, "exit");
  } finally {
    clearTimeout(timeout);
  }
}

async function runFrontendScenario() {
  const index = assertStatus(await request("GET", "/"), 200, "index page");
  assertIncludes(
    index.body,
    [
      "CDE文件管理系统",
      'id="loginForm"',
      'id="loginEmailInput"',
      'data-view="files"',
      'data-view="workflow"',
      'data-view="drawing-apps"',
      'data-view="model-apps"',
      'data-view="project-settings"',
      'id="openSystemSettingsButton"',
      "平台管理",
      'id="drawingAppsPanel"',
      'id="drawingSmartReviewGuide"',
      'id="drawingRegisterWorkbench"',
      'id="modelAppsPanel"',
      'data-model-app-tool="quantity"',
      'data-model-app-tool="health"',
      'data-model-app-tool="diff"',
      'data-model-app-tool="schedule"',
      'id="scheduleModelPicker"',
      'id="scheduleModelList"',
      'id="scheduleXerFileInput"',
      'id="scheduleDocumentSelect"',
      'id="schedulePreviewButton"',
      'id="scheduleOpenViewerButton"',
      "施工进度可视化",
      "4D 进度联动",
      "选择施工进度模型",
      "解析预览",
      "时间轴与 Viewer",
	      'id="quantityModelPicker"',
	      'id="quantityModelList"',
	      'id="quantityFilterBuilder"',
	      'id="quantityScanFieldsButton"',
	      'id="quantityPropertyDictionaryPanel"',
	      "字段覆盖率预扫描",
      'id="modelHealthModelPicker"',
      'id="modelHealthModelList"',
      'id="modelHealthRulesetSelect"',
      'id="modelHealthTemplateSummaryPanel"',
      'id="modelHealthTemplateSummaryGrid"',
      'id="modelHealthTemplateDisciplineSummary"',
      'id="modelHealthTemplateAiSummary"',
      'id="modelHealthTemplateNotes"',
      'id="modelHealthRunButton"',
      'id="modelHealthIssueList"',
      "审批前置健康度门控",
      "模板概要",
      "规则引擎结果",
      "AI 异常识别结果",
      "选择工程量统计模型",
      "对象属性批量提取 + 工程量统计",
      "模型健康度检查",
      "按模型属性筛选",
      "这些条件会写入下一次属性提取任务",
      'data-access-menu="aps_configuration"',
      'id="accessApsConfigurationView"',
      'data-access-scope="system"',
      'data-access-menu="project_management"',
      "系统级设置",
      "当前项目设置",
      "权限模型",
      "项目库管理",
      "平台级项目库",
      "项目设置",
      'id="systemApsClientIdInput"',
      'id="saveSystemApsConfigButton"',
      "AI配置",
      "启用AI",
      "调用量",
      "未通过测试不能启用AI",
      'id="testSystemAiConfigButton"',
      '图纸智能审查',
      '图纸目录',
      '目录与打印包',
      'id="drawingSpecCheckWorkbench"',
      'Drawing-Spec Check',
      'Spec Register',
      'Specification Maintenance',
      'data-drawing-spec-upload-field="file"',
      'data-drawing-spec-action="open-upload"',
      'data-drawing-spec-action="upload-spec"',
      'data-drawing-spec-action="start-check"',
      'Select Specification',
      'Select Drawing',
      'Comparison Results',
      '图纸版本红线对比',
      'id="redlineCompareWorkbench"',
      '运行智能审查',
      '审批前置门控',
      '模型差异对比',
      'id="modelDiffGuide"',
      'id="modelDiffModelList"',
      'id="modelDiffVersionASelect"',
      'id="modelDiffVersionBSelect"',
      'id="modelDiffBulkIssueButton"',
      'id="modelDiffOnlyDifferencesToggle"',
      'id="uploadButton"',
      'id="uploadDrawingMetadataModal"',
      'id="libraryDrawingMetadataCard"',
      'id="libraryDrawingNumberInput"',
      'id="libraryDrawingNameInput"',
      'id="libraryDrawingDisciplineSelect"',
      'id="libraryDrawingRevisionInput"',
      "标记为图纸",
      "图纸编号",
      "关联图纸",
      "选择已有图纸",
      'id="workflowSummaryStrip"',
      'id="notificationToggleButton"',
      'id="notificationPanel"',
      'id="launchFlowModal"',
    ],
    "index page",
  );
  assertExcludes(
    index.body,
    [
      "workflow-template-step-card",
    ],
    "workflow template manager should not use old rounded step cards",
  );
  assertExcludes(
    index.body,
    [
      'id="modelAppModelPicker"',
      'id="modelAppModelList"',
      "先选择模型，再进入模型应用",
      'data-model-app-requires-model="true"',
      "Level 01, Level 02",
      "Architecture, MEP",
      "Walls, Pipes",
      "类型 / 楼层",
      'id="quantityFloorFilterInput"',
      'id="quantityDisciplineFilterInput"',
      'id="quantityTypeFilterInput"',
      'id="quantityMaterialFilterInput"',
      'id="modelHealthTemplateConfigPanel"',
      'id="modelHealthRulesetNameInput"',
      'id="modelHealthRequiredFieldsInput"',
      'id="modelHealthSaveRulesetButton"',
      'data-view="access"',
    ],
    "index page",
  );

  const styles = assertStatus(await request("GET", "/styles.css"), 200, "styles.css");
  assertIncludes(styles.body, ["auth-shell", "sidebar", "workflow", "review", "drawing-apps", "model-apps", "@media"], "styles.css");
  assertIncludes(
    styles.body,
    [
      ".workflow-template-editor .workflow-selector-shell",
      ".workflow-template-editor .workflow-template-autoexport-summary",
      ".workflow-template-editor .workflow-option-button",
    ],
    "workflow template manager must flatten old rounded-card controls",
  );
  assertExcludes(
    styles.body,
    [
      ".content-grid.files-only .file-row:hover:not(.selected):not(.menu-open):not(.editing):not(:focus-within) .row-actions",
    ],
    "file row hover quick actions",
  );

  const app = assertStatus(await request("GET", "/app.js"), 200, "app.js");
  assertIncludes(app.body, ["/api/session/login", "/api/notifications", "/api/model-apps/clash/run", "/api/model-apps/health", "/api/model-apps/health/run", "renderModelHealthTemplateSummary", "modelHealthTemplateProfile", "/api/model-apps/quantity/compare", "property-dictionary", "scanQuantityPropertyDictionary", "data-quantity-task-action", "/api/model-apps/diff", "/api/model-apps/diff/run", "renderModelDiffWorkbench", "runModelDiffFromSelection", "modelDiffVersionReadiness", "createIssueFromModelDiff", "createBulkIssuesFromModelDiff", "modelDiffOnlyDifferences", "modelDiffViewerMode", "modelDiffViewMode", "/api/model-apps/schedule", "renderConstructionScheduleWorkbench", "readConstructionScheduleXerFile", "previewConstructionScheduleXer", "autoMapConstructionSchedule", "openConstructionScheduleViewer", "createIssueFromConstructionScheduleAlert", "/api/drawing-apps/register", "/api/drawing-apps/register/export", "/api/drawing-apps/register/expected", "/consistency/confirm", "/api/drawing-apps/packages", "/publish", "/recipients/", "/ack", "/api/drawing-apps/spec-check", "/api/drawing-apps/spec-check/specs", "/api/drawing-apps/spec-check/compare", "/api/drawing-apps/redline", "/api/drawing-apps/redline/run", "renderDrawingRedlineWorkbench", "runDrawingRedlineComparison", "createDrawingRedlineIssue", "exportDrawingRedlineReport", "data-drawing-redline-action=\"export-report\"", "差异图层透明度", "只看差异区域", "红线对比任务", "renderDrawingSpecCheckWorkbench", "refreshDrawingSpecCheckData", "createDrawingSpecCheckIssue", "data-drawing-spec-action=\"compare\"", "/api/system/aps-settings", "renderModelAppsPanel", "modelClashDocuments", "runModelClashDetectionFromSelection", "refreshModelHealthData", "runModelHealthCheckFromSelection", "renderModelHealthWorkbench", "modelHealthActiveTask", "apsConfiguration", "saveSystemApsConfigurationAction", "quantityApsConfigurationReady", "renderQuantityTakeoffPanel", "quantityDocumentSelect", "QUANTITY_FILTER_DEFINITIONS", "renderQuantityFilterBuilder", "data-quantity-filter-action", "取水泵房", "RO膜壳", "inferDrawingMetadataFromFileName", "drawingMetadata", "precheckGate", "drawingSmartReviewGateMeta", "existingDrawingRelationOptions", "data-upload-drawing-related-select", "renderDrawingAppsPanel", "renderDrawingRegisterWorkbench", "refreshDrawingRegisterData", "editDrawingExpectedList", "confirmDrawingRegisterConsistency", "renderDrawingRegisterSourceCell", "drawingRegisterAutoAggregationCount", "publishDrawingPackage", "ackDrawingPackageRecipient", "createDrawingPackageFromRegister", "data-drawing-register-action=\"confirm-consistency\"", "data-drawing-register-action=\"publish-package\"", "data-drawing-register-action=\"ack-package\"", "自动归集", "归集来源", "文件名识别", "导出目录", "创建打印包", "格式一致性", "预检查", "签收完成", "refreshDocuments", "renderWorkflow", "exportReviewedFile", "预审工作台", "预审运行记录", "报告归档", "Issue 联动", "手动生成 Issue", "导出预审报告", "data-drawing-smart-action=\"open-issue\"", "data-drawing-smart-action=\"create-issue\"", "data-drawing-smart-action=\"export-report\"", "drawingSmartReviewActiveTaskId", "promptAction(text(\"请输入处理说明"], "app.js");
  assertIncludes(
    app.body,
    [
      "RESUMABLE_UPLOAD_DRAFTS_STORAGE_KEY",
      "createUploadFingerprint",
      "persistResumableUploadDrafts",
      "hydrateResumableUploadSessions",
      "data-upload-resume",
      "resumeUploadTaskWithFile",
    ],
    "frontend resumable upload recovery contract",
  );
  assertIncludes(
    app.body,
    [
      "WORKFLOW_STARTER_ROLE_VALUES",
      "WORKFLOW_APPROVER_ROLE_VALUES",
      "workflowRoleOptionWithMemberCounts",
      "workflowStarterRoleOptions",
      "workflowApproverRoleOptions",
    ],
    "workflow template role binding contract",
  );
  assertExcludes(
    app.body,
    [
      "const allowedRoleOptions = accessRoleOptions().filter((option) => option.value !== \"guest\")",
      "return accessRoleOptions().filter((option) => option.value !== \"guest\");",
    ],
    "workflow template roles must align with actual workflow permissions",
  );
  assertIncludes(
    app.body,
    [
      '["project_management", text("项目库管理", "Project Registry")]',
      "function accessMenuTitle",
      'setHeaderBreadcrumb([headerRootLabel(), text("系统设置", "System Settings"), accessTitle]);',
      'setHeaderBreadcrumb([headerRootLabel(), text("项目设置", "Project Settings"), accessTitle]);',
      'openProjectSettingsView',
      'function canOpenSystemSettings()',
      'elements.openSystemSettingsButton.classList.toggle("hidden", !canOpenSystemSettings())',
      'state.accessMenu = "project_management"',
      'state.currentView === "project-settings"',
      'text("平台级项目库", "Platform Project Registry")',
      'text("跨项目创建、编辑和初始化项目。", "Create, edit, and initialize projects across the platform.")',
      'text("当前项目设置", "Current Project Settings")',
      'text("系统级设置", "System-Level Settings")',
    ],
    "system settings information architecture contract",
  );
  assertIncludes(
    app.body,
    [
      "drawing-register-compact-header",
      "drawing-register-overview-card",
      "drawing-register-main-grid",
      "drawing-register-table-shell",
      "drawing-register-quality-list",
      "drawing-register-side-rail",
      "drawing-register-consistency-compact",
      "data-drawing-register-action=\"edit-metadata\"",
      "drawingRegisterEditableDocumentIds",
      "editDrawingRegisterMetadata",
      "saveDrawingRegisterMetadata",
      "drawingMetadata: nextMetadata",
      "/api/documents/${encodeURIComponent(docId)}",
      "libraryDrawingMetadataCard",
      "libraryDrawingNumberInput",
      "libraryDrawingDisciplineSelect",
    ],
    "drawing register visual contract",
  );
  assertExcludes(
    app.body,
    [
      "drawing-register-command-deck",
      "drawing-register-rule-stack",
      "td:nth-child(10) {\n  width: 210px;",
    ],
    "drawing register visual contract",
  );
  assertIncludes(
    app.body,
    [
      "drawingSpecCheckLanguageMode",
      "drawingSpecCheckViewMode",
      "drawingSpecCheckUploadModalOpen",
      "function renderDrawingSpecRegisterHome",
      "function renderDrawingSpecCompareView",
      "function renderDrawingSpecMaintenancePanel",
      "function renderDrawingSpecUploadForm",
      "function renderDrawingSpecUploadModal",
      "function uploadDrawingSpecCheckSpec",
      "function renderDrawingSpecComparePanel",
      "function handleDrawingSpecCheckChange",
      "drawingSpecCheckSelectedSpecVersionIds",
      "drawing-spec-standalone-start",
      "data-drawing-spec-version",
      "data-drawing-spec-upload-field=\"file\"",
      "data-drawing-spec-action=\"open-upload\"",
      "data-drawing-spec-action=\"upload-spec\"",
      "data-drawing-spec-action=\"start-check\"",
      "data-drawing-spec-action=\"back-to-spec-list\"",
      "AI 识别后可在维护区校正",
      "data-drawing-spec-drawing",
      "specVersionIds: selectedSpecVersionIds",
      "drawingVersionIds: state.drawingSpecCheckSelectedDrawingVersionIds",
    ],
    "drawing spec-check optimized UI contract",
  );
  assertExcludes(
    app.body,
    [
      "saveModelHealthRulesetConfig",
      "modelHealthRulesetDraftFromRuleset",
      "Bilingual Configuration",
      "上传文件时选择规格书文档类型后会进入这里维护",
      "renderDrawingSpecUploadForm(entry)",
      "data-drawing-spec-action=\"start-check\" data-tag-number",
      "data-drawing-spec-field=\"selected-spec-version\"",
      "直接登记",
      "data-drawing-spec-upload-field=\"tag-number\"",
      "data-drawing-spec-upload-field=\"equipment-type\"",
    ],
    "app.js",
  );
  if (app.body.includes("window.prompt")) {
    throw new Error("app.js should use the unified action dialog instead of browser-native window.prompt");
  }

  const apsViewer = assertStatus(await request("GET", "/apsviewer.html"), 200, "apsviewer.html");
  assertIncludes(
    apsViewer.body,
    ["APS", "apsviewer.js", "markupsPanel", "markups-floating-toolbar", "Final APS CDE closeout"],
    "apsviewer.html",
  );

  const apsViewerJs = assertStatus(await request("GET", "/apsviewer.js"), 200, "apsviewer.js");
  assertIncludes(
    apsViewerJs.body,
    [
      "initialScheduleId",
      "hydrateInitialConstructionSchedule",
      "renderConstructionScheduleOverlay",
      "construction-schedule-viewer-panel",
      "scheduleId",
      "scheduleDate",
      "MARKUP_TOOL_DEFS",
      "activateMarkupTool",
      "showMarkupsGui",
    ],
    "apsviewer.js schedule and markups visual layer",
  );

  const onlyOffice = assertStatus(await request("GET", "/onlyoffice.html"), 200, "onlyoffice.html");
  assertIncludes(onlyOffice.body, ["OnlyOffice", "DocsAPI"], "onlyoffice.html");

  const loginResponse = assertStatus(
    await request("POST", "/api/session/login", {
      body: {
        email: "admin@cde.local",
        password: BOOTSTRAP_PASSWORD,
      },
    }),
    200,
    "login",
  );
  const cookie = sessionCookie(loginResponse);

  const session = assertStatus(await request("GET", "/api/session", { cookie }), 200, "session after login").json;
  if (!session?.authenticated || session.currentUser?.email !== "admin@cde.local") {
    throw new Error("Authenticated session payload is missing expected admin user");
  }

  const documents = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after login").json;
  if (!Array.isArray(documents?.documents) || !Array.isArray(documents?.folders) || !Array.isArray(documents?.workflowTemplates)) {
    throw new Error("Documents payload is missing documents, folders, or workflowTemplates arrays");
  }
  if (!documents?.notificationCenter || !Array.isArray(documents.notificationCenter.todos) || !Array.isArray(documents.notificationCenter.notifications)) {
    throw new Error("Documents payload is missing notificationCenter data");
  }

  const invalidWorkflowRoleTemplate = await request("POST", "/api/workflow-templates", {
    cookie,
    body: {
      name: "Invalid workflow role contract",
      category: "项目级流程",
      projectName: "CDE文件管理系统",
      allowedRoles: ["editor"],
      autoExport: {
        enabled: false,
        targetFolderId: "",
        targetPath: "",
        namingRule: "",
        exportReviewedFile: true,
        exportApprovalReport: true,
      },
      steps: [
        {
          name: "Editor cannot approve",
          mode: "single",
          assigneeMode: "role",
          dueDays: 1,
          reviewers: [
            {
              type: "role",
              role: "editor",
              label: "编辑者",
            },
          ],
        },
      ],
    },
  });
  if (invalidWorkflowRoleTemplate.statusCode !== 400) {
    throw new Error(`Workflow template API accepted a non-workflow role: ${invalidWorkflowRoleTemplate.statusCode} ${invalidWorkflowRoleTemplate.body.slice(0, 160)}`);
  }

  console.log("frontend smoke passed: pages/resources/session bootstrap are reachable");
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-frontend-smoke-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      APS_CLIENT_ID: "",
      APS_CLIENT_SECRET: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer(child);
    await runFrontendScenario();
  } catch (error) {
    if (output.trim()) {
      console.error(output.trim());
    }
    throw error;
  } finally {
    await stopServer(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
