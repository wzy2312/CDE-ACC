const LANGUAGE_STORAGE_KEY = "cde.language";
const STANDALONE_EN_TEXT = {
  "CDE文件管理系统": "CDE File Management System",
  "APS Viewer 工作台": "APS Viewer Workspace",
  "正在准备工作台...": "Preparing workspace...",
  "正在加载 APS 配置": "Loading APS configuration",
  "联动查看": "Linked View",
  "只看 2D": "2D Only",
  "只看 3D": "3D Only",
  "联动未就绪": "Link Not Ready",
  "保存场景状态": "Save Scene State",
  "返回系统": "Back to System",
  "模型视图": "Model Views",
  "图纸视图": "Drawing Views",
  "2D / 3D 联动": "2D / 3D Linked Views",
  "2D / 3D 视图": "2D / 3D Views",
  "2D 图纸列表": "2D Drawing List",
  "3D 模型": "3D Model",
  "2D 图纸": "2D Drawing",
  "组件状态": "Component Status",
  "图纸能力": "Drawing Capabilities",
  "APS 扩展": "APS Extensions",
  "2D 审阅能力": "2D Review Capabilities",
  "待加载": "Pending",
  "标注审阅": "Markup Review",
  "未加载": "Not Loaded",
  "进入标注": "Enter Markups",
  "保存标注": "Save Markups",
  "清空标注": "Clear Markups",
  "只有 2D 图纸视图启用 MarkupsCore + MarkupsGui。": "MarkupsCore + MarkupsGui are enabled only for 2D drawing views.",
  "视点管理": "Viewpoint Management",
  "图纸视点": "Drawing Viewpoints",
  "保存当前视点": "Save Current View",
  "例如：机电夹层碰撞点 / 1F 总图审阅位": "e.g. MEP mezzanine clash / 1F general drawing review view",
  "例如：总平图首层审阅位 / 图纸批注视角": "e.g. first-floor general plan review view / drawing markup view",
  "构件操作": "Element Actions",
  "隔离 / 着色": "Isolate / Color",
  "未选择": "Not Selected",
  "隔离所选": "Isolate Selected",
  "取消隔离": "Clear Isolation",
  "清空着色": "Clear Coloring",
  "红": "Red",
  "黄": "Yellow",
  "蓝": "Blue",
  "绿": "Green",
  "支持 `isolate` / `setThemingColor`，当前按主视图的选中构件执行。": "Supports `isolate` / `setThemingColor`; actions use the selection in the primary view.",
  "Issue 定位": "Issue Location",
  "三维问题": "3D Issues",
  "Issue 标题": "Issue Title",
  "问题描述": "Issue Description",
  "记录当前视角": "Capture Current View",
  "重新绑定所选构件": "Rebind Selected Element",
  "可先选中构件，再记录当前镜头；未选构件时会保存区域视角。": "Select an element before capturing the camera; if none is selected, the area view is saved.",
  "模型差异": "Model Diff",
  "版本变更": "Version Changes",
  "主视图": "Primary View",
  "联动视图": "Linked View",
  "等待加载": "Waiting",
  "准备主视图中...": "Preparing primary view...",
  "当模型同时具备 2D 与 3D 视图时，这里会显示联动窗口。": "When the model has both 2D and 3D views, the linked view appears here.",
  "正在连接 APS Viewer": "Connecting to APS Viewer",
  "稍等一下，我们会拉取 Viewer 配置、脚本和鉴权信息。": "Please wait while Viewer configuration, scripts, and authentication are loaded.",
  "图纸": "Drawing",
  "模型": "Model",
  "图纸工作台": "Drawing Workspace",
  "模型工作台": "Model Workspace",
  "APS 图纸工作台": "APS Drawing Workspace",
  "APS 模型工作台": "APS Model Workspace",
  "未来计划": "Future Plan",
  "未开始": "Not Started",
  "进行中": "In Progress",
  "已完成": "Completed",
  "提前完成": "Completed Early",
  "滞后": "Delayed",
  "无映射": "Unmapped",
  "红色重点": "Red Highlight",
  "黄色风险": "Yellow Risk",
  "蓝色协调": "Blue Coordination",
  "绿色通过": "Green Passed",
  "未解决": "Open",
  "已解决": "Resolved",
  "已同步": "Synced",
  "构件已删除": "Element Deleted",
  "待确认迁移": "Pending Migration",
  "基础导航": "Navigation",
  "模型导航树": "Model Tree",
  "构件属性面板": "Properties Panel",
  "剖面切割": "Section",
  "测量工具": "Measure",
  "2D 标注引擎": "2D Markup Engine",
  "2D 标注工具栏": "2D Markup Toolbar",
  "视点保存": "Saved Views",
  "2D / 3D 联动": "2D / 3D Linking",
  "待机": "Standby",
  "就绪": "Ready",
  "受限": "Limited",
  "已就绪": "Ready",
  "当前": "Current",
  "历史版本": "Historical Version",
  "当前版本": "Current Version",
  "根目录": "Root",
  "审阅模式": "Review Mode",
  "查看模式": "View Mode",
  "更新于": "Updated",
  "系统": "System",
  "未指定": "Not Specified",
  "未命名视图": "Untitled View",
  "未命名 Issue": "Untitled Issue",
  "未填写说明": "No Notes",
  "区域视角": "Area View",
  "当前模型还没有三维定位 Issue。": "This model has no 3D-located issues yet.",
  "自由线": "Freehand",
  "箭头": "Arrow",
  "矩形": "Rectangle",
  "云线": "Cloud",
  "文字": "Text",
  "撤销": "Undo",
  "重做": "Redo",
  "保存": "Save",
  "操作失败，请稍后重试。": "Operation failed. Please try again later.",
  "请求失败": "Request Failed",
  "缺少文档参数": "Missing Document Parameter",
  "当前页面没有拿到 docId，无法打开 APS": "This page did not receive docId and cannot open APS",
  "正在连接": "Connecting to",
  "稍等一下，我们会拉取": "Please wait while",
  "配置、Viewer 资源和鉴权信息。": "configuration, Viewer assets, and authentication are loaded.",
  "APS 配置获取失败": "Failed to load APS configuration",
  "正在拉取": "Loading",
  "Viewer 已就绪，正在加载 APS": "Viewer is ready. Loading APS",
  "与可用视图。": "and available views.",
  "当前 URN 未找到可加载的 2D / 3D viewable": "No loadable 2D / 3D viewable was found for the current URN",
  "打开失败": "Open Failed",
  "初始化失败": "Initialization Failed",
  "装载失败": "Load Failed",
  "未知错误，请稍后重试。": "Unknown error. Please try again later.",
  "未知错误": "Unknown error",
  "失败": "failed",
  "尚未就绪": "Not Ready",
  "未成功启用": "not enabled",
  "APS 服务尚未配置完整，请先到系统设置 / APS 配置填写 Client ID 和 Client Secret。": "APS is not fully configured. Go to System Settings / APS Settings and enter the Client ID and Client Secret.",
  "请先到系统设置 / APS 配置中填写并启用 APS 凭证：": "Go to System Settings / APS Settings and enter and enable APS credentials:",
  "Bucket 与 Viewer 运行参数": "Bucket and Viewer runtime parameters",
  "保存后重新打开当前工作台。": "Save, then reopen this workspace.",
  "请回到文件管理页，在“文件属性 -> APS 配置”中填写：": "Return to the file management page and fill in File Properties -> APS Settings:",
  "可选的 2D 图纸 GUID": "Optional 2D drawing GUID",
  "可选的 3D 模型 GUID": "Optional 3D model GUID",
  "保存后重新打开": "Save, then reopen",
  "即可。": ".",
  "请确认当前文件是否已完成 APS 转换，并且具备可访问的": "Confirm that APS translation has completed for this file and that it has an accessible",
  "URN。": "URN.",
  "热力图加载失败": "Heatmap load failed",
  "模型差异图层加载失败": "Model diff layer load failed",
  "模型差异图层": "Model Diff Layer",
  "版本 A": "Version A",
  "版本 B": "Version B",
  "A/B 分屏": "A/B Split",
  "叠加模式": "Overlay Mode",
  "新增": "Added",
  "删除": "Deleted",
  "属性": "Properties",
  "移动": "Moved",
  "属性变更": "Property Changes",
  "位置移动": "Position Moved",
  "无法比对": "Unable to Compare",
  "未变更": "Unchanged",
  "当前差异筛选没有可显示构件。": "No elements match the current diff filter.",
  "选择差异记录后，可查看属性变化并在当前视角创建 Issue。": "Select a diff record to review property changes and create an Issue from the current view.",
  "复核：": "Review: ",
  "创建差异 Issue": "Create Diff Issue",
  "已关联 Issue": "Issue Linked",
  "差异 Issue 创建失败": "Diff Issue creation failed",
  "4D 时间点加载失败": "4D date load failed",
  "手动映射失败": "Manual mapping failed",
  "进度 Issue 创建失败": "Schedule Issue creation failed",
  "4D 进度快照导出失败": "4D progress snapshot export failed",
  "标注回放失败": "Markup playback failed",
  "模型差异分屏不可用，已回退到叠加模式": "Model diff split view is unavailable; fell back to overlay mode",
  "Issue 操作失败，请稍后重试。": "Issue operation failed. Please try again later.",
  "请先在 Viewer 中选择一个或多个构件": "Select one or more elements in the Viewer first",
  "请选择要绑定的 Activity": "Select an Activity to bind",
  "未找到该滞后构件对应的进度预警，暂不能自动创建 Issue": "No schedule alert was found for this delayed element, so an Issue cannot be created automatically.",
  "请先选择一条需要重新绑定的 Issue。": "Select an Issue to rebind first.",
  "当前没有可重新绑定的 3D 模型视图。": "No rebindable 3D model view is available.",
  "请先在模型中选择新的关联构件。": "Select a new linked element in the model first.",
  "主视图尚未完成加载": "The primary view has not finished loading.",
  "请先在主视图中选择构件": "Select elements in the primary view first.",
  "当前没有打开 2D 图纸视图": "No 2D drawing view is open.",
  "当前没有可记录的 3D 模型视图。": "No recordable 3D model view is available.",
  "隔离状态已清空": "Isolation cleared",
  "构件着色已清空": "Element coloring cleared",
  "当前文件没有 3D 视图，测量不可用": "This file has no 3D view, so measurement is unavailable",
  "待 3D 模型视图装载后启用": "Enabled after the 3D model view loads",
  "当前文件没有 2D 图纸，标注不可用": "This file has no 2D drawing, so markup is unavailable",
  "当前文件没有 2D 图纸，标注工具栏不可用": "This file has no 2D drawing, so the markup toolbar is unavailable",
  "保存中...": "Saving...",
  "记录中...": "Capturing...",
  "绑定中...": "Binding...",
  "开启中...": "Starting...",
  "清空中...": "Clearing...",
  "清除中...": "Clearing...",
  "隔离中...": "Isolating...",
  "着色中...": "Coloring...",
  "切换中...": "Switching...",
  "已保存": "Saved",
  "已记录": "Captured",
  "已绑定": "Bound",
  "已开启": "Started",
  "已清空": "Cleared",
  "已清除": "Cleared",
  "已隔离": "Isolated",
  "已着色": "Colored",
  "已切换": "Switched",
  "场景已保存": "Scene Saved",
  "已恢复": "Restored",
  "区域视角": "Area View",
  "历史版本或差异对比视图不写回当前模型视点": "Historical versions and diff views do not write back current model viewpoints",
  "当前": "Current",
  "施工进度计划": "Construction Schedule",
  "收起": "Collapse",
  "模式": "Mode",
  "实际状态": "Actual Status",
  "计划状态": "Planned Status",
  "专业": "Discipline",
  "全部专业": "All Disciplines",
  "全部 WBS": "All WBS",
  "手动关联 Activity": "Manual Activity Link",
  "暂无 Activity": "No Activity",
  "绑定当前选择": "Bind Current Selection",
  "当前状态筛选下没有可显示构件。": "No elements match the current status filter.",
  "状态：": "Status: ",
  "该构件暂无关联工序。": "This element has no linked activities.",
  "创建进度 Issue": "Create Schedule Issue",
  "选择构件后查看关联 Activity。": "Select an element to view linked activities.",
  "后退": "Back",
  "暂停": "Pause",
  "播放": "Play",
  "前进": "Forward",
  "查看日期": "View Date",
  "速度": "Speed",
  "1 天/帧": "1 day/frame",
  "1 周/秒": "1 week/sec",
  "1 月/秒": "1 month/sec",
  "只看滞后": "Delayed Only",
  "保存快照": "Save Snapshot",
  "暂无里程碑": "No Milestones",
  "编辑中": "Editing",
  "待标注": "Pending Markup",
  "最近更新：": "Recently updated: ",
  "刚刚": "just now",
  "图纸审阅位": "Drawing Review View",
};

function currentLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function t(zh, en) {
  return currentLanguage() === "en" ? en : zh;
}

function localizeStandaloneText(value) {
  const source = String(value ?? "");
  if (!source || currentLanguage() !== "en" || !/[\u4e00-\u9fff]/.test(source)) {
    return source;
  }
  if (STANDALONE_EN_TEXT[source]) {
    return STANDALONE_EN_TEXT[source];
  }
  let result = source
    .replace(/(\d+)\s*项差异/g, "$1 diffs")
    .replace(/(\d+)\s*项/g, "$1 items")
    .replace(/(\d+)\s*个视点/g, "$1 views")
    .replace(/(\d+)\s*个热力网格/g, "$1 heatmap grids")
    .replace(/(\d+)\s*个/g, "$1 items")
    .replace(/(\d+)\s*视图/g, "$1 views")
    .replace(/当前用户：/g, "User: ")
    .replace(/更新于\s*/g, "Updated ");
  Object.entries(STANDALONE_EN_TEXT)
    .filter(([zh]) => Array.from(zh).length > 1)
    .sort((left, right) => right[0].length - left[0].length)
    .forEach(([zh, en]) => {
      result = result.replaceAll(zh, en);
    });
  return result;
}

function hasCjkText(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function localizeUserMessage(value, fallback = t("操作失败，请稍后重试。", "Operation failed. Please try again later.")) {
  const fallbackValue = String(fallback || "").trim() || t("操作失败，请稍后重试。", "Operation failed. Please try again later.");
  const source = String(value || "").trim() || fallbackValue;
  const localized = localizeStandaloneText(source);
  return currentLanguage() === "en" && hasCjkText(localized) ? fallbackValue : localized;
}

const STANDALONE_OBSERVER_OPTS = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["placeholder", "title", "aria-label", "alt"],
};
let standaloneObserver = null;

// The APS 3D viewer builds its own DOM (canvas + GUI) inside `.viewer-frame`.
// It must never be "translated": rewriting its nodes both corrupts viewer
// internals and \u2014 because the observer below watches the whole <body> \u2014 turns
// the viewer's constant DOM churn into a self-retriggering mutation storm that
// pegs the CPU. So the translation pass skips anything inside the viewer.
function isInsideStandaloneViewer(node) {
  const element = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
  return Boolean(element && element.closest && element.closest(".viewer-frame, .adsk-viewing-viewer, canvas"));
}

function applyStandaloneTranslations(root = document.body) {
  if (currentLanguage() !== "en" || !root || isInsideStandaloneViewer(root)) {
    return;
  }
  // Suspend the observer while we write, so our own nodeValue/attribute updates
  // do not re-enter this callback. Without this the observer observes the very
  // mutations it produces and loops forever (CPU 100%, model never loads).
  if (standaloneObserver) {
    standaloneObserver.disconnect();
  }
  try {
    const translateNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue || "";
        if (/[\u4e00-\u9fff]/.test(value)) {
          const next = localizeStandaloneText(value);
          if (next !== value) {
            node.nodeValue = next;
          }
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      ["placeholder", "title", "aria-label", "alt"].forEach((attribute) => {
        const value = node.getAttribute(attribute);
        if (value && /[\u4e00-\u9fff]/.test(value)) {
          const next = localizeStandaloneText(value);
          if (next !== value) {
            node.setAttribute(attribute, next);
          }
        }
      });
    };
    translateNode(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (["SCRIPT", "STYLE", "SVG", "PATH", "CANVAS"].includes(node.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.classList && (node.classList.contains("viewer-frame") || node.classList.contains("adsk-viewing-viewer"))) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      translateNode(walker.currentNode);
    }
  } finally {
    if (standaloneObserver) {
      // Drop any records our own writes generated, then resume observing.
      standaloneObserver.takeRecords();
      standaloneObserver.observe(document.body, STANDALONE_OBSERVER_OPTS);
    }
  }
}

function startStandaloneTranslationObserver() {
  if (currentLanguage() !== "en" || !document.body || typeof MutationObserver === "undefined") {
    return;
  }
  standaloneObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (isInsideStandaloneViewer(record.target)) {
        continue;
      }
      if (record.type === "characterData" || record.type === "attributes") {
        applyStandaloneTranslations(record.target);
        continue;
      }
      record.addedNodes.forEach((node) => {
        if (!isInsideStandaloneViewer(node)) {
          applyStandaloneTranslations(node);
        }
      });
    }
  });
  standaloneObserver.observe(document.body, STANDALONE_OBSERVER_OPTS);
  applyStandaloneTranslations();
}

startStandaloneTranslationObserver();

const originalAlert = window.alert.bind(window);
window.alert = (message) => originalAlert(localizeUserMessage(message, t("操作失败，请稍后重试。", "Operation failed. Please try again later.")));
document.title = localizeStandaloneText(document.title);

const params = new URLSearchParams(window.location.search);
const docId = params.get("docId") || "";
const versionId = params.get("versionId") || "";
const mode = params.get("mode") || "review";
const actor = params.get("actor") || t("系统", "System");
const workspace = params.get("workspace") === "drawing" ? "drawing" : "model";
const initialIssueId = params.get("issueId") || params.get("annotationId") || "";
const initialDbIdsParam = params.get("dbIds") || "";
const initialReferenceDbIdsParam = params.get("referenceDbIds") || "";
const initialHealthResultId = params.get("healthResultId") || "";
const initialHeatmapId = params.get("heatmapId") || "";
const initialModelDiffTaskId = params.get("modelDiffTaskId") || "";
const initialModelDiffRecordId = params.get("modelDiffRecordId") || "";
const initialScheduleId = params.get("scheduleId") || "";
const initialScheduleDate = params.get("scheduleDate") || "";
const initialScheduleSpeed = ["day", "week", "month"].includes(params.get("scheduleSpeed")) ? params.get("scheduleSpeed") : "week";
const initialModelDiffViewMode = params.get("modelDiffViewMode") === "split" ? "split" : "overlay";
const initialModelDiffTypes = new Set(
  String(params.get("modelDiffTypes") || "added,deleted,modified,moved,unmatched")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean),
);
const initialModelDiffOnlyDifferences = !["0", "false", "off"].includes(String(params.get("modelDiffOnlyDifferences") || "1").toLowerCase());
const initialHeatmapOpacity = Math.max(0.15, Math.min(0.8, Number(params.get("heatmapOpacity") || 0.45) || 0.45));
const initialHeatmapVisible = !["0", "false", "off"].includes(String(params.get("heatmapVisible") || "1").toLowerCase());
const initialHeatmapFloorSlice = params.get("heatmapFloorSlice") || "";
const HEATMAP_OVERLAY_SCENE = "model-clash-heatmap-overlay";

const SCHEDULE_STATUS_META = {
  future: { label: "未来计划", color: "#d1d5db", rgba: [0.82, 0.84, 0.86, 0.32] },
  not_started: { label: "未开始", color: "#9ca3af", rgba: [0.61, 0.64, 0.69, 0.46] },
  in_progress: { label: "进行中", color: "#2563eb", rgba: [0.15, 0.39, 0.92, 1] },
  completed: { label: "已完成", color: "#16a34a", rgba: [0.09, 0.64, 0.29, 1] },
  early: { label: "提前完成", color: "#15803d", rgba: [0.08, 0.5, 0.24, 1] },
  delayed: { label: "滞后", color: "#dc2626", rgba: [0.86, 0.15, 0.15, 1] },
  unmapped: { label: "无映射", color: "#f8fafc", rgba: [0.97, 0.98, 0.99, 0.34] },
};

const dom = {
  topbarKicker: document.querySelector(".topbar-kicker"),
  pageTitle: document.querySelector("#pageTitle"),
  pageMeta: document.querySelector("#pageMeta"),
  layoutModeGroup: document.querySelector("#layoutModeGroup"),
  layoutModeLinkedButton: document.querySelector("#layoutModeLinkedButton"),
  layoutMode2dButton: document.querySelector("#layoutMode2dButton"),
  layoutMode3dButton: document.querySelector("#layoutMode3dButton"),
  linkStatusChip: document.querySelector("#linkStatusChip"),
  saveSceneButton: document.querySelector("#saveSceneButton"),
  backButton: document.querySelector("#backButton"),
  viewablePanelKicker: document.querySelector("#viewablePanelKicker"),
  viewablePanelTitle: document.querySelector("#viewablePanelTitle"),
  viewableSummary: document.querySelector("#viewableSummary"),
  viewable3dSection: document.querySelector("#viewable3dSection"),
  viewable2dSection: document.querySelector("#viewable2dSection"),
  viewable3dList: document.querySelector("#viewable3dList"),
  viewable2dList: document.querySelector("#viewable2dList"),
  componentPanel: document.querySelector("#componentPanel"),
  componentPanelKicker: document.querySelector("#componentPanelKicker"),
  componentPanelTitle: document.querySelector("#componentPanelTitle"),
  componentStatusBadge: document.querySelector("#componentStatusBadge"),
  componentStatusList: document.querySelector("#componentStatusList"),
  markupsStatusBadge: document.querySelector("#markupsStatusBadge"),
  enterMarkupsButton: document.querySelector("#enterMarkupsButton"),
  saveMarkupsButton: document.querySelector("#saveMarkupsButton"),
  clearMarkupsButton: document.querySelector("#clearMarkupsButton"),
  markupsMeta: document.querySelector("#markupsMeta"),
  savedViewPanel: document.querySelector("#savedViewPanel"),
  savedViewPanelKicker: document.querySelector("#savedViewPanelKicker"),
  savedViewPanelTitle: document.querySelector("#savedViewPanelTitle"),
  savedViewCountBadge: document.querySelector("#savedViewCountBadge"),
  savedViewNameInput: document.querySelector("#savedViewNameInput"),
  saveViewButton: document.querySelector("#saveViewButton"),
  savedViewList: document.querySelector("#savedViewList"),
  selectionPanel: document.querySelector("#selectionPanel"),
  selectionStatusBadge: document.querySelector("#selectionStatusBadge"),
  isolateButton: document.querySelector("#isolateButton"),
  clearIsolationButton: document.querySelector("#clearIsolationButton"),
  clearThemingButton: document.querySelector("#clearThemingButton"),
  themeButtons: Array.from(document.querySelectorAll("[data-theme-color]")),
  issueCountBadge: document.querySelector("#issueCountBadge"),
  issueTitleInput: document.querySelector("#issueTitleInput"),
  issueNoteInput: document.querySelector("#issueNoteInput"),
  createIssueButton: document.querySelector("#createIssueButton"),
  rebindIssueButton: document.querySelector("#rebindIssueButton"),
  issueMeta: document.querySelector("#issueMeta"),
  issueList: document.querySelector("#issueList"),
  modelDiffPanel: document.querySelector("#modelDiffPanel"),
  modelDiffPanelBadge: document.querySelector("#modelDiffPanelBadge"),
  modelDiffRecordList: document.querySelector("#modelDiffRecordList"),
  modelDiffRecordDetail: document.querySelector("#modelDiffRecordDetail"),
  viewerGrid: document.querySelector("#viewerGrid"),
  secondaryViewerCard: document.querySelector("#secondaryViewerCard"),
  primaryViewerTitle: document.querySelector("#primaryViewerTitle"),
  primaryViewerMeta: document.querySelector("#primaryViewerMeta"),
  primaryRoleBadge: document.querySelector("#primaryRoleBadge"),
  primaryViewer: document.querySelector("#primaryViewer"),
  primaryIssueOverlay: document.querySelector("#primaryIssueOverlay"),
  primaryViewerPlaceholder: document.querySelector("#primaryViewerPlaceholder"),
  secondaryViewerTitle: document.querySelector("#secondaryViewerTitle"),
  secondaryViewerMeta: document.querySelector("#secondaryViewerMeta"),
  secondaryRoleBadge: document.querySelector("#secondaryRoleBadge"),
  secondaryViewer: document.querySelector("#secondaryViewer"),
  secondaryIssueOverlay: document.querySelector("#secondaryIssueOverlay"),
  secondaryViewerPlaceholder: document.querySelector("#secondaryViewerPlaceholder"),
  stateWrap: document.querySelector("#stateWrap"),
  stateTitle: document.querySelector("#stateTitle"),
  stateMessage: document.querySelector("#stateMessage"),
  stateDetail: document.querySelector("#stateDetail"),
};

const THEME_PRESETS = {
  red: { label: "红色重点", color: [0.925, 0.298, 0.263, 1] },
  amber: { label: "黄色风险", color: [0.961, 0.702, 0.208, 1] },
  blue: { label: "蓝色协调", color: [0.141, 0.49, 0.941, 1] },
  green: { label: "绿色通过", color: [0.133, 0.643, 0.365, 1] },
};

const MARKUP_TOOL_DEFS = [
  { key: "freehand", label: "自由线", ctor: "EditModeFreehand" },
  { key: "arrow", label: "箭头", ctor: "EditModeArrow" },
  { key: "rectangle", label: "矩形", ctor: "EditModeRectangle" },
  { key: "cloud", label: "云线", ctor: "EditModeCloud" },
  { key: "text", label: "文字", ctor: "EditModeText" },
];

const MARKUP_ACTION_DEFS = [
  { key: "undo", label: "撤销" },
  { key: "redo", label: "重做" },
  { key: "save", label: "保存" },
];

const ISSUE_STATUS_LABELS = {
  open: "未解决",
  in_progress: "进行中",
  resolved: "已解决",
};

const MIGRATION_STATUS_LABELS = {
  synced: "已同步",
  deleted: "构件已删除",
  pending: "待确认迁移",
};

const COMPONENT_DEFS = {
  navigation: { label: "基础导航" },
  modelStructure: { label: "模型导航树" },
  properties: { label: "构件属性面板" },
  section: { label: "剖面切割" },
  measure: { label: "测量工具" },
  markupsCore: { label: "2D 标注引擎" },
  markupsGui: { label: "2D 标注工具栏" },
  savedViews: { label: "视点保存" },
  linking: { label: "2D / 3D 联动" },
  isolate: { label: "隔离 / 着色" },
};

const NONE_GUID = "__none__";
let apsAssetPromise = null;
let apsRuntimePromise = null;

function workspaceLabels() {
  return workspace === "drawing"
    ? {
        asset: t("图纸", "Drawing"),
        workspace: t("图纸工作台", "Drawing Workspace"),
        apsWorkspace: t("APS 图纸工作台", "APS Drawing Workspace"),
      }
    : {
        asset: t("模型", "Model"),
        workspace: t("模型工作台", "Model Workspace"),
        apsWorkspace: t("APS 模型工作台", "APS Model Workspace"),
      };
}

function layoutModeLabel(modeKey) {
  if (modeKey === "2d") {
    return t("只看 2D", "2D Only");
  }
  if (modeKey === "3d") {
    return t("只看 3D", "3D Only");
  }
  return t("联动查看", "Linked View");
}

const state = {
  payload: null,
  apsDocument: null,
  layoutMode: workspace === "drawing" ? "2d" : "linked",
  viewables: { "2d": [], "3d": [] },
  selectedSavedViewId: "",
  activeIssueId: initialIssueId,
  issueMarkerFrame: 0,
  issues: [],
  selectionSyncLocked: false,
  themingColors: new Map(),
  isolatedDbIds: [],
  heatmapDetail: null,
  modelDiffDetail: null,
  constructionScheduleDetail: null,
  constructionScheduleDate: initialScheduleDate,
  constructionScheduleSpeed: initialScheduleSpeed,
  constructionSchedulePlaying: false,
  constructionScheduleTimer: null,
  constructionScheduleBusy: false,
  activeConstructionScheduleElementKey: "",
  constructionScheduleStatusFilters: Object.fromEntries(Object.keys(SCHEDULE_STATUS_META).map((status) => [status, true])),
  constructionScheduleDisciplineFilter: "all",
  constructionScheduleWbsFilter: "all",
  constructionScheduleViewMode: "actual",
  activeModelDiffRecordId: initialModelDiffRecordId,
  modelDiffSplitActive: false,
  modelDiffCameraSyncLocked: false,
  componentStatus: createComponentState(),
  slots: {
    primary: createSlot("primary", {
      mount: dom.primaryViewer,
      overlay: dom.primaryIssueOverlay,
      placeholder: dom.primaryViewerPlaceholder,
      title: dom.primaryViewerTitle,
      meta: dom.primaryViewerMeta,
      badge: dom.primaryRoleBadge,
    }),
    secondary: createSlot("secondary", {
      mount: dom.secondaryViewer,
      overlay: dom.secondaryIssueOverlay,
      placeholder: dom.secondaryViewerPlaceholder,
      title: dom.secondaryViewerTitle,
      meta: dom.secondaryViewerMeta,
      badge: dom.secondaryRoleBadge,
    }),
  },
};

function createSlot(key, refs) {
  return {
    key,
    mount: refs.mount,
    overlay: refs.overlay,
    placeholder: refs.placeholder,
    title: refs.title,
    meta: refs.meta,
    badge: refs.badge,
    viewer: null,
    toolbarReadyPromise: null,
    extensions: new Map(),
    role: "",
    current: null,
    heatmapMeshes: [],
    heatmapSceneReady: false,
    markupEditing: false,
    markupsSignature: "",
    activeMarkupTool: "freehand",
    markupsToolbar: null,
    modelDiffSide: "",
    apsDocument: null,
  };
}

function createComponentState() {
  return Object.fromEntries(
    Object.entries(COMPONENT_DEFS).map(([key, value]) => [
      key,
      { key, label: value.label, status: "neutral", note: "待加载" },
    ]),
  );
}

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value, maxLength = 80) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}…` : text;
}

function normalizedUrn(urn) {
  return safeText(urn, "").replace(/^urn:/i, "");
}

function roleLabel(role) {
  return role === "2d" ? t("2D 图纸", "2D Drawing") : role === "3d" ? t("3D 模型", "3D Model") : t("未指定", "Not Specified");
}

function layoutLabel(slotKey) {
  return slotKey === "secondary" ? t("联动视图", "Linked View") : t("主视图", "Primary View");
}

function statusTone(status) {
  return status === "success" ? "success" : status === "warn" ? "warn" : "neutral";
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(currentLanguage() === "en" ? "en-US" : "zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function updateOverlay(title, message, detail = "") {
  dom.stateTitle.textContent = localizeStandaloneText(title);
  dom.stateMessage.textContent = localizeStandaloneText(message);
  dom.stateDetail.textContent = localizeStandaloneText(detail);
  dom.stateDetail.classList.toggle("hidden", !detail);
  dom.stateWrap.classList.remove("hidden");
}

function hideOverlay() {
  dom.stateWrap.classList.add("hidden");
}

function setBadge(element, text, tone = "neutral") {
  element.textContent = localizeStandaloneText(text);
  element.className = `status-pill ${statusTone(tone)}`;
}

function leaveWorkspace() {
  if (state.constructionScheduleTimer) {
    window.clearInterval(state.constructionScheduleTimer);
    state.constructionScheduleTimer = null;
  }
  if (window.opener && !window.opener.closed) {
    window.close();
    return;
  }
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = "/";
}

function pulseButton(button, text) {
  if (!button) {
    return;
  }
  const original = button.dataset.originalLabel || button.textContent;
  button.dataset.originalLabel = original;
  button.textContent = localizeStandaloneText(text);
  window.clearTimeout(button.__pulseTimer);
  button.__pulseTimer = window.setTimeout(() => {
    button.textContent = original;
  }, 1400);
}

async function runButtonAction(button, pendingLabel, task, successLabel = "") {
  const original = button.dataset.originalLabel || button.textContent;
  button.dataset.originalLabel = original;
  button.disabled = true;
  button.textContent = localizeStandaloneText(pendingLabel);
  try {
    await task();
    if (successLabel) {
      pulseButton(button, successLabel);
    } else {
      button.textContent = original;
    }
  } catch (error) {
    button.textContent = original;
    window.alert(localizeUserMessage(error.message, t("操作失败，请稍后重试。", "Operation failed. Please try again later.")));
  } finally {
    button.disabled = false;
  }
}

function setPageMeta(items) {
  dom.pageMeta.innerHTML = "";
  items.filter(Boolean).forEach((item) => {
    const chip = document.createElement("span");
    chip.textContent = localizeStandaloneText(item);
    dom.pageMeta.appendChild(chip);
  });
}

function setComponentStatus(key, status, note) {
  if (!state.componentStatus[key]) {
    return;
  }
  state.componentStatus[key].status = status;
  state.componentStatus[key].note = localizeStandaloneText(note);
  renderComponentStatuses();
}

function visibleComponentKeys() {
  if (workspace === "drawing") {
    return ["navigation", "markupsCore", "markupsGui", "savedViews"];
  }
  return ["navigation", "modelStructure", "properties", "section", "measure", "markupsCore", "markupsGui", "savedViews", "linking", "isolate"];
}

function renderComponentStatuses() {
  dom.componentStatusList.innerHTML = "";
  const keys = visibleComponentKeys();
  const values = keys.map((key) => state.componentStatus[key]).filter(Boolean);
  values.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "status-row";

    const copy = document.createElement("div");
    copy.className = "row-copy";

    const title = document.createElement("strong");
    title.textContent = entry.label;
    const note = document.createElement("span");
    note.textContent = entry.note;

    copy.append(title, note);

    const pill = document.createElement("span");
    pill.className = `status-pill ${statusTone(entry.status)}`;
    pill.textContent = entry.status === "success" ? "就绪" : entry.status === "warn" ? "受限" : "待机";

    row.append(copy, pill);
    dom.componentStatusList.appendChild(row);
  });

  const allReady = values.filter((entry) => entry.status === "success").length;
  const total = values.length;
  const tone = allReady === total ? "success" : allReady >= Math.max(1, Math.ceil(total / 2)) ? "warn" : "neutral";
  setBadge(dom.componentStatusBadge, `${allReady}/${total} 已就绪`, tone);
}

function syncWorkspaceChrome() {
  const labels = workspaceLabels();
  const drawingMode = workspace === "drawing";

  document.body.dataset.workspace = workspace;
  dom.layoutModeGroup.classList.toggle("hidden", drawingMode);
  dom.selectionPanel.classList.toggle("hidden", drawingMode);
  dom.viewable3dSection.classList.toggle("hidden", drawingMode);
  dom.viewable2dSection.classList.remove("hidden");

  dom.viewablePanelKicker.textContent = drawingMode ? "图纸视图" : "模型视图";
  dom.viewablePanelTitle.textContent = drawingMode ? "2D 图纸列表" : "2D / 3D 视图";
  dom.componentPanelKicker.textContent = drawingMode ? "图纸能力" : "组件状态";
  dom.componentPanelTitle.textContent = drawingMode ? "2D 审阅能力" : "APS 扩展";
  dom.savedViewPanelKicker.textContent = drawingMode ? "图纸视点" : "视点管理";
  dom.savedViewPanelTitle.textContent = drawingMode ? "Sheet Views" : "Saved Views";
  dom.savedViewNameInput.placeholder = drawingMode ? "例如：总平图首层审阅位 / 图纸批注视角" : "例如：机电夹层碰撞点 / 1F 总图审阅位";

  dom.primaryViewerPlaceholder.textContent = drawingMode ? `准备${labels.asset}视图中...` : "准备主视图中...";
  dom.secondaryViewerPlaceholder.textContent = drawingMode
    ? `当前${labels.asset}工作台固定为单一 2D 视图。`
    : "当模型同时具备 2D 与 3D 视图时，这里会显示联动窗口。";
}

function syncLayoutModeButtons() {
  const available = new Set(availableLayoutModes());
  const modeDefs = [
    { key: "linked", button: dom.layoutModeLinkedButton },
    { key: "2d", button: dom.layoutMode2dButton },
    { key: "3d", button: dom.layoutMode3dButton },
  ];

  modeDefs.forEach(({ key, button }) => {
    const enabled = available.has(key);
    button.classList.toggle("hidden", !enabled);
    button.classList.toggle("active", state.layoutMode === key);
    button.disabled = !enabled;
  });

  dom.layoutModeGroup.classList.toggle("hidden", workspace === "drawing" || available.size <= 1);
}

function createSmallButton(label, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button small";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    Promise.resolve(onClick()).catch((error) => {
      window.alert(localizeUserMessage(error.message, t("操作失败，请稍后重试。", "Operation failed. Please try again later.")));
    });
  });
  return button;
}

function bubbleGuid(node) {
  if (!node) {
    return "";
  }
  if (typeof node.getGuid === "function") {
    return safeText(node.getGuid(), "");
  }
  if (typeof node.guid === "function") {
    return safeText(node.guid(), "");
  }
  return safeText(node.data?.guid || node.guid, "");
}

function bubbleName(node) {
  if (!node) {
    return "未命名视图";
  }
  if (typeof node.name === "function") {
    return safeText(node.name(), "");
  }
  if (typeof node.getName === "function") {
    return safeText(node.getName(), "");
  }
  return safeText(node.data?.name || node.name, bubbleGuid(node) || "未命名视图");
}

function bubbleRole(node) {
  if (!node) {
    return "";
  }
  if (typeof node.is2D === "function" && node.is2D()) {
    return "2d";
  }
  if (typeof node.is3D === "function" && node.is3D()) {
    return "3d";
  }
  const role = String(node.data?.role || node.role || "").toLowerCase();
  return role === "2d" || role === "3d" ? role : "";
}

function findViewable(role, guid = "") {
  const list = state.viewables[role] || [];
  if (!list.length) {
    return null;
  }
  return list.find((item) => item.guid === guid) || list[0];
}

function currentGuidForRole(role) {
  const primary = state.slots.primary.role === role ? state.slots.primary.current?.guid || "" : "";
  if (primary) {
    return primary;
  }
  return state.slots.secondary.role === role ? state.slots.secondary.current?.guid || "" : "";
}

function activeSlotForRole(role) {
  if (state.slots.primary.role === role) {
    return state.slots.primary;
  }
  if (state.slots.secondary.role === role) {
    return state.slots.secondary;
  }
  return null;
}

function hasDualView() {
  return Boolean(state.slots.secondary.role && state.slots.secondary.current);
}

function has2dViewables() {
  return state.viewables["2d"].length > 0;
}

function has3dViewables() {
  return state.viewables["3d"].length > 0;
}

function availableLayoutModes() {
  const modes = [];

  if (workspace === "drawing") {
    if (has2dViewables()) {
      modes.push("2d");
    } else if (has3dViewables()) {
      modes.push("3d");
    }
    return modes;
  }

  if (has2dViewables() && has3dViewables()) {
    modes.push("linked");
  }
  if (has2dViewables()) {
    modes.push("2d");
  }
  if (has3dViewables()) {
    modes.push("3d");
  }
  return modes;
}

function normalizedLayoutMode(requestedMode = "") {
  const available = availableLayoutModes();
  if (requestedMode && available.includes(requestedMode)) {
    return requestedMode;
  }
  if (workspace === "drawing") {
    return available[0] || "2d";
  }
  if (available.includes("linked")) {
    return "linked";
  }
  if (requestedMode === "2d" && available.includes("2d")) {
    return "2d";
  }
  if (requestedMode === "3d" && available.includes("3d")) {
    return "3d";
  }
  return available[0] || "linked";
}

function preferredGuidForRole(role, apsConfig, overrideGuid = "") {
  if (!role) {
    return "";
  }
  const configuredGuid = role === "2d" ? apsConfig.viewable2dGuid : apsConfig.viewable3dGuid;
  return (
    findViewable(role, overrideGuid)?.guid ||
    findViewable(role, currentGuidForRole(role))?.guid ||
    findViewable(role, configuredGuid)?.guid ||
    findViewable(role)?.guid ||
    ""
  );
}

function defaultPrimaryRole(apsConfig) {
  if (apsConfig.defaultView === "2d" && has2dViewables()) {
    return "2d";
  }
  if (apsConfig.defaultView === "3d" && has3dViewables()) {
    return "3d";
  }
  if (has3dViewables()) {
    return "3d";
  }
  if (has2dViewables()) {
    return "2d";
  }
  return "";
}

function resolveLayoutForMode(modeKey, apsConfig, overrides = {}) {
  const mode = normalizedLayoutMode(modeKey);

  if (mode === "linked" && has2dViewables() && has3dViewables()) {
    const preferredPrimaryRole =
      overrides.primaryRole === "2d" || overrides.primaryRole === "3d"
        ? overrides.primaryRole
        : defaultPrimaryRole(apsConfig);
    const primaryRole = preferredPrimaryRole === "2d" ? "2d" : "3d";
    const secondaryRole = primaryRole === "3d" ? "2d" : "3d";

    return {
      primaryRole,
      primaryGuid:
        primaryRole === "2d"
          ? preferredGuidForRole("2d", apsConfig, overrides.primaryGuid || overrides.viewable2dGuid || "")
          : preferredGuidForRole("3d", apsConfig, overrides.primaryGuid || overrides.viewable3dGuid || ""),
      secondaryRole,
      secondaryGuid:
        secondaryRole === "2d"
          ? preferredGuidForRole("2d", apsConfig, overrides.secondaryGuid || overrides.viewable2dGuid || "")
          : preferredGuidForRole("3d", apsConfig, overrides.secondaryGuid || overrides.viewable3dGuid || ""),
    };
  }

  const preferredSingleRole =
    mode === "2d" || mode === "3d"
      ? mode
      : defaultPrimaryRole(apsConfig);
  const primaryRole =
    preferredSingleRole === "2d" && has2dViewables()
      ? "2d"
      : preferredSingleRole === "3d" && has3dViewables()
        ? "3d"
        : has3dViewables()
          ? "3d"
          : has2dViewables()
            ? "2d"
            : "";

  return {
    primaryRole,
    primaryGuid:
      primaryRole === "2d"
        ? preferredGuidForRole("2d", apsConfig, overrides.primaryGuid || overrides.viewable2dGuid || "")
        : preferredGuidForRole("3d", apsConfig, overrides.primaryGuid || overrides.viewable3dGuid || ""),
    secondaryRole: "",
    secondaryGuid: "",
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(text);
  }
}

async function fetchJson(url, options = {}) {
  const { headers = {}, ...rest } = options;
  const response = await fetch(url, {
    credentials: "same-origin",
    headers,
    ...rest,
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const serverMessage = [payload.error, payload.message].find(Boolean);
    throw new Error(localizeUserMessage(serverMessage, `${t("请求失败", "Request Failed")} (${response.status})`));
  }
  return payload;
}

async function hydrateInitialHeatmap() {
  if (!initialHeatmapId || workspace !== "model" || !initialHeatmapVisible) {
    return;
  }
  const heatmapParams = new URLSearchParams({
    status: params.get("heatmapStatus") || "open",
    disciplinePair: params.get("heatmapDisciplinePair") || "all",
    minClashVolume: params.get("heatmapMinClashVolume") || "0",
    topN: "5",
  });
  try {
    state.heatmapDetail = await fetchJson(`/api/model-apps/clash/heatmaps/${encodeURIComponent(initialHeatmapId)}?${heatmapParams.toString()}`);
    setComponentStatus("isolate", "success", `已加载 ${state.heatmapDetail.cells?.length || 0} 个热力网格`);
  } catch (error) {
    state.heatmapDetail = null;
    setComponentStatus("isolate", "warn", `热力图加载失败：${error.message || "未知错误"}`);
  }
  renderHeatmapOverlay();
}

async function hydrateInitialModelDiff() {
  if (!initialModelDiffTaskId || workspace !== "model") {
    return;
  }
  try {
    state.modelDiffDetail = await fetchJson(`/api/model-apps/diff/tasks/${encodeURIComponent(initialModelDiffTaskId)}`);
    const total = state.modelDiffDetail?.task?.summary?.totalDiffs || state.modelDiffDetail?.records?.length || 0;
    setComponentStatus("isolate", "success", `已加载模型差异图层：${total} 项差异`);
  } catch (error) {
    state.modelDiffDetail = null;
    setComponentStatus("isolate", "warn", `模型差异图层加载失败：${error.message || "未知错误"}`);
  }
  renderModelDiffLegend();
}

async function patchAps(partialAps) {
  const payload = await fetchJson(state.payload.reviewApiUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor,
      aps: partialAps,
    }),
  });
  if (payload.document?.aps) {
    state.payload.aps = payload.document.aps;
  }
  return payload.document?.aps || null;
}

function normalizeDbIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 0))];
}

function dbIdsFromQueryParam(value) {
  return normalizeDbIds(
    String(value || "")
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function normalizeIssue(issue) {
  if (!issue || typeof issue !== "object") {
    return null;
  }
  return {
    ...issue,
    viewerState: issue.viewerState || issue.viewer_state || null,
    dbIds: normalizeDbIds(issue.dbIds || issue.dbids),
    modelUrn: safeText(issue.modelUrn || issue.model_urn, ""),
    sheetGuid: safeText(issue.sheetGuid || issue.sheet_guid, ""),
    elementUniqueId: safeText(issue.elementUniqueId || issue.element_unique_id, ""),
    elementId: safeText(issue.elementId || issue.element_id, ""),
    boundModelVersion: safeText(issue.boundModelVersion || issue.bound_model_version, ""),
    migrationStatus: safeText(issue.migrationStatus || issue.migration_status, "synced"),
  };
}

function hydrateIssues(items) {
  state.issues = Array.isArray(items) ? items.map(normalizeIssue).filter(Boolean) : [];
}

function markupsCoreNamespace() {
  return (
    window.Autodesk?.Viewing?.Extensions?.Markups?.Core ||
    window.Autodesk?.Viewing?.Extensions?.MarkupsCore ||
    null
  );
}

function ensureMarkupsToolbar(slot) {
  if (!slot?.mount?.parentElement) {
    return null;
  }
  if (slot.markupsToolbar) {
    return slot.markupsToolbar;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "markups-floating-toolbar hidden";
  toolbar.setAttribute("aria-label", "2D Markups 标注工具栏");
  toolbar.innerHTML = [
    ...MARKUP_TOOL_DEFS.map((tool) => (
      `<button type="button" data-markup-tool="${escapeHtml(tool.key)}" title="${escapeHtml(tool.label)}">${escapeHtml(tool.label)}</button>`
    )),
    `<span class="markups-floating-toolbar-separator" aria-hidden="true"></span>`,
    ...MARKUP_ACTION_DEFS.map((action) => (
      `<button type="button" data-markup-action="${escapeHtml(action.key)}" title="${escapeHtml(action.label)}">${escapeHtml(action.label)}</button>`
    )),
  ].join("");
  toolbar.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const toolKey = button.dataset.markupTool || "";
    const actionKey = button.dataset.markupAction || "";
    if (toolKey) {
      void runButtonAction(button, "切换中...", () => activateMarkupTool(slot, toolKey), "已切换");
      return;
    }
    if (actionKey) {
      void handleMarkupToolbarAction(slot, actionKey, button);
    }
  });

  slot.mount.parentElement.appendChild(toolbar);
  slot.markupsToolbar = toolbar;
  return toolbar;
}

function syncMarkupsToolbarState() {
  Object.values(state.slots).forEach((slot) => {
    const toolbar = slot.markupsToolbar || ensureMarkupsToolbar(slot);
    if (!toolbar) {
      return;
    }
    const visible = Boolean(slot.role === "2d" && slot.current && slot.markupEditing);
    toolbar.classList.toggle("hidden", !visible);
    toolbar.querySelectorAll("[data-markup-tool]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-markup-tool") === slot.activeMarkupTool);
    });
  });
}

async function markupsExtensions(slot) {
  await ensureSlotExtensions(slot);
  const core = await slot.extensions.get("Autodesk.Viewing.MarkupsCore");
  const gui = await slot.extensions.get("Autodesk.Viewing.MarkupsGui");
  if (!core) {
    throw new Error("MarkupsCore 未能成功加载");
  }
  return { core, gui };
}

function showMarkupsGui(gui) {
  if (!gui) {
    return false;
  }
  let called = false;
  ["show", "activate", "showToolbar", "open"].forEach((method) => {
    if (typeof gui[method] === "function") {
      try {
        gui[method]();
        called = true;
      } catch {}
    }
  });
  return called;
}

function applyDefaultMarkupStyle(core) {
  if (typeof core?.setStyle !== "function") {
    return;
  }
  try {
    core.setStyle({
      "stroke-color": "#d92d20",
      "stroke-width": 3,
      "fill-color": "#d92d2024",
      "font-size": 18,
      "font-family": "Arial",
    });
  } catch {}
}

async function activateMarkupTool(slot, toolKey) {
  if (!slot || slot.role !== "2d" || !slot.current) {
    throw new Error("当前没有打开 2D 图纸视图");
  }
  const { core } = await markupsExtensions(slot);
  const tool = MARKUP_TOOL_DEFS.find((item) => item.key === toolKey) || MARKUP_TOOL_DEFS[0];
  const namespace = markupsCoreNamespace();
  const ToolCtor = namespace?.[tool.ctor];

  core.show?.();
  core.enterEditMode?.();
  applyDefaultMarkupStyle(core);
  if (typeof ToolCtor === "function" && typeof core.changeEditMode === "function") {
    core.changeEditMode(new ToolCtor(core));
  }

  slot.activeMarkupTool = tool.key;
  slot.markupEditing = true;
  syncMarkupsToolbarState();
  updateMarkupsState();
}

async function handleMarkupToolbarAction(slot, actionKey, button) {
  if (actionKey === "save") {
    await runButtonAction(button, "保存中...", saveMarkups, "已保存");
    return;
  }
  const { core } = await markupsExtensions(slot);
  if (actionKey === "undo") {
    core.undo?.();
  } else if (actionKey === "redo") {
    core.redo?.();
  }
  core.show?.();
  syncMarkupsToolbarState();
}

function issueTitle(issue) {
  return safeText(issue?.title, safeText(issue?.note, "未命名 Issue"));
}

function issueHasLocation(issue) {
  return Boolean(issue?.viewerState || issue?.dbIds?.length || issue?.modelUrn || issue?.sheetGuid);
}

function renderIssueList() {
  const issues = state.issues.filter(issueHasLocation);
  setBadge(dom.issueCountBadge, `${issues.length} 项`, issues.length ? "success" : "neutral");
  dom.rebindIssueButton.disabled = !state.activeIssueId;

  if (!issues.length) {
    dom.issueList.innerHTML = '<p class="empty-note">当前模型还没有三维定位 Issue。</p>';
    scheduleIssueMarkerRender();
    return;
  }

  dom.issueList.innerHTML = issues
    .map((issue, index) => {
      const active = issue.id === state.activeIssueId ? "active" : "";
      const statusLabel = ISSUE_STATUS_LABELS[issue.status] || "未解决";
      const migrationLabel = MIGRATION_STATUS_LABELS[issue.migrationStatus] || "已同步";
      const dbIdText = issue.dbIds.length ? `dbId ${issue.dbIds.join(", ")}` : "区域视角";
      return `
        <button class="issue-row ${active}" data-issue-id="${escapeHtml(issue.id)}" type="button">
          <strong>${index + 1}. ${escapeHtml(issueTitle(issue))}</strong>
          <p>${escapeHtml(truncate(issue.note || "未填写说明", 72))}</p>
          <span class="issue-meta">
            <span class="status-pill neutral">${escapeHtml(statusLabel)}</span>
            <span class="status-pill neutral">${escapeHtml(migrationLabel)}</span>
            <span class="status-pill neutral">${escapeHtml(dbIdText)}</span>
          </span>
        </button>
      `;
    })
    .join("");

  Array.from(dom.issueList.querySelectorAll("[data-issue-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      void runIssueAction(() => focusIssueById(button.dataset.issueId || ""));
    });
  });
  scheduleIssueMarkerRender();
}

function active3dSlot() {
  return [state.slots.primary, state.slots.secondary].find((slot) => slot.role === "3d" && slot.viewer && slot.current) || null;
}

function issueViewerStateTarget(viewerState) {
  const target = viewerState?.viewport?.target || viewerState?.target;
  if (Array.isArray(target) && target.length >= 3) {
    return { x: Number(target[0]), y: Number(target[1]), z: Number(target[2]) };
  }
  if (target && typeof target === "object") {
    return { x: Number(target.x), y: Number(target.y), z: Number(target.z) };
  }
  return null;
}

function dbIdWorldCenter(viewer, dbId) {
  const tree = viewer?.model?.getInstanceTree?.();
  const fragList = viewer?.model?.getFragmentList?.();
  if (!tree || !fragList || !window.THREE?.Box3 || !window.THREE?.Vector3) {
    return null;
  }

  const bounds = new window.THREE.Box3();
  const fragmentBounds = new window.THREE.Box3();
  let hasBounds = false;
  tree.enumNodeFragments(
    dbId,
    (fragId) => {
      fragList.getWorldBounds(fragId, fragmentBounds);
      bounds.union(fragmentBounds);
      hasBounds = true;
    },
    true,
  );
  if (!hasBounds) {
    return null;
  }
  return bounds.getCenter(new window.THREE.Vector3());
}

function issueScreenPoint(issue, slot) {
  const viewer = slot?.viewer;
  if (!viewer?.impl?.worldToClient || !window.THREE?.Vector3) {
    return null;
  }

  const dbId = issue.dbIds?.[0];
  const worldPoint = Number.isFinite(dbId) ? dbIdWorldCenter(viewer, dbId) : null;
  const target = worldPoint || issueViewerStateTarget(issue.viewerState);
  if (!target) {
    return null;
  }
  const vector = target instanceof window.THREE.Vector3
    ? target
    : new window.THREE.Vector3(Number(target.x), Number(target.y), Number(target.z));
  if (![vector.x, vector.y, vector.z].every(Number.isFinite)) {
    return null;
  }
  return viewer.impl.worldToClient(vector);
}

function renderIssueMarkers() {
  Object.values(state.slots).forEach((slot) => {
    if (slot.overlay) {
      slot.overlay.innerHTML = "";
    }
  });

  const slot = active3dSlot();
  if (!slot?.overlay) {
    return;
  }

  const markers = state.issues
    .filter((issue) => issueHasLocation(issue) && issue.migrationStatus !== "deleted")
    .map((issue, index) => {
      const point = issueScreenPoint(issue, slot);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return "";
      }
      const active = issue.id === state.activeIssueId ? "active" : "";
      const popover = active
        ? `
          <span class="issue-marker-popover">
            <strong>${escapeHtml(issueTitle(issue))}</strong>
            <span>${escapeHtml(ISSUE_STATUS_LABELS[issue.status] || "未解决")} · ${escapeHtml(MIGRATION_STATUS_LABELS[issue.migrationStatus] || "已同步")}</span>
            <p>${escapeHtml(truncate(issue.note || "未填写说明", 88))}</p>
          </span>
        `
        : "";
      return `
        <button
          class="issue-marker ${active}"
          type="button"
          data-marker-issue-id="${escapeHtml(issue.id)}"
          style="left:${point.x}px; top:${point.y}px"
          title="${escapeHtml(issueTitle(issue))}"
        >
          ${index + 1}
          ${popover}
        </button>
      `;
    })
    .join("");

  slot.overlay.innerHTML = markers;
  Array.from(slot.overlay.querySelectorAll("[data-marker-issue-id]")).forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void runIssueAction(() => focusIssueById(button.dataset.markerIssueId || ""));
    });
  });
}

function scheduleIssueMarkerRender() {
  if (state.issueMarkerFrame) {
    return;
  }
  state.issueMarkerFrame = window.requestAnimationFrame(() => {
    state.issueMarkerFrame = 0;
    renderIssueMarkers();
  });
}

function heatmapNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function heatmapCellBounds(cell) {
  const gridSize = Math.max(0.05, heatmapNumber(cell?.gridSize, 1));
  const min = [
    heatmapNumber(cell?.bbox?.min?.[0], heatmapNumber(cell?.x, 0)),
    heatmapNumber(cell?.bbox?.min?.[1], heatmapNumber(cell?.y, 0)),
    heatmapNumber(cell?.bbox?.min?.[2], heatmapNumber(cell?.z, 0)),
  ];
  const max = [
    heatmapNumber(cell?.bbox?.max?.[0], min[0] + gridSize),
    heatmapNumber(cell?.bbox?.max?.[1], min[1] + gridSize),
    heatmapNumber(cell?.bbox?.max?.[2], min[2] + gridSize),
  ];
  if (min.some((coordinate, index) => !Number.isFinite(coordinate) || coordinate >= max[index])) {
    return null;
  }
  return { min, max };
}

function heatmapFloorSliceAllowsCell(cell) {
  const raw = String(initialHeatmapFloorSlice || "").trim();
  if (!raw) {
    return true;
  }
  const bounds = heatmapCellBounds(cell);
  if (!bounds) {
    return false;
  }
  const [minZ, maxZ] = [bounds.min[2], bounds.max[2]];
  if (raw.includes("-")) {
    const [left, right] = raw.split("-").map((item) => Number(item.trim()));
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      return true;
    }
    const sliceMin = Math.min(left, right);
    const sliceMax = Math.max(left, right);
    return maxZ >= sliceMin && minZ <= sliceMax;
  }
  const z = Number(raw);
  return !Number.isFinite(z) || (z >= minZ && z <= maxZ);
}

function disposeHeatmapMesh(mesh) {
  try {
    mesh?.geometry?.dispose?.();
  } catch {}
  const materials = Array.isArray(mesh?.material) ? mesh.material : [mesh?.material].filter(Boolean);
  materials.forEach((material) => {
    try {
      material.dispose?.();
    } catch {}
  });
}

function clearHeatmapOverlay(slot) {
  const viewer = slot?.viewer;
  const meshes = Array.isArray(slot?.heatmapMeshes) ? slot.heatmapMeshes : [];
  if (viewer?.impl) {
    meshes.forEach((mesh) => {
      try {
        viewer.impl.removeOverlay?.(HEATMAP_OVERLAY_SCENE, mesh);
      } catch {}
      disposeHeatmapMesh(mesh);
    });
    if (slot?.heatmapSceneReady) {
      try {
        viewer.impl.clearOverlay?.(HEATMAP_OVERLAY_SCENE);
      } catch {}
    }
    viewer.impl.invalidate?.(true, true, true);
  } else {
    meshes.forEach(disposeHeatmapMesh);
  }
  if (slot) {
    slot.heatmapMeshes = [];
  }
}

function ensureHeatmapOverlayScene(slot) {
  const viewer = slot?.viewer;
  if (!viewer?.impl?.createOverlayScene) {
    return false;
  }
  if (slot.heatmapSceneReady) {
    return true;
  }
  try {
    viewer.impl.createOverlayScene(HEATMAP_OVERLAY_SCENE);
  } catch {}
  slot.heatmapSceneReady = true;
  return true;
}

function heatmapMeshForCell(THREE, cell, bounds, opacity) {
  const width = Math.max(0.05, bounds.max[0] - bounds.min[0]);
  const height = Math.max(0.05, bounds.max[1] - bounds.min[1]);
  const depth = Math.max(0.05, bounds.max[2] - bounds.min[2]);
  const Geometry = THREE.BoxGeometry || THREE.CubeGeometry;
  const geometry = new Geometry(width, height, depth);
  const intensity = Math.max(0, Math.min(1, heatmapNumber(cell.intensity, 0.35)));
  const material = new THREE.MeshBasicMaterial({
    color: safeText(cell.color, "#237df0"),
    transparent: true,
    opacity: Math.max(0.1, Math.min(0.85, opacity * (0.7 + intensity * 0.3))),
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  );
  mesh.userData = {
    type: "model-clash-heatmap-cell",
    heatmapId: state.heatmapDetail?.task?.id || "",
    cellId: cell.id || "",
    density: cell.density || 0,
    disciplinePair: cell.disciplinePair || "",
  };
  return mesh;
}

function renderHeatmapOverlayForSlot(slot) {
  clearHeatmapOverlay(slot);
  if (workspace !== "model" || !initialHeatmapId || !initialHeatmapVisible || !state.heatmapDetail) {
    return;
  }
  const viewer = slot?.viewer;
  const THREE = window.THREE;
  if (slot?.role !== "3d" || !viewer?.impl) {
    return;
  }
  const canRender =
    THREE?.Mesh &&
    THREE?.MeshBasicMaterial &&
    (THREE.BoxGeometry || THREE.CubeGeometry) &&
    typeof viewer.impl.addOverlay === "function" &&
    ensureHeatmapOverlayScene(slot);
  if (!canRender) {
    setComponentStatus("isolate", "warn", "热力图叠加不可用：当前 APS Viewer 未暴露 overlay scene 能力");
    return;
  }

  const allCells = Array.isArray(state.heatmapDetail.cells) ? state.heatmapDetail.cells : [];
  const cells = allCells.filter(heatmapFloorSliceAllowsCell);
  if (!cells.length) {
    setComponentStatus("isolate", "warn", "当前筛选或切片下没有可叠加的热力网格");
    return;
  }

  const meshes = cells
    .map((cell) => {
      const bounds = heatmapCellBounds(cell);
      return bounds ? heatmapMeshForCell(THREE, cell, bounds, initialHeatmapOpacity) : null;
    })
    .filter(Boolean);

  meshes.forEach((mesh) => {
    try {
      viewer.impl.addOverlay(HEATMAP_OVERLAY_SCENE, mesh);
      slot.heatmapMeshes.push(mesh);
    } catch {
      disposeHeatmapMesh(mesh);
    }
  });
  viewer.impl.invalidate?.(true, true, true);
  setComponentStatus(
    "isolate",
    "success",
    `热力图已叠加 ${slot.heatmapMeshes.length}/${allCells.length} 个网格，透明度 ${Math.round(initialHeatmapOpacity * 100)}%`,
  );
}

function renderHeatmapOverlay() {
  Object.values(state.slots).forEach((slot) => {
    if (slot.role === "3d" && slot.viewer) {
      renderHeatmapOverlayForSlot(slot);
    } else {
      clearHeatmapOverlay(slot);
    }
  });
}

function modelDiffRecordTypes(record) {
  const types = Array.isArray(record?.diffTypes) && record.diffTypes.length
    ? record.diffTypes
    : [record?.diffType || "unchanged"];
  return types.map((type) => safeText(type, "")).filter(Boolean);
}

function modelDiffRecordDisplayType(record, side = "") {
  const types = modelDiffRecordTypes(record);
  if (side === "before" && record?.diffType === "deleted") {
    return "deleted";
  }
  if (types.includes("moved")) {
    return "moved";
  }
  return safeText(record?.diffType, "unchanged");
}

function modelDiffRecordColor(record, side = "") {
  const type = modelDiffRecordDisplayType(record, side);
  return {
    added: [0.176, 0.651, 0.435, 1],
    deleted: [0.851, 0.278, 0.247, 0.72],
    modified: [0.839, 0.651, 0.09, 1],
    moved: [0.918, 0.478, 0.141, 1],
    unmatched: [0.412, 0.451, 0.525, 0.9],
  }[type] || [0.54, 0.58, 0.65, 0.6];
}

function modelDiffRecordDbIds(record, side = "") {
  if (side === "before") {
    return normalizeDbIds([record?.dbIdBefore]);
  }
  if (side === "after") {
    return normalizeDbIds([record?.dbIdAfter]);
  }
  const dbIds = Array.isArray(record?.dbIds) ? record.dbIds : [];
  if (dbIds.length) {
    return normalizeDbIds(dbIds);
  }
  return normalizeDbIds([record?.dbIdAfter, record?.dbIdBefore]);
}

function visibleModelDiffRecords() {
  const records = Array.isArray(state.modelDiffDetail?.records) ? state.modelDiffDetail.records : [];
  return records.filter((record) =>
    record.diffType !== "unchanged" &&
    modelDiffRecordTypes(record).some((type) => initialModelDiffTypes.has(type)),
  );
}

function renderModelDiffLegend() {
  let panel = document.querySelector("#modelDiffViewerLegend");
  if (!state.modelDiffDetail) {
    panel?.remove();
    dom.modelDiffPanel?.classList.add("hidden");
    return;
  }
  if (!panel) {
    panel = document.createElement("aside");
    panel.id = "modelDiffViewerLegend";
    panel.className = "viewer-diff-legend";
    document.body.appendChild(panel);
  }
  const task = state.modelDiffDetail.task || {};
  const summary = task.summary || {};
  const modeLabel = initialModelDiffViewMode === "split" ? "A/B 分屏" : "叠加模式";
  panel.innerHTML = `
    <strong>模型差异图层</strong>
    <span>${escapeHtml(task.versionALabel || "版本 A")} → ${escapeHtml(task.versionBLabel || "版本 B")} · ${escapeHtml(modeLabel)}</span>
    <div>
      <i class="added"></i>新增 ${escapeHtml(summary.added || 0)}
      <i class="deleted"></i>删除 ${escapeHtml(summary.deleted || 0)}
      <i class="modified"></i>属性 ${escapeHtml(summary.modified || 0)}
      <i class="moved"></i>移动 ${escapeHtml(summary.moved || 0)}
    </div>
  `;
  renderModelDiffPanel();
}

function modelDiffTypeLabel(type) {
  return {
    added: "新增",
    deleted: "删除",
    modified: "属性变更",
    moved: "位置移动",
    unmatched: "无法比对",
    unchanged: "未变更",
  }[type] || type || "未知";
}

function modelDiffRecordChangeText(record) {
  if ((record?.diffTypes || []).includes("moved") && record?.bboxDelta?.distanceMm) {
    return `位移 ${Math.round(Number(record.bboxDelta.distanceMm || 0))} mm`;
  }
  if (record?.changedPropCount) {
    return `${record.changedPropCount} 个字段变更`;
  }
  return record?.unmatchedReason || "";
}

function renderModelDiffPanel() {
  if (!dom.modelDiffPanel || !state.modelDiffDetail) {
    return;
  }
  const records = visibleModelDiffRecords();
  dom.modelDiffPanel.classList.remove("hidden");
  dom.modelDiffPanelBadge.textContent = `${records.length} 项`;
  if (!state.activeModelDiffRecordId || !records.some((record) => record.id === state.activeModelDiffRecordId)) {
    state.activeModelDiffRecordId = records[0]?.id || "";
  }
  dom.modelDiffRecordList.innerHTML = records.length
    ? records.slice(0, 80).map((record) => `
      <button class="model-diff-viewer-row ${record.id === state.activeModelDiffRecordId ? "active" : ""}" type="button" data-model-diff-viewer-record="${escapeHtml(record.id)}">
        <i class="model-diff-viewer-dot ${escapeHtml(modelDiffRecordDisplayType(record))}"></i>
        <span>
          <strong>${escapeHtml(record.elementType || record.name || "未分类对象")}</strong>
          <span>${escapeHtml([modelDiffTypeLabel(record.diffType), record.floor, record.discipline].filter(Boolean).join(" · "))}</span>
        </span>
      </button>
    `).join("")
    : `<p class="empty-note">当前差异筛选没有可显示构件。</p>`;
  const record = records.find((item) => item.id === state.activeModelDiffRecordId) || null;
  if (!record) {
    dom.modelDiffRecordDetail.innerHTML = `<p>选择差异记录后，可查看属性变化并在当前视角创建 Issue。</p>`;
    return;
  }
  const changes = Array.isArray(record.changedProps) ? record.changedProps.slice(0, 4) : [];
  dom.modelDiffRecordDetail.innerHTML = `
    <strong>${escapeHtml(record.name || record.elementType || "未命名对象")}</strong>
    <p>${escapeHtml([modelDiffTypeLabel(record.diffType), modelDiffRecordChangeText(record), record.uniqueId ? `ID ${record.uniqueId.slice(0, 12)}` : ""].filter(Boolean).join(" · "))}</p>
    ${changes.length ? `<p>${escapeHtml(changes.map((change) => `${change.propName}: ${change.valueA || "空"} → ${change.valueB || "空"}`).join("；"))}</p>` : ""}
    <input id="modelDiffIssueTitleInput" class="text-input" type="text" maxlength="80" value="${escapeHtml(`${modelDiffTypeLabel(record.diffType)}复核：${record.name || record.elementType || ""}`)}" />
    <button id="modelDiffCreateIssueButton" class="button primary" type="button" ${record.issueId ? "disabled" : ""}>${record.issueId ? "已关联 Issue" : "创建差异 Issue"}</button>
  `;
}

function focusModelDiffRecord(recordId) {
  const records = visibleModelDiffRecords();
  const record = records.find((item) => item.id === recordId);
  if (!record) {
    return;
  }
  state.activeModelDiffRecordId = record.id;
  renderModelDiffPanel();
  Object.values(state.slots).forEach((slot) => {
    if (slot.role !== "3d" || !slot.viewer) {
      return;
    }
    const ids = modelDiffRecordDbIds(record, slot.modelDiffSide || "");
    if (!ids.length) {
      return;
    }
    try {
      slot.viewer.select?.(ids);
      slot.viewer.fitToView?.(ids);
    } catch {}
  });
}

async function createIssueFromActiveModelDiffRecord() {
  const record = visibleModelDiffRecords().find((item) => item.id === state.activeModelDiffRecordId);
  if (!record || record.issueId) {
    return;
  }
  const title = safeText(document.querySelector("#modelDiffIssueTitleInput")?.value, `${modelDiffTypeLabel(record.diffType)}复核：${record.name || record.elementType}`);
  try {
    await fetchJson(`/api/model-apps/diff/records/${encodeURIComponent(record.id)}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        responsible: record.discipline || "",
        note: "从 Viewer 差异侧栏创建",
      }),
    });
    if (initialModelDiffTaskId) {
      state.modelDiffDetail = await fetchJson(`/api/model-apps/diff/tasks/${encodeURIComponent(initialModelDiffTaskId)}`);
    }
    renderModelDiffLegend();
    renderModelDiffOverlay();
    setComponentStatus("isolate", "success", "差异 Issue 已创建并回写关联状态");
  } catch (error) {
    setComponentStatus("isolate", "warn", `差异 Issue 创建失败：${error.message || "未知错误"}`);
  }
}

function renderModelDiffOverlayForSlot(slot) {
  if (workspace !== "model" || !state.modelDiffDetail || slot?.role !== "3d" || !slot.viewer || !window.THREE?.Vector4) {
    return;
  }
  const records = visibleModelDiffRecords();
  const selected = state.activeModelDiffRecordId
    ? records.find((record) => record.id === state.activeModelDiffRecordId)
    : null;
  const focusedIds = [];
  const visibleIds = [];
  try {
    slot.viewer.clearThemingColors?.(slot.viewer.model);
  } catch {}
  records.forEach((record) => {
    const color = new window.THREE.Vector4(...modelDiffRecordColor(record, slot.modelDiffSide || ""));
    modelDiffRecordDbIds(record, slot.modelDiffSide || "").forEach((dbId) => {
      try {
        slot.viewer.setThemingColor(dbId, color, slot.viewer.model);
        visibleIds.push(dbId);
        if (selected?.id === record.id) {
          focusedIds.push(dbId);
        }
      } catch {
        // APS skips dbIds that do not exist in the currently loaded version.
      }
    });
  });
  if (initialModelDiffOnlyDifferences && visibleIds.length) {
    slot.viewer.isolate?.([...new Set(visibleIds)]);
  }
  if (focusedIds.length) {
    slot.viewer.select?.(focusedIds);
    slot.viewer.fitToView?.(focusedIds);
  }
  slot.viewer.impl?.invalidate?.(true);
  setComponentStatus("isolate", "success", `模型差异图层已高亮 ${records.length} 条记录`);
}

function renderModelDiffOverlay() {
  Object.values(state.slots).forEach((slot) => renderModelDiffOverlayForSlot(slot));
  renderModelDiffPanel();
}

function hasConstructionScheduleLayer() {
  return workspace === "model" && Boolean(state.constructionScheduleDetail?.timeline);
}

function constructionScheduleElementKey(element) {
  return safeText(element?.uniqueId, "") || (Number.isFinite(Number(element?.dbId)) ? `dbid:${Number(element.dbId)}` : "");
}

function scheduleStatusLabel(status) {
  return SCHEDULE_STATUS_META[status]?.label || status || "未知";
}

function scheduleStatusColor(status) {
  return SCHEDULE_STATUS_META[status]?.rgba || SCHEDULE_STATUS_META.unmapped.rgba;
}

function compareScheduleDate(left, right) {
  const a = new Date(`${safeText(left, "")}T00:00:00.000Z`);
  const b = new Date(`${safeText(right, "")}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return a.getTime() === b.getTime() ? 0 : a.getTime() < b.getTime() ? -1 : 1;
}

function plannedScheduleStatusForActivity(activity, date) {
  const viewDate = safeText(date, state.constructionScheduleDate || "");
  const start = safeText(activity.plannedStart, "");
  const finish = safeText(activity.plannedFinish, "");
  if (start && compareScheduleDate(viewDate, start) < 0) return "future";
  if (finish && compareScheduleDate(viewDate, finish) > 0) return "completed";
  return "in_progress";
}

function displayConstructionScheduleStatus(element) {
  if (state.constructionScheduleViewMode !== "plan") {
    return element.status;
  }
  const statuses = (element.activities || []).map((activity) => plannedScheduleStatusForActivity(activity, state.constructionScheduleDate));
  if (!statuses.length) return "unmapped";
  if (statuses.includes("in_progress")) return "in_progress";
  if (statuses.includes("future")) return "future";
  return "completed";
}

function constructionScheduleDisciplines() {
  const elements = Array.isArray(state.constructionScheduleDetail?.timeline?.elements)
    ? state.constructionScheduleDetail.timeline.elements
    : [];
  return [...new Set(elements.map((element) => safeText(element.discipline, "")).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function constructionScheduleWbsOptions() {
  const activities = Array.isArray(state.constructionScheduleDetail?.activities)
    ? state.constructionScheduleDetail.activities
    : [];
  return [...new Set(activities.map((activity) => safeText(activity.wbsId, "")).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function constructionScheduleStats() {
  const stats = {};
  visibleConstructionScheduleElements({ ignoreStatusFilter: true }).forEach((element) => {
    const status = displayConstructionScheduleStatus(element);
    stats[status] = Number(stats[status] || 0) + 1;
  });
  return Object.keys(SCHEDULE_STATUS_META).map((status) => [status, stats[status] || 0]);
}

function visibleConstructionScheduleElements(options = {}) {
  const elements = Array.isArray(state.constructionScheduleDetail?.timeline?.elements)
    ? state.constructionScheduleDetail.timeline.elements
    : [];
  return elements.filter((element) => {
    const displayStatus = displayConstructionScheduleStatus(element);
    const disciplineOk = state.constructionScheduleDisciplineFilter === "all" || safeText(element.discipline, "") === state.constructionScheduleDisciplineFilter;
    const wbsOk = state.constructionScheduleWbsFilter === "all" ||
      (element.activities || []).some((activity) => safeText(activity.wbsId, "") === state.constructionScheduleWbsFilter);
    return (options.ignoreStatusFilter || state.constructionScheduleStatusFilters[displayStatus] !== false) && disciplineOk && wbsOk;
  });
}

function activeConstructionScheduleElement() {
  const key = state.activeConstructionScheduleElementKey;
  const elements = Array.isArray(state.constructionScheduleDetail?.timeline?.elements)
    ? state.constructionScheduleDetail.timeline.elements
    : [];
  return elements.find((element) => constructionScheduleElementKey(element) === key) || null;
}

function constructionScheduleStepDays() {
  if (state.constructionScheduleSpeed === "day") return 1;
  if (state.constructionScheduleSpeed === "month") return 30;
  return 7;
}

function scheduleDateOffset(date, days) {
  const raw = safeText(date, "") || new Date().toISOString().slice(0, 10);
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return new Date(parsed.getTime() + Number(days || 0) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function ensureConstructionScheduleViewerChrome() {
  let panel = document.querySelector("#constructionScheduleViewerPanel");
  if (!panel) {
    panel = document.createElement("aside");
    panel.id = "constructionScheduleViewerPanel";
    panel.className = "construction-schedule-viewer-panel hidden";
    document.body.appendChild(panel);
    panel.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest("[data-schedule-element-key]");
      if (row instanceof HTMLButtonElement) {
        focusConstructionScheduleElement(row.dataset.scheduleElementKey || "");
        return;
      }
      const toggle = target?.closest("[data-schedule-status-toggle]");
      if (toggle instanceof HTMLInputElement) {
        state.constructionScheduleStatusFilters[toggle.dataset.scheduleStatusToggle || ""] = toggle.checked;
        renderConstructionSchedulePanel();
        renderConstructionScheduleOverlay();
        return;
      }
      const action = target?.closest("[data-schedule-viewer-action]");
      if (action instanceof HTMLButtonElement && !action.disabled) {
        handleConstructionScheduleViewerAction(action.dataset.scheduleViewerAction || "", action);
      }
    });
    panel.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.id === "constructionScheduleDisciplineFilter") {
        state.constructionScheduleDisciplineFilter = target.value || "all";
        renderConstructionSchedulePanel();
        renderConstructionScheduleOverlay();
      }
      if (target instanceof HTMLSelectElement && target.id === "constructionScheduleWbsFilter") {
        state.constructionScheduleWbsFilter = target.value || "all";
        renderConstructionSchedulePanel();
        renderConstructionScheduleOverlay();
      }
      if (target instanceof HTMLSelectElement && target.id === "constructionScheduleViewModeSelect") {
        state.constructionScheduleViewMode = target.value || "actual";
        renderConstructionSchedulePanel();
        renderConstructionScheduleOverlay();
      }
    });
  }

  let timeline = document.querySelector("#constructionScheduleViewerTimeline");
  if (!timeline) {
    timeline = document.createElement("div");
    timeline.id = "constructionScheduleViewerTimeline";
    timeline.className = "construction-schedule-viewer-timeline hidden";
    document.body.appendChild(timeline);
    timeline.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-schedule-time-action]") : null;
      if (button instanceof HTMLButtonElement && !button.disabled) {
        handleConstructionScheduleTimelineAction(button.dataset.scheduleTimeAction || "");
      }
    });
    timeline.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.id === "constructionScheduleDateInput") {
        void loadConstructionScheduleTimeline(target.value || state.constructionScheduleDate);
      }
      if (target instanceof HTMLSelectElement && target.id === "constructionScheduleSpeedSelect") {
        state.constructionScheduleSpeed = target.value || "week";
        renderConstructionScheduleTimelineDock();
      }
    });
  }

  return { panel, timeline };
}

function renderConstructionSchedulePanel() {
  const { panel } = ensureConstructionScheduleViewerChrome();
  if (!hasConstructionScheduleLayer()) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  const detail = state.constructionScheduleDetail || {};
  const schedule = detail.schedule || {};
  const timeline = detail.timeline || {};
  const activities = Array.isArray(detail.activities) ? detail.activities : [];
  const elements = visibleConstructionScheduleElements();
  const disciplines = constructionScheduleDisciplines();
  const wbsOptions = constructionScheduleWbsOptions();
  const active = activeConstructionScheduleElement() || elements[0] || null;
  if (active && !state.activeConstructionScheduleElementKey) {
    state.activeConstructionScheduleElementKey = constructionScheduleElementKey(active);
  }
  const activeActivities = Array.isArray(active?.activities) ? active.activities : [];
  panel.innerHTML = `
    <div class="construction-schedule-viewer-head">
      <div>
        <span>4D Schedule</span>
        <strong>${escapeHtml(schedule.name || detail.name || "施工进度计划")}</strong>
      </div>
      <button class="button small" data-schedule-viewer-action="collapse" type="button">收起</button>
    </div>
    <div class="construction-schedule-viewer-date">${escapeHtml(timeline.date || state.constructionScheduleDate || "")}</div>
    <div class="construction-schedule-viewer-stats">
      ${constructionScheduleStats().map(([status, value]) => `
        <span><i style="background:${escapeHtml(SCHEDULE_STATUS_META[status]?.color || "#cbd5e1")}"></i>${escapeHtml(scheduleStatusLabel(status))}<strong>${escapeHtml(value)}</strong></span>
      `).join("")}
    </div>
    <div class="construction-schedule-viewer-filters">
      <label>
        <span>模式</span>
        <select id="constructionScheduleViewModeSelect">
          <option value="actual" ${state.constructionScheduleViewMode === "actual" ? "selected" : ""}>实际状态</option>
          <option value="plan" ${state.constructionScheduleViewMode === "plan" ? "selected" : ""}>计划状态</option>
        </select>
      </label>
      <label>
        <span>专业</span>
        <select id="constructionScheduleDisciplineFilter">
          <option value="all">全部专业</option>
          ${disciplines.map((discipline) => `<option value="${escapeHtml(discipline)}" ${state.constructionScheduleDisciplineFilter === discipline ? "selected" : ""}>${escapeHtml(discipline)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>WBS</span>
        <select id="constructionScheduleWbsFilter">
          <option value="all">全部 WBS</option>
          ${wbsOptions.map((wbs) => `<option value="${escapeHtml(wbs)}" ${state.constructionScheduleWbsFilter === wbs ? "selected" : ""}>${escapeHtml(wbs)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="construction-schedule-viewer-layers">
      ${Object.entries(SCHEDULE_STATUS_META).map(([status, meta]) => `
        <label>
          <input data-schedule-status-toggle="${escapeHtml(status)}" type="checkbox" ${state.constructionScheduleStatusFilters[status] === false ? "" : "checked"} />
          <i style="background:${escapeHtml(meta.color)}"></i>
          <span>${escapeHtml(meta.label)}</span>
        </label>
      `).join("")}
    </div>
    <div class="construction-schedule-viewer-bind">
      <label>
        <span>手动关联 Activity</span>
        <select id="constructionScheduleBindActivitySelect">
          ${activities.length ? activities.map((activity) => `<option value="${escapeHtml(activity.id)}">${escapeHtml(`${activity.activityId} ${activity.name}`)}</option>`).join("") : "<option value=\"\">暂无 Activity</option>"}
        </select>
      </label>
      <button class="button small" data-schedule-viewer-action="manual-map" type="button" ${activities.length ? "" : "disabled"}>绑定当前选择</button>
    </div>
    <div class="construction-schedule-viewer-list">
      ${elements.length ? elements.slice(0, 80).map((element) => {
        const key = constructionScheduleElementKey(element);
        const displayStatus = displayConstructionScheduleStatus(element);
        return `
          <button class="construction-schedule-viewer-row ${key === state.activeConstructionScheduleElementKey ? "active" : ""}" data-schedule-element-key="${escapeHtml(key)}" type="button">
            <i style="background:${escapeHtml(SCHEDULE_STATUS_META[displayStatus]?.color || "#cbd5e1")}"></i>
            <span>
              <strong>${escapeHtml(element.name || element.uniqueId || `dbId ${element.dbId}`)}</strong>
              <small>${escapeHtml([scheduleStatusLabel(displayStatus), element.elementType, element.floor, element.discipline].filter(Boolean).join(" · "))}</small>
            </span>
          </button>
        `;
      }).join("") : `<p class="empty-note">当前状态筛选下没有可显示构件。</p>`}
    </div>
    <div class="construction-schedule-viewer-detail">
      ${active ? `
        <strong>${escapeHtml(active.name || active.uniqueId || `dbId ${active.dbId}`)}</strong>
        <p>${escapeHtml([active.elementType, active.floor, active.discipline, `状态：${scheduleStatusLabel(displayConstructionScheduleStatus(active))}`].filter(Boolean).join(" · "))}</p>
        <div>
          ${activeActivities.length ? activeActivities.map((activity) => `
            <span>
              <b>${escapeHtml(activity.activityId || "")} ${escapeHtml(activity.name || "")}</b>
              ${escapeHtml(`${activity.plannedStart || "—"} → ${activity.plannedFinish || "—"} · ${activity.label || scheduleStatusLabel(activity.status)} · ${activity.percentComplete || 0}%`)}
            </span>
          `).join("") : "<span>该构件暂无关联工序。</span>"}
        </div>
        <button class="button primary small" data-schedule-viewer-action="issue" type="button" ${active.status === "delayed" ? "" : "disabled"}>创建进度 Issue</button>
      ` : "<p>选择构件后查看关联 Activity。</p>"}
    </div>
  `;
}

function renderConstructionScheduleTimelineDock() {
  const { timeline } = ensureConstructionScheduleViewerChrome();
  if (!hasConstructionScheduleLayer()) {
    timeline.classList.add("hidden");
    return;
  }
  timeline.classList.remove("hidden");
  const detail = state.constructionScheduleDetail || {};
  const dataDate = detail.timeline?.date || state.constructionScheduleDate || new Date().toISOString().slice(0, 10);
  const milestones = Array.isArray(detail.timeline?.milestones) ? detail.timeline.milestones : [];
  timeline.innerHTML = `
    <div class="construction-schedule-player">
      <button class="button small" data-schedule-time-action="back" type="button">后退</button>
      <button class="button primary small" data-schedule-time-action="play" type="button">${state.constructionSchedulePlaying ? "暂停" : "播放"}</button>
      <button class="button small" data-schedule-time-action="forward" type="button">前进</button>
      <label>
        <span>查看日期</span>
        <input id="constructionScheduleDateInput" type="date" value="${escapeHtml(dataDate)}" />
      </label>
      <label>
        <span>速度</span>
        <select id="constructionScheduleSpeedSelect">
          <option value="day" ${state.constructionScheduleSpeed === "day" ? "selected" : ""}>1 天/帧</option>
          <option value="week" ${state.constructionScheduleSpeed === "week" ? "selected" : ""}>1 周/秒</option>
          <option value="month" ${state.constructionScheduleSpeed === "month" ? "selected" : ""}>1 月/秒</option>
        </select>
      </label>
      <button class="button small" data-schedule-time-action="delayed" type="button">只看滞后</button>
      <button class="button small" data-schedule-time-action="snapshot" type="button">保存快照</button>
    </div>
    <div class="construction-schedule-milestones">
      ${milestones.slice(0, 8).map((milestone) => `<button class="button small" data-schedule-time-action="milestone:${escapeHtml(milestone.plannedFinish || "")}" type="button">${escapeHtml(milestone.name || milestone.activityId)}</button>`).join("") || "<span>暂无里程碑</span>"}
    </div>
  `;
}

function renderConstructionScheduleChrome() {
  renderConstructionSchedulePanel();
  renderConstructionScheduleTimelineDock();
}

async function hydrateInitialConstructionSchedule() {
  if (!initialScheduleId || workspace !== "model") {
    return;
  }
  const payload = state.payload?.schedule;
  if (payload?.scheduleId === initialScheduleId) {
    state.constructionScheduleDetail = payload;
    state.constructionScheduleDate = payload.date || initialScheduleDate || "";
    const firstDelayed = (payload.timeline?.elements || []).find((element) => element.status === "delayed");
    const firstElement = firstDelayed || (payload.timeline?.elements || [])[0] || null;
    state.activeConstructionScheduleElementKey = firstElement ? constructionScheduleElementKey(firstElement) : "";
    setComponentStatus("isolate", "success", `已加载 4D 进度图层：${payload.timeline?.elements?.length || 0} 个构件`);
  } else {
    await loadConstructionScheduleTimeline(initialScheduleDate || "");
  }
  renderConstructionScheduleChrome();
}

async function loadConstructionScheduleTimeline(date) {
  if (!initialScheduleId) {
    return;
  }
  const nextDate = safeText(date, state.constructionScheduleDate || initialScheduleDate || "");
  state.constructionScheduleBusy = true;
  renderConstructionScheduleTimelineDock();
  try {
    const payload = await fetchJson(`/api/model-apps/schedule/${encodeURIComponent(initialScheduleId)}/timeline?date=${encodeURIComponent(nextDate)}`);
    state.constructionScheduleDetail = {
      scheduleId: payload.schedule?.id || initialScheduleId,
      name: payload.schedule?.name || state.constructionScheduleDetail?.name || "",
      date: payload.timeline?.date || nextDate,
      schedule: payload.schedule || state.constructionScheduleDetail?.schedule || {},
      timeline: payload.timeline || {},
      completeness: payload.completeness || state.constructionScheduleDetail?.completeness || {},
      activities: state.constructionScheduleDetail?.activities || [],
    };
    state.constructionScheduleDate = state.constructionScheduleDetail.date || nextDate;
    const active = activeConstructionScheduleElement();
    if (!active) {
      const elements = visibleConstructionScheduleElements();
      state.activeConstructionScheduleElementKey = constructionScheduleElementKey(elements.find((item) => item.status === "delayed") || elements[0] || {});
    }
    renderConstructionScheduleChrome();
    renderConstructionScheduleOverlay();
  } catch (error) {
    setComponentStatus("isolate", "warn", `4D 时间点加载失败：${error.message || "未知错误"}`);
  } finally {
    state.constructionScheduleBusy = false;
    renderConstructionScheduleTimelineDock();
  }
}

function handleConstructionScheduleTimelineAction(action) {
  if (action === "play") {
    toggleConstructionSchedulePlayback();
    return;
  }
  if (action === "back" || action === "forward") {
    const direction = action === "back" ? -1 : 1;
    const nextDate = scheduleDateOffset(state.constructionScheduleDate, direction * constructionScheduleStepDays());
    void loadConstructionScheduleTimeline(nextDate);
    return;
  }
  if (action === "delayed") {
    Object.keys(state.constructionScheduleStatusFilters).forEach((status) => {
      state.constructionScheduleStatusFilters[status] = status === "delayed";
    });
    renderConstructionScheduleChrome();
    renderConstructionScheduleOverlay();
    return;
  }
  if (action === "snapshot") {
    saveConstructionScheduleSnapshot();
    return;
  }
  if (action.startsWith("milestone:")) {
    const date = action.slice("milestone:".length);
    if (date) {
      void loadConstructionScheduleTimeline(date);
    }
  }
}

function toggleConstructionSchedulePlayback() {
  state.constructionSchedulePlaying = !state.constructionSchedulePlaying;
  if (state.constructionScheduleTimer) {
    window.clearInterval(state.constructionScheduleTimer);
    state.constructionScheduleTimer = null;
  }
  if (state.constructionSchedulePlaying) {
    state.constructionScheduleTimer = window.setInterval(() => {
      if (!state.constructionScheduleBusy) {
        const nextDate = scheduleDateOffset(state.constructionScheduleDate, constructionScheduleStepDays());
        void loadConstructionScheduleTimeline(nextDate);
      }
    }, 1000);
  }
  renderConstructionScheduleTimelineDock();
}

function focusConstructionScheduleElement(elementKey) {
  const elements = Array.isArray(state.constructionScheduleDetail?.timeline?.elements)
    ? state.constructionScheduleDetail.timeline.elements
    : [];
  const element = elements.find((item) => constructionScheduleElementKey(item) === elementKey);
  if (!element) {
    return;
  }
  state.activeConstructionScheduleElementKey = elementKey;
  renderConstructionSchedulePanel();
  const dbIds = normalizeDbIds([element.dbId]);
  if (!dbIds.length) {
    return;
  }
  Object.values(state.slots).forEach((slot) => {
    if (slot.role !== "3d" || !slot.viewer) return;
    try {
      slot.viewer.select?.(dbIds);
      slot.viewer.fitToView?.(dbIds);
    } catch {}
  });
}

function updateActiveConstructionScheduleFromSelection(dbIds) {
  if (!hasConstructionScheduleLayer() || !dbIds.length) {
    return;
  }
  const selected = new Set(normalizeDbIds(dbIds).map((dbId) => Number(dbId)));
  const element = (state.constructionScheduleDetail.timeline?.elements || []).find((item) => selected.has(Number(item.dbId)));
  if (element) {
    state.activeConstructionScheduleElementKey = constructionScheduleElementKey(element);
    renderConstructionSchedulePanel();
  }
}

function renderConstructionScheduleOverlayForSlot(slot) {
  if (!hasConstructionScheduleLayer() || slot?.role !== "3d" || !slot.viewer || !window.THREE?.Vector4) {
    return;
  }
  const elements = visibleConstructionScheduleElements();
  const active = activeConstructionScheduleElement();
  const visibleDbIds = [];
  try {
    slot.viewer.clearThemingColors?.(slot.viewer.model);
  } catch {}
  elements.forEach((element) => {
    const dbIds = normalizeDbIds([element.dbId]);
    if (!dbIds.length) return;
    const color = new window.THREE.Vector4(...scheduleStatusColor(displayConstructionScheduleStatus(element)));
    dbIds.forEach((dbId) => {
      try {
        slot.viewer.setThemingColor(dbId, color, slot.viewer.model);
        visibleDbIds.push(dbId);
      } catch {}
    });
  });
  if (visibleDbIds.length) {
    try {
      slot.viewer.isolate?.([...new Set(visibleDbIds)]);
    } catch {}
  }
  if (active) {
    const activeDbIds = normalizeDbIds([active.dbId]);
    if (activeDbIds.length) {
      try {
        slot.viewer.select?.(activeDbIds);
      } catch {}
    }
  }
  slot.viewer.impl?.invalidate?.(true);
  setComponentStatus("isolate", "success", `4D 进度图层已着色 ${visibleDbIds.length} 个构件`);
}

function renderConstructionScheduleOverlay() {
  Object.values(state.slots).forEach((slot) => renderConstructionScheduleOverlayForSlot(slot));
  renderConstructionScheduleChrome();
}

function handleConstructionScheduleViewerAction(action, button) {
  if (action === "collapse") {
    document.querySelector("#constructionScheduleViewerPanel")?.classList.add("hidden");
    return;
  }
  if (action === "issue") {
    button.disabled = true;
    void createConstructionScheduleIssueForActiveElement().finally(() => {
      button.disabled = false;
    });
    return;
  }
  if (action === "manual-map") {
    button.disabled = true;
    void manualMapConstructionScheduleSelection().finally(() => {
      button.disabled = false;
    });
  }
}

async function manualMapConstructionScheduleSelection() {
  const activityRowId = safeText(document.querySelector("#constructionScheduleBindActivitySelect")?.value, "");
  const slot = active3dSlot();
  const dbIds = normalizeDbIds(slot?.viewer?.getSelection?.() || []);
  if (!activityRowId) {
    setComponentStatus("isolate", "warn", "请选择要绑定的 Activity");
    return;
  }
  if (!slot?.viewer || !dbIds.length) {
    setComponentStatus("isolate", "warn", "请先在 Viewer 中选择一个或多个构件");
    return;
  }
  try {
    const elements = [];
    for (const dbId of dbIds) {
      const stableIds = await stableIdsForDbId(slot.viewer, dbId);
      const props = await getViewerProperties(slot.viewer, dbId);
      elements.push({
        dbId,
        uniqueId: stableIds.elementUniqueId || "",
        name: safeText(props?.name, `dbId ${dbId}`),
      });
    }
    const payload = await fetchJson(`/api/model-apps/schedule/${encodeURIComponent(initialScheduleId)}/manual-map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityRowId, elements }),
    });
    if (state.constructionScheduleDetail) {
      state.constructionScheduleDetail.completeness = payload.completeness || state.constructionScheduleDetail.completeness;
    }
    await loadConstructionScheduleTimeline(state.constructionScheduleDate);
    setComponentStatus("isolate", "success", `已手动绑定 ${payload.createdMappings?.length || dbIds.length} 个构件`);
  } catch (error) {
    setComponentStatus("isolate", "warn", `手动映射失败：${error.message || "未知错误"}`);
  }
}

async function createConstructionScheduleIssueForActiveElement() {
  const element = activeConstructionScheduleElement();
  if (!element || element.status !== "delayed" || !initialScheduleId) {
    return;
  }
  const activityIds = new Set((element.activities || []).map((activity) => activity.activityId).filter(Boolean));
  try {
    const alertPayload = await fetchJson(`/api/model-apps/schedule/${encodeURIComponent(initialScheduleId)}/alerts?date=${encodeURIComponent(state.constructionScheduleDate || "")}`);
    const alert = (alertPayload.alerts || []).find((item) =>
      (item.dbIds || []).map(Number).includes(Number(element.dbId)) ||
      activityIds.has(item.activityCode) ||
      activityIds.has(item.activityId),
    );
    if (!alert) {
      setComponentStatus("isolate", "warn", "未找到该滞后构件对应的进度预警，暂不能自动创建 Issue");
      return;
    }
    await fetchJson(`/api/model-apps/schedule/alerts/${encodeURIComponent(alert.id)}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${alert.activityCode || ""} ${alert.activityName || element.name || ""} 进度滞后`.trim(),
        responsible: element.discipline || "",
        note: `Viewer 4D 图层创建：${alert.message || ""}`,
      }),
    });
    setComponentStatus("isolate", "success", "进度 Issue 已创建并关联预警");
  } catch (error) {
    setComponentStatus("isolate", "warn", `进度 Issue 创建失败：${error.message || "未知错误"}`);
  }
}

function saveConstructionScheduleSnapshot() {
  const slot = active3dSlot();
  if (!slot?.viewer?.getScreenShot) {
    setComponentStatus("isolate", "warn", "当前 Viewer 不支持截图导出");
    return;
  }
  const width = Math.max(960, Math.floor(slot.mount?.clientWidth || 1280));
  const height = Math.max(640, Math.floor(slot.mount?.clientHeight || 720));
  try {
    slot.viewer.getScreenShot(width, height, (blobUrl) => {
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `4d-schedule-${state.constructionScheduleDate || "snapshot"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setComponentStatus("isolate", "success", "4D 进度快照已导出为图片");
    });
  } catch (error) {
    setComponentStatus("isolate", "warn", `4D 进度快照导出失败：${error.message || "未知错误"}`);
  }
}

async function loadCss(href) {
  if (!href) {
    return;
  }
  const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
    (item) => item.href === href,
  );
  if (existing) {
    return;
  }
  await new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error("APS Viewer 样式加载失败"));
    document.head.appendChild(link);
  });
}

async function loadScript(src) {
  if (!src) {
    return;
  }
  const existing = Array.from(document.querySelectorAll("script")).find((item) => item.src === src);
  if (existing && window.Autodesk?.Viewing) {
    return;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error("APS Viewer 脚本加载失败"));
    document.head.appendChild(script);
  });
}

async function ensureApsAssets(payload) {
  if (!apsAssetPromise) {
    apsAssetPromise = Promise.all([
      loadCss(payload.viewerCssUrl),
      loadScript(payload.viewerJsUrl),
    ]);
  }
  return apsAssetPromise;
}

async function initializeApsRuntime(tokenUrl, viewerEnv, viewerApi) {
  if (apsRuntimePromise) {
    return apsRuntimePromise;
  }
  apsRuntimePromise = new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        apsRuntimePromise = null;
        reject(new Error("APS Viewer 初始化超时"));
      }
    }, 20000);

    const options = {
      env: safeText(viewerEnv, "AutodeskProduction2"),
      api: safeText(viewerApi, "streamingV2"),
      getAccessToken(onTokenReady) {
        fetchJson(tokenUrl)
          .then((payload) => {
            onTokenReady(payload.access_token, Number(payload.expires_in || 3599));
          })
          .catch((error) => {
            if (!settled) {
              settled = true;
              window.clearTimeout(timeoutId);
              apsRuntimePromise = null;
              reject(error);
            }
          });
      },
    };

    try {
      window.Autodesk.Viewing.Initializer(options, () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeoutId);
          resolve(window.Autodesk.Viewing);
        }
      });
    } catch (error) {
      settled = true;
      window.clearTimeout(timeoutId);
      apsRuntimePromise = null;
      reject(error);
    }
  });
  return apsRuntimePromise;
}

async function loadApsDocument(urn) {
  return new Promise((resolve, reject) => {
    window.Autodesk.Viewing.Document.load(
      `urn:${normalizedUrn(urn)}`,
      resolve,
      (code, message) => reject(new Error(message || `模型加载失败 (${code})`)),
    );
  });
}

function collectViewables(apsDocument) {
  const root = apsDocument.getRoot();
  const items = collectGeometryNodes(root);

  const result = {
    "2d": [],
    "3d": [],
  };

  (items || []).forEach((node) => {
    const role = bubbleRole(node);
    if (!role) {
      return;
    }
    result[role].push({
      guid: bubbleGuid(node),
      name: bubbleName(node),
      role,
      node,
    });
  });

  result["2d"].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  result["3d"].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  return result;
}

function collectGeometryNodes(root) {
  if (!root) {
    return [];
  }

  if (typeof root.search === "function") {
    try {
      const items = root.search({ type: "geometry" }, true);
      if (Array.isArray(items) && items.length) {
        return items;
      }
    } catch {}
  }

  if (typeof window.Autodesk?.Viewing?.Document?.getSubItemsWithProperties === "function") {
    try {
      const items = window.Autodesk.Viewing.Document.getSubItemsWithProperties(
        root,
        { type: "geometry" },
        true,
      );
      if (Array.isArray(items) && items.length) {
        return items;
      }
    } catch {}
  }

  return traverseGeometryNodes(root);
}

function traverseGeometryNodes(root) {
  const result = [];
  const stack = [root];

  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") {
      continue;
    }

    const type = String(node.data?.type || node.type || "").toLowerCase();
    if (type === "geometry") {
      result.push(node);
    }

    const children =
      (typeof node.getChildren === "function" ? node.getChildren() : null) ||
      (Array.isArray(node.children) ? node.children : null) ||
      (Array.isArray(node.data?.children) ? node.data.children : []);

    if (Array.isArray(children) && children.length) {
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push(children[index]);
      }
    }
  }

  return result;
}

async function ensureViewer(slot) {
  if (slot.viewer) {
    return slot.viewer;
  }

  const viewer = new window.Autodesk.Viewing.GuiViewer3D(slot.mount, {
    extensions: [],
  });
  const startCode = viewer.start();
  if (startCode > 0) {
    throw new Error(`${layoutLabel(slot.key)} 初始化失败 (${startCode})`);
  }

  viewer.setTheme?.("light-theme");
  slot.viewer = viewer;
  slot.toolbarReadyPromise = new Promise((resolve) => {
    if (viewer.toolbar) {
      resolve();
      return;
    }
    const onToolbar = () => {
      viewer.removeEventListener(window.Autodesk.Viewing.TOOLBAR_CREATED_EVENT, onToolbar);
      resolve();
    };
    viewer.addEventListener(window.Autodesk.Viewing.TOOLBAR_CREATED_EVENT, onToolbar);
  });

  viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
    handleSelectionChanged(slot, event.dbIdArray || []);
  });
  if (window.Autodesk.Viewing.CAMERA_CHANGE_EVENT) {
    viewer.addEventListener(window.Autodesk.Viewing.CAMERA_CHANGE_EVENT, () => {
      scheduleIssueMarkerRender();
      syncModelDiffSplitCamera(slot);
    });
  }
  if (window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT) {
    viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
      scheduleIssueMarkerRender();
      renderHeatmapOverlayForSlot(slot);
      renderModelDiffOverlayForSlot(slot);
      renderConstructionScheduleOverlayForSlot(slot);
    });
  }

  slot.placeholder.textContent = `正在准备${layoutLabel(slot.key)}...`;
  return viewer;
}

async function ensureToolbarReady(slot) {
  await ensureViewer(slot);
  await slot.toolbarReadyPromise;
}

async function ensureExtension(slot, extensionName, componentKey, successNote) {
  await ensureToolbarReady(slot);
  if (slot.extensions.has(extensionName)) {
    return slot.extensions.get(extensionName);
  }

  const promise = slot.viewer.loadExtension(extensionName);
  slot.extensions.set(extensionName, promise);

  try {
    const extension = await promise;
    if (componentKey) {
      setComponentStatus(componentKey, "success", successNote);
    }
    return extension;
  } catch (error) {
    slot.extensions.delete(extensionName);
    if (componentKey) {
      setComponentStatus(componentKey, "warn", `${successNote} 失败：${error.message || "未知错误"}`);
    }
    throw error;
  }
}

async function ensureSlotExtensions(slot) {
  if (!slot.current) {
    return;
  }

  if (workspace === "model" && slot.role === "3d") {
    try {
      await ensureExtension(
        slot,
        "Autodesk.ModelStructure",
        "modelStructure",
        `${layoutLabel(slot.key)}已装载 Autodesk.ModelStructure`,
      );
    } catch {}
    try {
      await ensureExtension(
        slot,
        "Autodesk.PropertiesManager",
        "properties",
        `${layoutLabel(slot.key)}已装载 Autodesk.PropertiesManager`,
      );
    } catch {}
    try {
      await ensureExtension(slot, "Autodesk.Section", "section", `${layoutLabel(slot.key)}已装载 Autodesk.Section`);
    } catch {}
    try {
      await ensureExtension(slot, "Autodesk.Measure", "measure", `${layoutLabel(slot.key)}已装载 Autodesk.Measure`);
    } catch {}
  }

  if (slot.role === "2d") {
    try {
      await ensureExtension(
        slot,
        "Autodesk.Viewing.MarkupsCore",
        "markupsCore",
        `${layoutLabel(slot.key)}已装载 MarkupsCore`,
      );
    } catch {}
    try {
      await ensureExtension(
        slot,
        "Autodesk.Viewing.MarkupsGui",
        "markupsGui",
        `${layoutLabel(slot.key)}已装载 MarkupsGui`,
      );
    } catch {}
    await hydrateMarkups(slot);
  }
}

function updateSlotHeader(slot) {
  if (!slot.current) {
    slot.title.textContent = slot.key === "secondary" ? "联动视图" : workspace === "drawing" ? "图纸视图" : "主视图";
    slot.meta.textContent = "等待加载";
    setBadge(slot.badge, "--", "neutral");
    return;
  }

  if (slot.modelDiffSide === "before" || slot.modelDiffSide === "after") {
    const task = state.modelDiffDetail?.task || {};
    const versionLabel = slot.modelDiffSide === "before"
      ? task.versionALabel || "版本 A"
      : task.versionBLabel || "版本 B";
    slot.title.textContent = `${versionLabel} · ${roleLabel(slot.role)}`;
    slot.meta.textContent = slot.current.name;
    setBadge(slot.badge, slot.modelDiffSide === "before" ? "A" : "B", "success");
    return;
  }

  const titleBase = workspace === "drawing" && slot.key === "primary" ? "图纸视图" : layoutLabel(slot.key);
  slot.title.textContent = `${titleBase} · ${roleLabel(slot.role)}`;
  slot.meta.textContent = slot.current.name;
  setBadge(slot.badge, slot.role.toUpperCase(), "success");
}

function updateLinkStatus() {
  if (workspace === "drawing") {
    dom.linkStatusChip.textContent = has2dViewables() ? "2D 图纸模式" : "图纸单视图";
    setComponentStatus("linking", "neutral", "图纸工作台固定为 2D 审阅模式，不启用 2D / 3D 联动。");
    return;
  }

  if (state.modelDiffSplitActive) {
    dom.linkStatusChip.textContent = "版本 A/B 分屏";
    setComponentStatus("linking", "success", "已建立模型差异 A/B 分屏，视角和选择会同步到对应构件。");
    return;
  }

  if (hasDualView()) {
    dom.linkStatusChip.textContent = "2D / 3D 联动中";
    setComponentStatus("linking", "success", "已建立双视图联动，支持选择同步");
    return;
  }
  dom.linkStatusChip.textContent = state.layoutMode === "2d" ? "只看 2D" : state.layoutMode === "3d" ? "只看 3D" : "单视图模式";
  const hasBoth = state.viewables["2d"].length > 0 && state.viewables["3d"].length > 0;
  setComponentStatus(
    "linking",
    hasBoth ? "warn" : "neutral",
    hasBoth ? `当前切换为${layoutModeLabel(state.layoutMode)}，未打开联动视图。` : "当前文件只有单一视图类型",
  );
}

function updateSelectionBadge() {
  const primarySelection = state.slots.primary.viewer?.getSelection?.() || [];
  if (primarySelection.length) {
    setBadge(dom.selectionStatusBadge, `已选 ${primarySelection.length}`, "success");
  } else if (state.isolatedDbIds.length) {
    setBadge(dom.selectionStatusBadge, `隔离 ${state.isolatedDbIds.length}`, "warn");
  } else {
    setBadge(dom.selectionStatusBadge, "未选择", "neutral");
  }
}

async function switchLayoutMode(nextMode, overrides = {}) {
  const resolvedMode = normalizedLayoutMode(nextMode);
  const layout = resolveLayoutForMode(resolvedMode, state.payload?.aps || {}, overrides);
  state.layoutMode = resolvedMode;
  syncLayoutModeButtons();
  await configureLayout(layout, {
    primaryState: overrides.primaryState || null,
    secondaryState: overrides.secondaryState || null,
  });
}

async function loadViewableInContext(role, guid) {
  if (workspace === "drawing") {
    await switchLayoutMode("2d", {
      primaryGuid: role === "2d" ? guid : "",
    });
    return;
  }

  if (state.layoutMode === "linked") {
    const targetSlot = activeSlotForRole(role);
    if (!targetSlot) {
      await switchLayoutMode(role, {
        primaryGuid: guid,
      });
      return;
    }
    await loadSlotNode(targetSlot, role, guid);
    renderViewables();
    return;
  }

  if (state.layoutMode === role) {
    await loadSlotNode(state.slots.primary, role, guid);
    renderViewables();
    return;
  }

  await switchLayoutMode(role, {
    primaryGuid: guid,
  });
}

function renderViewables() {
  const renderList = (container, role) => {
    container.innerHTML = "";
    const list = state.viewables[role];
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent =
        role === "2d"
          ? workspace === "drawing"
            ? "当前图纸文件没有生成可审阅的 2D 图纸视图。"
            : "当前模型没有可用于审阅的 2D 图纸。"
          : "当前模型没有可切换的 3D 模型视图。";
      container.appendChild(empty);
      return;
    }

    list.forEach((item) => {
      const row = document.createElement("div");
      row.className = "viewable-row";
      const activeGuid = currentGuidForRole(role);
      row.classList.toggle("active", activeGuid === item.guid);

      const copy = document.createElement("div");
      copy.className = "row-copy";
      const title = document.createElement("strong");
      title.textContent = item.name;
      const meta = document.createElement("span");
      const ownerSlot = activeSlotForRole(role);
      meta.textContent = ownerSlot ? `${workspace === "drawing" ? "图纸视图" : layoutLabel(ownerSlot.key)} · ${item.guid}` : item.guid;
      copy.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "row-actions";
      let actionLabel = "打开";
      if (workspace === "model") {
        if (state.layoutMode === "linked") {
          const targetSlot = activeSlotForRole(role) || state.slots.primary;
          actionLabel = targetSlot.key === "primary" ? "切到主视图" : "切到联动";
        } else if (state.layoutMode !== role) {
          actionLabel = role === "2d" ? "切到只看 2D" : "切到只看 3D";
        } else if (activeGuid === item.guid) {
          actionLabel = "当前视图";
        }
      } else if (activeGuid === item.guid) {
        actionLabel = "当前图纸";
      }
      actions.appendChild(
        createSmallButton(actionLabel, async () => {
          await loadViewableInContext(role, item.guid);
        }, activeGuid === item.guid && (workspace === "drawing" || state.layoutMode === role)),
      );

      row.append(copy, actions);
      container.appendChild(row);
    });
  };

  if (workspace !== "drawing") {
    renderList(dom.viewable3dList, "3d");
  } else {
    dom.viewable3dList.innerHTML = "";
  }
  renderList(dom.viewable2dList, "2d");
  const count = workspace === "drawing" ? state.viewables["2d"].length : state.viewables["2d"].length + state.viewables["3d"].length;
  setBadge(dom.viewableSummary, workspace === "drawing" ? `${count} 张图纸` : `${count} 视图`, count ? "success" : "neutral");
}

function renderSavedViews() {
  const list = state.payload?.aps?.savedViews || [];
  dom.savedViewList.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent =
      workspace === "drawing"
        ? "暂未保存图纸视点。可将当前 2D 图纸视角和标注位置保存为常用审阅位。"
        : "暂未保存视点。可将当前 2D / 3D 组合、镜头与剖切状态保存为审阅位。";
    dom.savedViewList.appendChild(empty);
  } else {
    list.forEach((item) => {
      const row = document.createElement("div");
      row.className = "saved-view-row";
      row.classList.toggle("active", item.id === state.selectedSavedViewId);

      const copy = document.createElement("div");
      copy.className = "row-copy";
      const title = document.createElement("strong");
      title.textContent = item.name;
      const meta = document.createElement("span");
      meta.textContent = `${item.actor || "系统"} · ${formatDateTime(item.createdAt)} · ${workspace === "drawing" ? "2D 图纸" : roleLabel(item.primaryRole)}`;
      copy.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "row-actions";
      actions.appendChild(
        createSmallButton("恢复", async () => {
          state.selectedSavedViewId = item.id;
          renderSavedViews();
          await restoreSavedView(item);
        }),
      );
      actions.appendChild(
        createSmallButton("删除", async () => {
          if (!window.confirm(`确认删除视点“${item.name}”？`)) {
            return;
          }
          const nextSavedViews = list.filter((entry) => entry.id !== item.id);
          await patchAps({ savedViews: nextSavedViews });
          if (state.selectedSavedViewId === item.id) {
            state.selectedSavedViewId = "";
          }
          renderSavedViews();
          pulseButton(dom.saveViewButton, "已更新");
        }),
      );

      row.append(copy, actions);
      dom.savedViewList.appendChild(row);
    });
  }

  setBadge(dom.savedViewCountBadge, `${list.length} 个`, list.length ? "success" : "neutral");
}

function hydrateThemingColors(items) {
  state.themingColors = new Map();
  (items || []).forEach((item) => {
    if (!item || !Array.isArray(item.color) || item.color.length < 4) {
      return;
    }
    const dbId = Number(item.dbId);
    if (!Number.isFinite(dbId) || dbId < 0) {
      return;
    }
    state.themingColors.set(dbId, {
      dbId,
      color: item.color.slice(0, 4).map((value) => Number(value)),
      label: safeText(item.label, "已标色"),
    });
  });
}

function serializeThemingColors() {
  return Array.from(state.themingColors.values()).map((item) => ({
    dbId: item.dbId,
    color: item.color,
    label: item.label,
  }));
}

function clearThemingFromViewer(viewer) {
  if (!viewer) {
    return;
  }
  try {
    viewer.clearThemingColors(viewer.model);
  } catch {
    try {
      viewer.clearThemingColors();
    } catch {}
  }
}

function applyThemingState() {
  const viewers = [state.slots.primary.viewer, state.slots.secondary.viewer].filter(Boolean);
  viewers.forEach((viewer) => {
    clearThemingFromViewer(viewer);
    state.themingColors.forEach((entry) => {
      if (!window.THREE?.Vector4) {
        return;
      }
      viewer.setThemingColor(entry.dbId, new window.THREE.Vector4(...entry.color), viewer.model);
    });
    viewer.impl?.invalidate?.(true);
  });
}

function applyIsolationState(fitToView = false) {
  const viewers = [state.slots.primary.viewer, state.slots.secondary.viewer].filter(Boolean);
  viewers.forEach((viewer) => {
    if (!state.isolatedDbIds.length) {
      try {
        viewer.isolate([]);
      } catch {}
      viewer.showAll?.();
      return;
    }
    viewer.isolate(state.isolatedDbIds);
    if (fitToView) {
      viewer.fitToView?.(state.isolatedDbIds);
    }
  });
}

function buildScenePatch() {
  return {
    layoutMode: state.layoutMode,
    defaultView: state.slots.primary.role || state.payload.aps.defaultView || "auto",
    viewable2dGuid: currentGuidForRole("2d") || state.payload.aps.viewable2dGuid || "",
    viewable3dGuid: currentGuidForRole("3d") || state.payload.aps.viewable3dGuid || "",
    lastViewState: state.slots.primary.viewer?.getState?.() || null,
    linkedViewState: hasDualView() ? state.slots.secondary.viewer?.getState?.() || null : null,
    isolatedDbIds: [...state.isolatedDbIds],
    themingColors: serializeThemingColors(),
  };
}

async function restoreViewerState(slot, savedState) {
  if (!slot.viewer || !savedState) {
    return;
  }
  try {
    slot.viewer.restoreState(savedState);
  } catch {}
}

async function hydrateMarkups(slot) {
  if (slot.role !== "2d") {
    return;
  }
  const markupsCore = await slot.extensions.get("Autodesk.Viewing.MarkupsCore");
  if (!markupsCore) {
    return;
  }

  const markupsSvg = state.payload?.aps?.markupsSvg || "";
  const signature = `${slot.current?.guid || ""}:${markupsSvg.length}`;
  if (slot.markupsSignature === signature) {
    updateMarkupsState();
    return;
  }

  try {
    markupsCore.leaveEditMode?.();
  } catch {}
  try {
    markupsCore.clear?.();
  } catch {}
  try {
    markupsCore.unloadMarkups?.(state.payload.aps.markupLayer || "aps-review");
  } catch {}

  if (markupsSvg) {
    try {
      markupsCore.show?.();
      markupsCore.loadMarkups(markupsSvg, state.payload.aps.markupLayer || "aps-review");
      markupsCore.leaveEditMode?.();
    } catch (error) {
      setComponentStatus("markupsCore", "warn", `标注回放失败：${error.message || "未知错误"}`);
    }
  }

  slot.markupEditing = false;
  slot.markupsSignature = signature;
  updateMarkupsState();
}

function updateMarkupsState() {
  const active2dSlot = activeSlotForRole("2d");
  if (!state.viewables["2d"].length) {
    setBadge(dom.markupsStatusBadge, "不可用", "warn");
    dom.markupsMeta.textContent = "当前模型没有 2D 图纸视图，无法启用 MarkupsCore + MarkupsGui。";
    syncMarkupsToolbarState();
    return;
  }

  if (!active2dSlot || !active2dSlot.current) {
    setBadge(dom.markupsStatusBadge, "待切换", "neutral");
    dom.markupsMeta.textContent = "请先打开 2D 图纸视图，再进入标注模式。";
    syncMarkupsToolbarState();
    return;
  }

  if (active2dSlot.markupEditing) {
    setBadge(dom.markupsStatusBadge, "编辑中", "success");
    dom.markupsMeta.textContent = `${layoutLabel(active2dSlot.key)}正在编辑 2D 标注，完成后可直接保存到当前文件。`;
    syncMarkupsToolbarState();
    return;
  }

  const hasSavedMarkups = Boolean(state.payload?.aps?.markupsSvg);
  setBadge(dom.markupsStatusBadge, hasSavedMarkups ? "已加载" : "待标注", hasSavedMarkups ? "success" : "neutral");
  dom.markupsMeta.textContent = hasSavedMarkups
    ? `最近更新：${state.payload.aps.markupsUpdatedBy || actor} · ${formatDateTime(state.payload.aps.markupsUpdatedAt) || "刚刚"}`
    : "只有 2D 图纸视图启用 MarkupsCore + MarkupsGui。";
  syncMarkupsToolbarState();
}

async function loadSlotDocumentNode(slot, apsDocument, entry, options = {}) {
  const viewer = await ensureViewer(slot);
  clearHeatmapOverlay(slot);
  slot.placeholder.classList.remove("hidden");
  slot.placeholder.textContent = `正在加载${entry.name}...`;
  slot.role = entry.role;
  slot.current = entry;
  slot.apsDocument = apsDocument || state.apsDocument;
  updateSlotHeader(slot);

  await viewer.loadDocumentNode(slot.apsDocument, entry.node, {
    keepCurrentModels: false,
    preserveView: false,
  });

  await ensureSlotExtensions(slot);
  await restoreViewerState(slot, options.restoreState || null);
  if (!state.modelDiffSplitActive) {
    applyIsolationState(false);
    applyThemingState();
  }
  if (state.activeIssueId && slot.role === "3d") {
    applyIssueHighlight(state.issues.find((issue) => issue.id === state.activeIssueId));
  }
  renderHeatmapOverlay();
  renderModelDiffOverlay();
  slot.placeholder.classList.add("hidden");
  renderViewables();
  updateLinkStatus();
  updateSelectionBadge();
  updateMarkupsState();
  scheduleIssueMarkerRender();
}

async function loadSlotNode(slot, role, guid, options = {}) {
  const entry = guid === NONE_GUID ? null : findViewable(role, guid);
  if (!entry) {
    if (slot.key === "secondary") {
      clearHeatmapOverlay(slot);
      slot.role = "";
      slot.current = null;
      slot.modelDiffSide = "";
      slot.apsDocument = null;
      updateSlotHeader(slot);
      updateLinkStatus();
      renderViewables();
      return;
    }
    throw new Error(`${roleLabel(role)} 不存在可加载视图`);
  }
  slot.modelDiffSide = "";
  await loadSlotDocumentNode(slot, state.apsDocument, entry, options);
}

function resetSecondarySlot() {
  clearHeatmapOverlay(state.slots.secondary);
  state.slots.secondary.role = "";
  state.slots.secondary.current = null;
  state.slots.secondary.modelDiffSide = "";
  state.slots.secondary.apsDocument = null;
  state.slots.secondary.markupEditing = false;
  syncMarkupsToolbarState();
  updateSlotHeader(state.slots.secondary);
}

function findViewableInCollection(viewables, role, guid = "") {
  const list = Array.isArray(viewables?.[role]) ? viewables[role] : [];
  return (
    (guid ? list.find((item) => item.guid === guid) : null) ||
    list[0] ||
    null
  );
}

function modelDiffSnapshotUrn(snapshotId) {
  const id = safeText(snapshotId, "");
  const snapshots = Array.isArray(state.modelDiffDetail?.snapshots) ? state.modelDiffDetail.snapshots : [];
  return safeText(snapshots.find((snapshot) => snapshot.id === id)?.modelUrn, "");
}

function modelDiffTaskUrn(side) {
  const task = state.modelDiffDetail?.task || {};
  if (side === "before") {
    return safeText(task.modelUrnA || modelDiffSnapshotUrn(task.snapshotAId), "");
  }
  return safeText(task.modelUrnB || modelDiffSnapshotUrn(task.snapshotBId) || state.payload?.aps?.urn, "");
}

async function configureModelDiffSplitLayout() {
  const task = state.modelDiffDetail?.task || {};
  const beforeUrn = modelDiffTaskUrn("before");
  const afterUrn = modelDiffTaskUrn("after");
  if (!beforeUrn || !afterUrn) {
    throw new Error("模型差异分屏缺少版本 A 或版本 B 的 APS URN。");
  }

  const afterDocument = normalizedUrn(afterUrn) === normalizedUrn(state.payload?.aps?.urn)
    ? state.apsDocument
    : await loadApsDocument(afterUrn);
  const beforeDocument = normalizedUrn(beforeUrn) === normalizedUrn(afterUrn)
    ? afterDocument
    : await loadApsDocument(beforeUrn);
  const beforeViewables = collectViewables(beforeDocument);
  const afterViewables = collectViewables(afterDocument);
  const before3d = findViewableInCollection(beforeViewables, "3d", state.payload?.aps?.viewable3dGuid || "");
  const after3d = findViewableInCollection(afterViewables, "3d", state.payload?.aps?.viewable3dGuid || "");
  if (!before3d || !after3d) {
    throw new Error("模型差异分屏需要两个版本都具备 3D viewable。");
  }

  state.modelDiffSplitActive = true;
  state.layoutMode = "3d";
  state.slots.primary.modelDiffSide = "after";
  state.slots.secondary.modelDiffSide = "before";
  dom.secondaryViewerCard.classList.remove("hidden");
  dom.viewerGrid.classList.add("linked", "model-diff-split");
  syncLayoutModeButtons();

  await loadSlotDocumentNode(state.slots.primary, afterDocument, after3d);
  await loadSlotDocumentNode(state.slots.secondary, beforeDocument, before3d);
  updateSlotHeader(state.slots.primary);
  updateSlotHeader(state.slots.secondary);
  setComponentStatus(
    "linking",
    "success",
    `${task.versionALabel || "版本 A"} 与 ${task.versionBLabel || "版本 B"} 已进入 A/B 分屏对比。`,
  );
  updateLinkStatus();
  renderModelDiffOverlay();
}

async function configureLayout(layout, restoreStates = {}) {
  state.modelDiffSplitActive = false;
  state.slots.primary.modelDiffSide = "";
  state.slots.primary.apsDocument = state.apsDocument;
  dom.viewerGrid.classList.remove("model-diff-split");
  await loadSlotNode(state.slots.primary, layout.primaryRole, layout.primaryGuid, {
    restoreState: restoreStates.primaryState || null,
  });

  const needsSecondary = Boolean(layout.secondaryRole && layout.secondaryGuid && layout.secondaryGuid !== NONE_GUID);
  dom.secondaryViewerCard.classList.toggle("hidden", !needsSecondary);
  dom.viewerGrid.classList.toggle("linked", needsSecondary);

  if (needsSecondary) {
    await loadSlotNode(state.slots.secondary, layout.secondaryRole, layout.secondaryGuid, {
      restoreState: restoreStates.secondaryState || null,
    });
  } else {
    resetSecondarySlot();
    updateLinkStatus();
    renderViewables();
  }
}

function handleSelectionChanged(slot, dbIds) {
  updateSelectionBadge();
  updateActiveConstructionScheduleFromSelection(normalizeDbIds(dbIds));
  if (state.modelDiffSplitActive) {
    syncModelDiffSplitSelection(slot, normalizeDbIds(dbIds));
    return;
  }
  if (state.selectionSyncLocked || !hasDualView()) {
    return;
  }

  const otherSlot = slot.key === "primary" ? state.slots.secondary : state.slots.primary;
  if (!otherSlot.viewer) {
    return;
  }

  state.selectionSyncLocked = true;
  try {
    otherSlot.viewer.select(dbIds);
  } finally {
    window.setTimeout(() => {
      state.selectionSyncLocked = false;
    }, 0);
  }
}

function syncModelDiffSplitSelection(slot, dbIds) {
  if (state.selectionSyncLocked || !state.modelDiffSplitActive || !dbIds.length) {
    return;
  }
  const otherSlot = slot.key === "primary" ? state.slots.secondary : state.slots.primary;
  if (!otherSlot.viewer || !slot.modelDiffSide || !otherSlot.modelDiffSide) {
    return;
  }
  const records = Array.isArray(state.modelDiffDetail?.records) ? state.modelDiffDetail.records : [];
  const sourceField = slot.modelDiffSide === "before" ? "dbIdBefore" : "dbIdAfter";
  const targetField = otherSlot.modelDiffSide === "before" ? "dbIdBefore" : "dbIdAfter";
  const dbIdSet = new Set(dbIds.map((dbId) => Number(dbId)));
  const targetIds = records
    .filter((record) => dbIdSet.has(Number(record[sourceField])))
    .map((record) => Number(record[targetField]))
    .filter(Number.isFinite);
  if (!targetIds.length) {
    return;
  }
  state.selectionSyncLocked = true;
  try {
    otherSlot.viewer.select([...new Set(targetIds)]);
  } finally {
    window.setTimeout(() => {
      state.selectionSyncLocked = false;
    }, 0);
  }
}

function syncModelDiffSplitCamera(slot) {
  if (state.modelDiffCameraSyncLocked || !state.modelDiffSplitActive || !slot?.viewer) {
    return;
  }
  const otherSlot = slot.key === "primary" ? state.slots.secondary : state.slots.primary;
  if (!otherSlot.viewer) {
    return;
  }
  const navigation = slot.viewer.navigation;
  const otherNavigation = otherSlot.viewer.navigation;
  if (!navigation || !otherNavigation) {
    return;
  }
  state.modelDiffCameraSyncLocked = true;
  try {
    otherNavigation.setView?.(navigation.getPosition?.(), navigation.getTarget?.());
    const up = navigation.getCameraUpVector?.();
    if (up) {
      otherNavigation.setCameraUpVector?.(up);
    }
    otherSlot.viewer.impl?.invalidate?.(true);
  } catch {
    // Camera sync is best-effort because APS Viewer APIs differ across versions.
  } finally {
    window.setTimeout(() => {
      state.modelDiffCameraSyncLocked = false;
    }, 0);
  }
}

function currentPrimarySelection() {
  return state.slots.primary.viewer?.getSelection?.() || [];
}

function runIssueAction(task) {
  return Promise.resolve()
    .then(task)
    .catch((error) => {
      const message = localizeUserMessage(error.message, "Issue operation failed. Please try again later.");
      dom.issueMeta.textContent = message;
      window.alert(message);
    });
}

function vectorToArray(vector) {
  if (!vector) {
    return [];
  }
  return [Number(vector.x), Number(vector.y), Number(vector.z)].filter(Number.isFinite);
}

function captureViewerState(viewer) {
  const viewerState = viewer?.getState?.() || {};
  const navigation = viewer?.navigation;
  const camera = navigation?.getCamera?.();
  if (!viewerState.viewport && camera) {
    viewerState.viewport = {
      eye: vectorToArray(camera.position),
      target: vectorToArray(navigation.getTarget?.()),
      up: vectorToArray(camera.up),
    };
  }
  return viewerState;
}

function propertyValue(properties, names) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const props = Array.isArray(properties?.properties) ? properties.properties : [];
  const match = props.find((item) => {
    const displayName = safeText(item.displayName || item.name || item.attributeName, "").toLowerCase();
    return wanted.has(displayName);
  });
  const rawValue = match?.displayValue ?? match?.value;
  return rawValue === undefined || rawValue === null ? "" : String(rawValue).trim();
}

function getViewerProperties(viewer, dbId) {
  return new Promise((resolve) => {
    if (!viewer?.getProperties || !Number.isFinite(dbId)) {
      resolve(null);
      return;
    }
    viewer.getProperties(
      dbId,
      (result) => resolve(result),
      () => resolve(null),
    );
  });
}

async function stableIdsForDbId(viewer, dbId) {
  const properties = await getViewerProperties(viewer, dbId);
  if (!properties) {
    return {};
  }
  const uniqueId = propertyValue(properties, ["UniqueId", "Unique ID", "GUID", "Handle"]);
  const elementId = propertyValue(properties, ["ElementId", "Element ID", "Id"]);
  return {
    elementUniqueId: uniqueId,
    elementId,
  };
}

async function buildIssuePayloadFromCurrentView() {
  if (!active3dSlot() && workspace === "model") {
    await switchLayoutMode("3d");
  }
  const slot = active3dSlot();
  if (!slot?.viewer) {
    throw new Error("当前没有可记录的 3D 模型视图。");
  }

  const dbIds = normalizeDbIds(slot.viewer.getSelection?.() || []);
  const stableIds = dbIds.length ? await stableIdsForDbId(slot.viewer, dbIds[0]) : {};
  const title = safeText(dom.issueTitleInput.value, dbIds.length ? `构件 Issue · dbId ${dbIds[0]}` : "区域 Issue");
  const note = safeText(dom.issueNoteInput.value, "未填写说明");

  return {
    type: "mark",
    variant: "issue",
    page: 1,
    x: 0.5,
    y: 0.5,
    width: 0.12,
    height: 0.08,
    title,
    note,
    actor,
    color: "red",
    status: "open",
    viewerState: captureViewerState(slot.viewer),
    dbIds,
    modelUrn: state.payload?.aps?.urn || "",
    sheetGuid: currentGuidForRole("2d") || "",
    elementUniqueId: stableIds.elementUniqueId || "",
    elementId: stableIds.elementId || "",
    boundModelVersion: state.payload?.file?.version || "",
    migrationStatus: "synced",
  };
}

async function createIssueAtCurrentView() {
  const payload = await buildIssuePayloadFromCurrentView();
  const response = await fetchJson(`/api/documents/${encodeURIComponent(docId)}/annotations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  hydrateIssues(response.document?.annotations || [response.annotation, ...state.issues]);
  state.activeIssueId = response.annotation?.id || "";
  dom.issueTitleInput.value = "";
  dom.issueNoteInput.value = "";
  renderIssueList();
  await focusIssueById(state.activeIssueId);
  dom.issueMeta.textContent = payload.dbIds.length
    ? `已记录 ${payload.dbIds.length} 个构件、当前镜头和稳定标识。`
    : "已记录当前区域视角。";
}

async function rebindActiveIssueToSelection() {
  const issue = state.issues.find((item) => item.id === state.activeIssueId);
  if (!issue) {
    throw new Error("请先选择一条需要重新绑定的 Issue。");
  }
  const slot = active3dSlot();
  const viewer = slot?.viewer;
  if (!viewer) {
    throw new Error("当前没有可重新绑定的 3D 模型视图。");
  }
  const dbIds = normalizeDbIds(viewer.getSelection?.() || []);
  if (!dbIds.length) {
    throw new Error("请先在模型中选择新的关联构件。");
  }
  const stableIds = await stableIdsForDbId(viewer, dbIds[0]);
  const response = await fetchJson(`/api/documents/${encodeURIComponent(docId)}/annotations/${encodeURIComponent(issue.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor,
      dbIds,
      viewerState: captureViewerState(viewer),
      modelUrn: state.payload?.aps?.urn || "",
      sheetGuid: currentGuidForRole("2d") || "",
      elementUniqueId: stableIds.elementUniqueId || issue.elementUniqueId || "",
      elementId: stableIds.elementId || issue.elementId || "",
      boundModelVersion: state.payload?.file?.version || "",
      migrationStatus: "synced",
    }),
  });
  hydrateIssues(response.document?.annotations || state.issues);
  state.activeIssueId = issue.id;
  renderIssueList();
  await focusIssueById(issue.id);
  dom.issueMeta.textContent = `已将 Issue 重新绑定到 dbId ${dbIds.join(", ")}。`;
}

function applyIssueHighlight(issue) {
  const slot = active3dSlot();
  const viewer = slot?.viewer;
  if (!viewer || !issue?.dbIds?.length) {
    return;
  }
  applyThemingState();
  if (window.THREE?.Vector4) {
    issue.dbIds.forEach((dbId) => {
      viewer.setThemingColor(dbId, new window.THREE.Vector4(0.93, 0.18, 0.14, 1), viewer.model);
    });
    viewer.impl?.invalidate?.(true);
  }
  viewer.select?.(issue.dbIds);
  viewer.fitToView?.(issue.dbIds);
}

async function focusIssueById(issueId) {
  const issue = state.issues.find((item) => item.id === issueId);
  if (!issue) {
    return;
  }

  state.activeIssueId = issue.id;
  renderIssueList();
  if (!active3dSlot() && workspace === "model") {
    await switchLayoutMode("3d");
  }
  const slot = active3dSlot();
  if (slot?.viewer && issue.viewerState) {
    await restoreViewerState(slot, issue.viewerState);
  }
  applyIssueHighlight(issue);
  dom.issueMeta.textContent = issue.dbIds?.length
    ? `已定位到 ${issue.dbIds.length} 个关联构件。`
    : "已恢复该 Issue 保存的模型视角。";
  scheduleIssueMarkerRender();
}

async function focusInitialDbIds() {
  const dbIds = dbIdsFromQueryParam(initialDbIdsParam);
  const referenceDbIds = dbIdsFromQueryParam(initialReferenceDbIdsParam);
  const allDbIds = normalizeDbIds([...dbIds, ...referenceDbIds]);
  if (!allDbIds.length || workspace !== "model") {
    return;
  }
  if (!active3dSlot()) {
    await switchLayoutMode("3d");
  }
  const slot = active3dSlot();
  const viewer = slot?.viewer;
  if (!viewer) {
    return;
  }
  applyThemingState();
  if (window.THREE?.Vector4) {
    referenceDbIds.forEach((dbId) => {
      viewer.setThemingColor(dbId, new window.THREE.Vector4(0.14, 0.49, 0.94, 1), viewer.model);
    });
    dbIds.forEach((dbId) => {
      viewer.setThemingColor(dbId, new window.THREE.Vector4(0.96, 0.48, 0.12, 1), viewer.model);
    });
    viewer.impl?.invalidate?.(true);
  }
  viewer.select?.(dbIds.length ? dbIds : allDbIds);
  viewer.fitToView?.(allDbIds);
  setComponentStatus("isolate", "success", `已定位健康度问题 ${allDbIds.length} 个构件`);
  dom.issueMeta.textContent = initialHealthResultId
    ? `已定位健康度问题 ${initialHealthResultId}，涉及 ${allDbIds.length} 个构件。`
    : `已定位 ${allDbIds.length} 个构件。`;
}

async function saveSceneState() {
  await patchAps(buildScenePatch());
  setComponentStatus("savedViews", "success", "已持久化当前 scene state，可用于 reopen restoreState");
  pulseButton(dom.saveSceneButton, "场景已保存");
}

async function saveNamedView() {
  if (!state.slots.primary.viewer || !state.slots.primary.current) {
    throw new Error("主视图尚未完成加载");
  }

  const viewName = safeText(
    dom.savedViewNameInput.value,
    `${workspace === "drawing" ? "图纸审阅位" : roleLabel(state.slots.primary.role)} · ${formatDateTime(new Date().toISOString())}`,
  );

  const nextSavedViews = [
    {
      id: crypto.randomUUID(),
      name: viewName,
      actor,
      createdAt: new Date().toISOString(),
      layoutMode: state.layoutMode,
      primaryRole: state.slots.primary.role,
      secondaryRole: hasDualView() ? state.slots.secondary.role || "" : "",
      primaryGuid: state.slots.primary.current?.guid || "",
      secondaryGuid: hasDualView() ? state.slots.secondary.current?.guid || NONE_GUID : NONE_GUID,
      primaryState: state.slots.primary.viewer.getState(),
      secondaryState: hasDualView() ? state.slots.secondary.viewer.getState() : null,
    },
    ...(state.payload?.aps?.savedViews || []),
  ];

  await patchAps({ savedViews: nextSavedViews });
  dom.savedViewNameInput.value = "";
  renderSavedViews();
  pulseButton(dom.saveViewButton, "已保存");
}

async function restoreSavedView(savedView) {
  const inferredMode =
    workspace === "drawing"
      ? "2d"
      : savedView.layoutMode || (savedView.secondaryGuid && savedView.secondaryGuid !== NONE_GUID ? "linked" : savedView.primaryRole || state.layoutMode);

  await switchLayoutMode(inferredMode, {
    primaryRole: savedView.primaryRole || state.slots.primary.role || "3d",
    primaryGuid: savedView.primaryGuid || currentGuidForRole(savedView.primaryRole) || "",
    secondaryGuid: savedView.secondaryGuid === NONE_GUID ? "" : savedView.secondaryGuid || "",
    primaryState: savedView.primaryState || null,
    secondaryState: savedView.secondaryState || null,
  });
  pulseButton(dom.saveViewButton, "已恢复");
}

async function isolateSelection() {
  const selection = currentPrimarySelection();
  if (!selection.length) {
    throw new Error("请先在主视图中选择构件");
  }
  state.isolatedDbIds = [...selection];
  applyIsolationState(true);
  await patchAps({ isolatedDbIds: state.isolatedDbIds });
  setComponentStatus("isolate", "success", `已隔离 ${selection.length} 个构件`);
  updateSelectionBadge();
}

async function clearIsolation() {
  state.isolatedDbIds = [];
  applyIsolationState(false);
  await patchAps({ isolatedDbIds: [] });
  setComponentStatus("isolate", "neutral", "隔离状态已清空");
  updateSelectionBadge();
}

async function applyThemePreset(presetKey) {
  const preset = THEME_PRESETS[presetKey];
  if (!preset) {
    return;
  }
  const selection = currentPrimarySelection();
  if (!selection.length) {
    throw new Error("请先在主视图中选择构件");
  }

  selection.forEach((dbId) => {
    state.themingColors.set(dbId, {
      dbId,
      color: preset.color,
      label: preset.label,
    });
  });

  applyThemingState();
  await patchAps({ themingColors: serializeThemingColors() });
  setComponentStatus("isolate", "success", `已为 ${selection.length} 个构件应用${preset.label}`);
}

async function clearTheming() {
  state.themingColors.clear();
  applyThemingState();
  await patchAps({ themingColors: [] });
  setComponentStatus("isolate", "neutral", "构件着色已清空");
}

async function enterMarkups() {
  const slot = activeSlotForRole("2d");
  if (!slot || !slot.current) {
    throw new Error("当前没有打开 2D 图纸视图");
  }

  const { core, gui } = await markupsExtensions(slot);

  core.show?.();
  core.enterEditMode?.();
  applyDefaultMarkupStyle(core);
  showMarkupsGui(gui);
  slot.markupEditing = true;
  ensureMarkupsToolbar(slot);
  await activateMarkupTool(slot, slot.activeMarkupTool || "freehand");
  updateMarkupsState();
  pulseButton(dom.enterMarkupsButton, "标注已开启");
}

async function saveMarkups() {
  const slot = activeSlotForRole("2d");
  if (!slot || !slot.current) {
    throw new Error("当前没有打开 2D 图纸视图");
  }

  const { core } = await markupsExtensions(slot);

  const markupsSvg = safeText(core.generateData?.(), "");
  slot.markupEditing = false;
  slot.markupsSignature = `${slot.current.guid}:${markupsSvg.length}`;
  core.leaveEditMode?.();
  core.show?.();
  syncMarkupsToolbarState();

  await patchAps({
    markupsSvg,
    markupsUpdatedAt: new Date().toISOString(),
    markupsUpdatedBy: actor,
    viewable2dGuid: slot.current.guid,
  });
  updateMarkupsState();
  pulseButton(dom.saveMarkupsButton, markupsSvg ? "已保存" : "已清空");
}

async function clearMarkups() {
  const slot = activeSlotForRole("2d");
  if (!slot || !slot.current) {
    throw new Error("当前没有打开 2D 图纸视图");
  }
  if (!window.confirm("确认清空当前文件的 2D 标注吗？")) {
    return;
  }

  const { core } = await markupsExtensions(slot);
  core.leaveEditMode?.();
  core.clear?.();
  try {
    core.unloadMarkups?.(state.payload.aps.markupLayer || "aps-review");
  } catch {}

  slot.markupEditing = false;
  slot.markupsSignature = `${slot.current.guid}:0`;
  syncMarkupsToolbarState();
  await patchAps({
    markupsSvg: "",
    markupsUpdatedAt: new Date().toISOString(),
    markupsUpdatedBy: actor,
  });
  updateMarkupsState();
  pulseButton(dom.clearMarkupsButton, "已清空");
}

function configureComponentAvailability() {
  setComponentStatus("navigation", "success", "APS Viewer 默认导航与工具栏已启用");
  setComponentStatus("savedViews", "success", "支持 getState / restoreState 保存与恢复视点");
  setComponentStatus("markupsCore", "neutral", "等待 2D 图纸视图加载");
  setComponentStatus("markupsGui", "neutral", "等待 2D 标注工具栏加载");

  if (workspace === "drawing") {
    setComponentStatus("linking", "neutral", "图纸工作台固定为 2D 审阅模式");
    setComponentStatus("isolate", "neutral", "图纸模式不启用隔离 / 着色");
    setComponentStatus("modelStructure", "neutral", "图纸模式不展示模型导航树");
    setComponentStatus("properties", "neutral", "图纸模式不展示构件属性面板");
    setComponentStatus("section", "neutral", "图纸模式不启用 3D 剖切");
    setComponentStatus("measure", "neutral", "图纸模式不启用 3D 测量");
  } else {
    setComponentStatus("linking", "neutral", "可切换联动查看 / 只看 2D / 只看 3D");
    setComponentStatus("isolate", "success", "支持 isolate / setThemingColor 审阅构件");
    if (!state.viewables["3d"].length) {
      setComponentStatus("modelStructure", "warn", "当前文件没有 3D 视图，模型树不可用");
      setComponentStatus("properties", "warn", "当前文件没有 3D 视图，属性面板不可用");
      setComponentStatus("section", "warn", "当前文件没有 3D 视图，剖切不可用");
      setComponentStatus("measure", "warn", "当前文件没有 3D 视图，测量不可用");
    } else {
      setComponentStatus("modelStructure", "neutral", "待 3D 模型视图装载后启用");
      setComponentStatus("properties", "neutral", "待 3D 模型视图装载后启用");
      setComponentStatus("section", "neutral", "待 3D 模型视图装载后启用");
      setComponentStatus("measure", "neutral", "待 3D 模型视图装载后启用");
    }
  }

  if (!state.viewables["2d"].length) {
    setComponentStatus("markupsCore", "warn", "当前文件没有 2D 图纸，标注不可用");
    setComponentStatus("markupsGui", "warn", "当前文件没有 2D 图纸，标注工具栏不可用");
  }
}

function showSetup(payload) {
  const labels = workspaceLabels();
  document.title = `${labels.apsWorkspace}尚未就绪`;
  dom.pageTitle.textContent = `${labels.apsWorkspace}尚未就绪`;
  setPageMeta([`${labels.workspace}未成功启用`]);

  const lines = [];
  if (payload.reason === "missing_credentials") {
    lines.push("请先到系统设置 / APS 配置中填写并启用 APS 凭证：");
    lines.push("");
    lines.push("1. APS Client ID");
    lines.push("2. APS Client Secret");
    lines.push("3. Bucket 与 Viewer 运行参数");
    lines.push("");
    lines.push("保存后重新打开当前工作台。");
  } else if (payload.reason === "missing_urn") {
    lines.push("请回到文件管理页，在“文件属性 -> APS 配置”中填写：");
    lines.push("");
    lines.push(`1. ${labels.asset} URN`);
    lines.push("2. 可选的 2D 图纸 GUID");
    if (workspace === "model") {
      lines.push("3. 可选的 3D 模型 GUID");
    }
    lines.push("");
    lines.push(`保存后重新打开${labels.workspace}即可。`);
  } else {
    lines.push(`请确认当前文件是否已完成 APS 转换，并且具备可访问的${labels.asset} URN。`);
  }

  updateOverlay(`${labels.apsWorkspace}未就绪`, payload.message || `当前无法打开 APS ${labels.workspace}。`, lines.join("\n"));
}

function bindActions() {
  dom.backButton.addEventListener("click", leaveWorkspace);
  window.addEventListener("resize", scheduleIssueMarkerRender);
  dom.layoutModeLinkedButton.addEventListener("click", () => {
    void switchLayoutMode("linked");
  });
  dom.layoutMode2dButton.addEventListener("click", () => {
    void switchLayoutMode("2d");
  });
  dom.layoutMode3dButton.addEventListener("click", () => {
    void switchLayoutMode("3d");
  });
  dom.saveSceneButton.addEventListener("click", () => {
    void runButtonAction(dom.saveSceneButton, "保存中...", saveSceneState, "已保存");
  });
  dom.saveViewButton.addEventListener("click", () => {
    void runButtonAction(dom.saveViewButton, "保存中...", saveNamedView, "已保存");
  });
  dom.createIssueButton.addEventListener("click", () => {
    void runButtonAction(dom.createIssueButton, "记录中...", createIssueAtCurrentView, "已记录");
  });
  dom.rebindIssueButton.addEventListener("click", () => {
    void runButtonAction(dom.rebindIssueButton, "绑定中...", rebindActiveIssueToSelection, "已绑定");
  });
  dom.enterMarkupsButton.addEventListener("click", () => {
    void runButtonAction(dom.enterMarkupsButton, "开启中...", enterMarkups, "已开启");
  });
  dom.saveMarkupsButton.addEventListener("click", () => {
    void runButtonAction(dom.saveMarkupsButton, "保存中...", saveMarkups, "已保存");
  });
  dom.clearMarkupsButton.addEventListener("click", () => {
    void runButtonAction(dom.clearMarkupsButton, "清空中...", clearMarkups, "已清空");
  });
  dom.isolateButton.addEventListener("click", () => {
    void runButtonAction(dom.isolateButton, "隔离中...", isolateSelection, "已隔离");
  });
  dom.clearIsolationButton.addEventListener("click", () => {
    void runButtonAction(dom.clearIsolationButton, "清除中...", clearIsolation, "已清除");
  });
  dom.clearThemingButton.addEventListener("click", () => {
    void runButtonAction(dom.clearThemingButton, "清除中...", clearTheming, "已清空");
  });
  dom.themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const preset = button.dataset.themeColor || "";
      void runButtonAction(button, "着色中...", () => applyThemePreset(preset), "已着色");
    });
  });
  dom.modelDiffRecordList?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-model-diff-viewer-record]") : null;
    if (button instanceof HTMLButtonElement) {
      focusModelDiffRecord(button.dataset.modelDiffViewerRecord || "");
    }
  });
  dom.modelDiffRecordDetail?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("#modelDiffCreateIssueButton") : null;
    if (button instanceof HTMLButtonElement && !button.disabled) {
      button.disabled = true;
      void createIssueFromActiveModelDiffRecord().finally(() => {
        button.disabled = false;
      });
    }
  });
}

async function boot() {
  const labels = workspaceLabels();
  if (dom.topbarKicker) {
    dom.topbarKicker.textContent = labels.apsWorkspace;
  }
  syncWorkspaceChrome();
  bindActions();

  if (!docId) {
    updateOverlay("缺少文档参数", `当前页面没有拿到 docId，无法打开 APS ${labels.workspace}。`);
    return;
  }

  try {
    updateOverlay(`正在连接 ${labels.apsWorkspace}`, `稍等一下，我们会拉取${labels.asset}配置、Viewer 资源和鉴权信息。`);

    const query = new URLSearchParams();
    if (actor) query.set("actor", actor);
    if (mode) query.set("mode", mode);
    if (versionId) query.set("versionId", versionId);
    if (initialModelDiffTaskId) query.set("modelDiffTaskId", initialModelDiffTaskId);
    if (initialScheduleId) query.set("scheduleId", initialScheduleId);
    if (initialScheduleDate) query.set("scheduleDate", initialScheduleDate);

    const response = await fetch(`/api/aps/documents/${encodeURIComponent(docId)}/config?${query.toString()}`, {
      credentials: "same-origin",
    });
    const payload = await readJson(response);
    if (!response.ok) {
      const serverMessage = [payload.error, payload.message].find(Boolean);
      throw new Error(localizeUserMessage(serverMessage, t("APS 配置获取失败", "Failed to load APS configuration")));
    }

    if (!payload.enabled) {
      showSetup(payload);
      return;
    }

    state.payload = payload;
    if (payload.versionLocked && dom.saveSceneButton) {
      dom.saveSceneButton.disabled = true;
      dom.saveSceneButton.title = "历史版本或差异对比视图不写回当前模型视点";
    }
    hydrateThemingColors(payload.aps.themingColors);
    state.isolatedDbIds = Array.isArray(payload.aps.isolatedDbIds) ? [...payload.aps.isolatedDbIds] : [];
    hydrateIssues(payload.issues || []);

    await ensureApsAssets(payload);
    await initializeApsRuntime(payload.tokenUrl, payload.viewerEnv, payload.viewerApi);

    updateOverlay(`正在拉取${labels.asset}`, `Viewer 已就绪，正在加载 APS ${labels.asset}与可用视图。`);

    state.apsDocument = await loadApsDocument(payload.aps.urn);
    state.viewables = collectViewables(state.apsDocument);
    configureComponentAvailability();
    syncLayoutModeButtons();
    await hydrateInitialHeatmap();
    await hydrateInitialModelDiff();
    await hydrateInitialConstructionSchedule();

    const totalViewables = state.viewables["2d"].length + state.viewables["3d"].length;
    if (!totalViewables) {
      throw new Error("当前 URN 未找到可加载的 2D / 3D viewable");
    }

    let layoutConfigured = false;
    state.layoutMode = normalizedLayoutMode(payload.aps.layoutMode || state.layoutMode);
    if (state.modelDiffDetail && initialModelDiffViewMode === "split") {
      try {
        await configureModelDiffSplitLayout();
        layoutConfigured = true;
      } catch (error) {
        setComponentStatus("linking", "warn", `模型差异分屏不可用，已回退到叠加模式：${error.message || "未知错误"}`);
      }
    }
    if (!layoutConfigured) {
      if ((state.heatmapDetail && initialHeatmapVisible || state.modelDiffDetail || state.constructionScheduleDetail) && state.viewables["3d"].length) {
        state.layoutMode = "3d";
      }
      const initialLayout = resolveLayoutForMode(state.layoutMode, payload.aps);
      await configureLayout(initialLayout, {
        primaryState: payload.aps.lastViewState || null,
        secondaryState: payload.aps.linkedViewState || null,
      });
      syncLayoutModeButtons();
    }

    renderViewables();
    renderSavedViews();
    renderIssueList();
    updateSelectionBadge();
    updateMarkupsState();
    updateLinkStatus();

    document.title = localizeStandaloneText(`${payload.file.name} - ${labels.apsWorkspace}`);
    dom.pageTitle.textContent = payload.file.name;
    setPageMeta([
      workspace === "drawing" ? "2D 图纸工作台" : layoutModeLabel(state.layoutMode),
      `${mode === "review" ? "审阅模式" : "查看模式"} · ${payload.viewerVersion}`,
      `${payload.file.folder || "根目录"} · ${payload.file.version || "当前版本"}`,
      `${payload.actor || actor} · 更新于 ${formatDateTime(payload.file.updatedAt)}`,
    ]);

    hideOverlay();
    if (initialIssueId) {
      await focusIssueById(initialIssueId);
    } else {
      await focusInitialDbIds();
    }
    renderModelDiffOverlay();
    renderConstructionScheduleOverlay();
  } catch (error) {
    document.title = localizeStandaloneText(`${labels.apsWorkspace}打开失败`);
    dom.pageTitle.textContent = localizeStandaloneText(`${labels.apsWorkspace}打开失败`);
    setPageMeta([`${labels.workspace}初始化失败`]);
    updateOverlay(
      `${labels.apsWorkspace}装载失败`,
      localizeUserMessage(error.message, t("未知错误，请稍后重试。", "Unknown error. Please try again later.")),
    );
  }
}

void boot();
