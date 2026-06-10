import EmbedPDF, { PdfAnnotationBorderStyle, PdfAnnotationSubtype } from "/vendor/embedpdf/embedpdf.js";

const params = new URLSearchParams(window.location.search);
const state = {
  docId: params.get("id") || params.get("docId") || "",
  versionId: params.get("versionId") || "",
  mode: params.get("mode") === "view" ? "view" : "review",
  actor: "",
  document: null,
  workflows: [],
  templates: [],
  viewer: null,
  registry: null,
  nativePanelObserver: null,
  nativePanelObserverRoot: null,
  nativePanelMountTimer: 0,
  nativeAnnotationSyncTimer: 0,
  nativeLeftOutlineActivated: false,
  syncingNativeSelection: false,
  cdePanel: "annotations",
  selectedAnnotationId: params.get("annotationId") || params.get("issueId") || "",
  filter: "all",
  replyAttachments: [],
  replyAttachmentAnnotationId: "",
  syncingNativeAnnotations: new Set(),
  suppressedNativeAnnotationEvents: new Set(),
  importedCdeNativeAnnotationIds: new Set(),
  annotationDrafts: new Map(),
};

const MAX_ATTACHMENT_COUNT = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
// Bump when @embedpdf/snippet is upgraded so clients re-fetch the WASM; the
// version query lets the server serve it immutable (skips the per-open revalidation
// round-trip for the 4.6MB pdfium.wasm).
const EMBEDPDF_ASSET_VERSION = "2.14.3";
const EMBEDPDF_WASM_PATH = "/vendor/embedpdf/pdfium.wasm";
const CDE_LEFT_SIDEBAR_ID = "sidebar-panel";
const CDE_ANNOTATION_TAB_ID = "outline";
const CDE_REVIEW_SIDEBAR_ID = "cde-review-panel";
const CDE_SEARCH_SIDEBAR_ID = "search-panel";
const CDE_LEFT_SIDEBAR_WIDTH = "320px";
const CDE_REVIEW_SIDEBAR_WIDTH = "320px";
const PDF_POINT_WIDTH = 612;
const PDF_POINT_HEIGHT = 792;
const COLOR_BY_NATIVE_TYPE = {
  circle: "red",
  mark: "blue",
  note: "amber",
  line: "red",
  pen: "blue",
};
const CDE_NATIVE_PANEL_CSS = `
  @media (min-width: 1180px) {
    [data-epdf-i="main-toolbar"] {
      position: relative;
    }
    [data-epdf-i="main-toolbar"] > [data-epdf-i="mode-tabs"] {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 1;
      transform: translate(-50%, -50%);
    }
  }
  .cde-native-sidebar-host {
    overflow: hidden;
    background: #ffffff;
  }
  .cde-sidebar-shell {
    --surface: #ffffff;
    --surface-soft: #f7f9f8;
    --line: #d9dfdd;
    --text: #17211e;
    --body: #4f5d58;
    --muted: #7b8984;
    --accent: #0f766e;
    --accent-ink: #0b4f4a;
    --accent-soft: #e6f3f1;
    --warn: #a16207;
    --warn-soft: #fff6db;
    --danger: #b3403c;
    --danger-soft: #fff0ef;
    --ok: #3f7a4b;
    --ok-soft: #edf7ef;
    --mono: "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace;
    display: grid;
    min-width: 0;
    min-height: 0;
    height: 100%;
    background: var(--surface);
    color: var(--text);
    font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
    font-size: 13px;
  }
  .cde-sidebar-shell * { box-sizing: border-box; }
  .cde-sidebar-shell button,
  .cde-sidebar-shell input,
  .cde-sidebar-shell textarea,
  .cde-sidebar-shell select { font: inherit; }
  .cde-sidebar-shell button { cursor: pointer; }
  .cde-sidebar-shell button:disabled,
  .cde-sidebar-shell input:disabled,
  .cde-sidebar-shell textarea:disabled,
  .cde-sidebar-shell select:disabled { cursor: not-allowed; opacity: 0.55; }
  .cde-sidebar-shell.hidden,
  .cde-sidebar-shell .hidden { display: none !important; }
  .cde-annotation-sidebar {
    grid-template-rows: auto auto auto minmax(0, 1fr);
    gap: 12px;
    overflow: hidden;
    padding: 14px;
  }
  .cde-annotation-sidebar .item-list {
    align-content: start;
    grid-auto-rows: max-content;
    min-height: 0;
    overflow: auto;
    padding-bottom: 12px;
  }
  .cde-review-panel {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .rail-head,
  .panel-head,
  .section-head,
  .item-meta,
  .meta-strip,
  .top-actions,
  .button-row,
  .status-row,
  .attachment-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .rail-head,
  .panel-head,
  .section-head {
    align-items: flex-start;
    justify-content: space-between;
  }
  .rail-head { gap: 12px; }
  .rail-head h2,
  .panel-head h2,
  .section-head h3,
  .empty-state strong {
    margin: 0;
    font-size: 14px;
    line-height: 1.35;
  }
  .panel-kicker,
  .field-label {
    display: block;
    margin: 0;
    color: var(--muted);
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .panel-head {
    padding: 14px 14px 10px;
    border-bottom: 1px solid var(--line);
  }
  .panel-head p,
  .section-text,
  .empty-state p,
  .item-card p {
    margin: 4px 0 0;
    color: var(--body);
    font-size: 12px;
    line-height: 1.55;
  }
  .panel-shell {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }
  .tab-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    padding: 10px 10px 0;
  }
  .tab-button,
  .primary-button,
  .ghost-button,
  .icon-button,
  .link-button {
    min-height: 32px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 12px;
    font-weight: 620;
    text-decoration: none;
    transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
  }
  .tab-button {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 8px;
    white-space: nowrap;
  }
  .primary-button,
  .ghost-button,
  .link-button { padding: 0 12px; }
  .primary-button,
  .tab-button.active,
  .icon-button.active {
    border-color: transparent;
    background: var(--accent);
    color: #fff;
  }
  .ghost-button:hover:not(:disabled),
  .tab-button:hover:not(:disabled),
  .icon-button:hover:not(:disabled),
  .link-button:hover:not(:disabled) { border-color: var(--accent); }
  .danger-button {
    border-color: color-mix(in srgb, var(--danger) 45%, var(--line));
    color: var(--danger);
  }
  .panel-scroll {
    min-height: 0;
    overflow: auto;
    padding: 12px 14px 16px;
  }
  .panel-section,
  .item-list,
  .card-list,
  .attachment-list,
  .reply-list {
    display: grid;
    gap: 8px;
  }
  .panel-section { gap: 12px; }
  .summary-grid,
  .annotation-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .native-tool-grid { display: none; }
  .summary-card,
  .item-card,
  .field-card,
  .empty-state,
  .attachment-card {
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface-soft);
  }
  .summary-card,
  .item-card,
  .field-card,
  .empty-state { padding: 10px; }
  .summary-card span,
  .field-card span {
    display: block;
    color: var(--muted);
    font-size: 11px;
  }
  .summary-card strong,
  .field-card strong {
    display: block;
    overflow: hidden;
    margin-top: 4px;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }
  .filter-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .text-input,
  .text-area {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: #fff;
    color: var(--text);
    font-size: 12px;
    outline: none;
  }
  .text-input {
    min-height: 34px;
    padding: 0 10px;
  }
  .text-area {
    min-height: 86px;
    resize: vertical;
    padding: 9px 10px;
    line-height: 1.55;
  }
  .item-card {
    width: 100%;
    padding: 10px;
    text-align: left;
  }
  button.item-card { cursor: pointer; }
  button.item-card.active {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .item-meta {
    justify-content: space-between;
    gap: 8px;
  }
  .item-meta strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }
  .pill,
  .tab-badge {
    display: inline-flex;
    min-height: 26px;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: var(--surface-soft);
    color: var(--body);
    font-family: var(--mono);
    font-size: 10px;
    padding: 0 8px;
    white-space: nowrap;
  }
  .signal-pill.success { background: var(--ok-soft); color: var(--ok); }
  .signal-pill.open { background: var(--warn-soft); color: var(--warn); }
  .signal-pill.danger { background: var(--danger-soft); color: var(--danger); }
  .annotation-detail {
    display: grid;
    gap: 10px;
    padding-top: 4px;
  }
  .status-row { align-items: stretch; }
  .status-row .ghost-button {
    flex: 1 1 0;
    padding-inline: 8px;
  }
  .status-row .active {
    border-color: transparent;
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .attachment-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 8px;
  }
  .attachment-card strong,
  .attachment-card span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .attachment-card span {
    color: var(--muted);
    font-size: 11px;
  }
  .divider {
    height: 1px;
    background: var(--line);
  }
`;
const LANGUAGE_STORAGE_KEY = "cde.language";
const STANDALONE_EN_TEXT = {
  "PDF审阅 - CDE文件管理系统": "PDF Review - CDE File Management System",
  "正在打开 PDF 审阅页": "Opening PDF Review",
  "加载中": "Loading",
  "缩略图 / 目录": "Thumbnails / Outline",
  "原生评论": "Native Comments",
  "CDE 面板": "CDE Panel",
  "PDF 原生审阅器": "Native PDF Review Viewer",
  "正在加载 PDF": "Loading PDF",
  "正在准备文档流...": "Preparing document stream...",
  "正在读取当前会话、文件权限和 PDF 版本。": "Loading the current session, file permissions, and PDF version.",
  "正在校验文件权限。": "Checking file permissions.",
  "正在启动 EmbedPDF 原生审阅器。": "Starting the native EmbedPDF reviewer.",
  "批注与流程": "Annotations & Workflow",
  "正在校验会话并加载图纸数据...": "Checking the session and loading document data...",
  "CDE PDF 审阅面板": "CDE PDF Review Panel",
  "批注": "Annotations",
  "评论": "Comments",
  "流程": "Workflow",
  "高亮": "Highlight",
  "手绘": "Freehand",
  "矩形": "Rectangle",
  "便签": "Note",
  "全部批注": "All Annotations",
  "未解决": "Open",
  "进行中": "In Progress",
  "处理中": "In Progress",
  "已解决": "Resolved",
  "批注详情": "Annotation Details",
  "评论与备注": "Comments & Remarks",
  "流程中心": "Workflow Center",
  "未选中批注": "No Annotation Selected",
  "选择图面批注后查看说明、证据和处理记录。": "Select a drawing annotation to view notes, evidence, and handling records.",
  "选择或新建批注": "Select or Create an Annotation",
  "可使用 EmbedPDF 原生工具在图面上创建批注；创建后会同步到 CDE 批注列表。": "Use the native EmbedPDF tools to create annotations on the page. New annotations sync to the CDE list.",
  "发起人": "Author",
  "页码": "Page",
  "类型": "Type",
  "创建时间": "Created",
  "标题": "Title",
  "输入批注标题": "Enter an annotation title",
  "说明": "Notes",
  "描述问题、审阅结论或处理要求。": "Describe the issue, review conclusion, or action required.",
  "证据附件": "Evidence Attachments",
  "图片": "Image",
  "文件": "File",
  "链接": "Link",
  "保存批注": "Save Annotation",
  "删除": "Delete",
  "处理讨论": "Handling Discussion",
  "回复与结论": "Replies & Conclusions",
  "选中批注后，可以在这里补充处理记录或结论。": "After selecting an annotation, add handling records or conclusions here.",
  "发布更新": "Post Update",
  "整文备注": "Document Remarks",
  "报告摘要": "Report Summary",
  "记录整份文件的审阅结论、补充说明或执行要求。": "Record the review conclusion, additional notes, or execution requirements for the whole file.",
  "保存备注": "Save Remarks",
  "当前流程": "Current Workflow",
  "待发起": "Ready to Start",
  "流程名称": "Workflow Name",
  "请输入流程名称": "Enter a workflow name",
  "流程模板": "Workflow Template",
  "发起流程": "Start Workflow",
  "需要重新登录": "Sign-In Required",
  "当前 PDF 审阅页没有有效会话。请回到系统登录后再打开该页面。": "This PDF review page has no valid session. Sign in to the system, then reopen the page.",
  "返回登录页": "Back to Sign In",
  "缺少文件参数": "Missing File Parameter",
  "PDF 页面需要通过系统入口打开，当前 URL 中没有文件 ID。": "Open the PDF page from the system entry point. The current URL has no file ID.",
  "PDF 加载失败": "PDF Load Failed",
  "请刷新页面重试，或回到系统重新打开。": "Refresh and try again, or reopen the PDF from the system.",
  "未找到文件。": "File not found.",
  "当前用户没有查看该 PDF 的权限。": "You do not have permission to view this PDF.",
  "当前独立页面只支持 PDF 文件。": "This standalone page supports PDF files only.",
  "EmbedPDF 初始化失败。": "EmbedPDF failed to initialize.",
  "审阅面板": "Review Panel",
  "导出批注版": "Export Reviewed PDF",
  "导出评论": "Export Comments",
  "原生批注已同步到 CDE。": "Native annotation synced to CDE.",
  "创建批注失败。": "Failed to create annotation.",
  "PDF 审阅页": "PDF Review",
  "未关联流程": "No Workflow Linked",
  "只读": "Read Only",
  "审阅": "Review",
  "批注总数": "Total Annotations",
  "批注列表": "Annotations",
  "未闭环": "Open Items",
  "版本": "Version",
  "权限": "Permissions",
  "可审阅": "Can Review",
  "暂无批注": "No Annotations",
  "使用 EmbedPDF 原生批注工具在图面上创建第一条审阅意见。": "Use the native EmbedPDF annotation tools to create the first review comment.",
  "未填写说明": "No notes provided",
  "系统": "System",
  "暂无附件。": "No attachments.",
  "补充了附件": "Added attachments",
  "暂无回复": "No Replies",
  "处理过程、修订说明和结论会出现在这里。": "Handling records, revision notes, and conclusions appear here.",
  "附件": "Attachment",
  "移除": "Remove",
  "打开": "Open",
  "未发起": "Not Started",
  "文档状态": "Document Status",
  "未指定": "Unassigned",
  "等待处理": "Pending",
  "活动": "Activity",
  "当前为只读模式，不能创建批注。": "Read-only mode does not allow creating annotations.",
  "批注已保存。": "Annotation saved.",
  "保存批注失败。": "Failed to save annotation.",
  "状态已更新。": "Status updated.",
  "更新状态失败。": "Failed to update status.",
  "确认删除这条批注吗？": "Delete this annotation?",
  "批注已删除。": "Annotation deleted.",
  "删除批注失败。": "Failed to delete annotation.",
  "添加附件失败。": "Failed to add attachment.",
  "请输入附件链接 URL": "Enter the attachment link URL",
  "添加链接失败。": "Failed to add link.",
  "附件已更新。": "Attachments updated.",
  "添加回复附件失败。": "Failed to add reply attachment.",
  "请输入回复附件链接 URL": "Enter the reply attachment link URL",
  "请输入回复内容或添加附件。": "Enter a reply or add an attachment.",
  "回复已发布。": "Reply posted.",
  "发布回复失败。": "Failed to post reply.",
  "备注已保存。": "Remarks saved.",
  "保存备注失败。": "Failed to save remarks.",
  "你没有导出批注版的权限。": "You do not have permission to export the reviewed PDF.",
  "导出中": "Exporting",
  "批注版已生成。": "Reviewed PDF generated.",
  "导出批注版失败。": "Failed to export reviewed PDF.",
  "你没有导出评论清单的权限。": "You do not have permission to export the comment list.",
  "评论清单已生成。": "Comment list generated.",
  "导出评论清单失败。": "Failed to export comment list.",
  "请选择流程模板并填写流程名称。": "Select a workflow template and enter a workflow name.",
  "流程已发起。": "Workflow started.",
  "发起流程失败。": "Failed to start workflow.",
  "流程已更新。": "Workflow updated.",
  "流程动作失败。": "Workflow action failed.",
  "撤回流程": "Withdraw Workflow",
  "确认撤回当前流程吗？": "Withdraw the current workflow?",
  "退回修改": "Return for Revision",
  "确认退回发起人修改吗？": "Return this to the initiator for revision?",
  "批准归档": "Approve & Archive",
  "确认批准归档吗？归档后批注和回复会锁定。": "Approve and archive? Annotations and replies will be locked after archiving.",
  "退回发起人": "Return to Initiator",
  "确认退回发起人修订吗？": "Return this to the initiator for revision?",
  "确认完成当前节点并提交下一步吗？": "Complete the current step and submit to the next step?",
  "只读模式下不显示流转动作。": "Workflow actions are hidden in read-only mode.",
  "补充批注、备注和附件后可发起流程。": "Add annotations, remarks, and attachments before starting a workflow.",
  "当前节点暂无你可执行的流转动作。": "No workflow action is available to you at the current step.",
  "当前没有运行中的流程。": "No workflow is currently running.",
  "未找到指定的历史版本。": "The specified historical version was not found.",
  "未命名图片": "Untitled Image",
  "未命名附件": "Untitled Attachment",
  "图片附件只支持图片文件。": "Image attachments only support image files.",
  "单张图片不能超过 10MB。": "Each image must be 10 MB or smaller.",
  "单个文件不能超过 50MB。": "Each file must be 50 MB or smaller.",
  "文件读取失败。": "Failed to read the file.",
  "请求失败，请稍后重试。": "Request failed. Please try again later.",
  "操作失败，请稍后重试。": "Operation failed. Please try again later.",
  "定点批注": "Point Annotation",
  "矩形批注": "Rectangle Annotation",
  "文本批注": "Text Annotation",
  "箭头批注": "Arrow Annotation",
  "手绘批注": "Freehand Annotation",
  "批注": "Annotation",
  "草稿": "Draft",
  "已上传": "Uploaded",
  "审阅中": "In Review",
  "终审": "Final Review",
  "已归档": "Archived",
  "已退回": "Returned",
  "待审阅": "Pending Review",
  "已完成": "Completed",
  "已退回": "Returned",
  "等待": "Waiting",
};

const el = (id) => document.getElementById(id);
const elements = {
  workspace: el("workspace"),
  cdeNativePanels: el("cdeNativePanels"),
  cdeAnnotationSidebarShell: el("cdeAnnotationSidebarShell"),
  cdeReviewPanelShell: el("cdeReviewPanelShell"),
  documentTitle: el("documentTitle"),
  documentVersion: el("documentVersion"),
  documentStatus: el("documentStatus"),
  documentMeta: el("documentMeta"),
  documentPageSummary: el("documentPageSummary"),
  commentReportButton: el("commentReportButton"),
  exportButton: el("exportButton"),
  embedPdfViewer: el("embedPdfViewer"),
  progressOverlay: el("progressOverlay"),
  progressBar: el("progressBar"),
  progressText: el("progressText"),
  progressTitle: el("progressTitle"),
  loginCard: el("loginCard"),
  loginButton: el("loginButton"),
  toastRegion: el("toastRegion"),
  cdePanelTitle: el("cdePanelTitle"),
  cdeTabs: Array.from(document.querySelectorAll("[data-cde-panel-tab]")),
  panelSections: Array.from(document.querySelectorAll("[data-panel-name]")),
  reviewDocSummary: el("reviewDocSummary"),
  annotationTabBadge: el("annotationTabBadge"),
  annotationFilter: el("annotationFilter"),
  reviewAnnotationSidebarList: el("reviewAnnotationSidebarList"),
  annotationDetailHeading: el("annotationDetailHeading"),
  annotationMetaLine: el("annotationMetaLine"),
  annotationDetailBadge: el("annotationDetailBadge"),
  annotationEmptyCard: el("annotationEmptyCard"),
  annotationDetailBody: el("annotationDetailBody"),
  annotationStatusGroup: el("annotationStatusGroup"),
  annotationActorInput: el("annotationActorInput"),
  annotationPageInput: el("annotationPageInput"),
  annotationTypeInput: el("annotationTypeInput"),
  annotationCreatedInput: el("annotationCreatedInput"),
  annotationTitleInput: el("annotationTitleInput"),
  annotationDetailInput: el("annotationDetailInput"),
  attachmentCountBadge: el("attachmentCountBadge"),
  attachImageButton: el("attachImageButton"),
  attachFileButton: el("attachFileButton"),
  attachLinkButton: el("attachLinkButton"),
  annotationAttachmentList: el("annotationAttachmentList"),
  saveAnnotationButton: el("saveAnnotationButton"),
  deleteAnnotationButton: el("deleteAnnotationButton"),
  replyList: el("replyList"),
  replyInput: el("replyInput"),
  replyButton: el("replyButton"),
  replyAttachImageButton: el("replyAttachImageButton"),
  replyAttachFileButton: el("replyAttachFileButton"),
  replyAttachLinkButton: el("replyAttachLinkButton"),
  replyAttachmentCountBadge: el("replyAttachmentCountBadge"),
  replyAttachmentList: el("replyAttachmentList"),
  remarksInput: el("remarksInput"),
  saveRemarksButton: el("saveRemarksButton"),
  workflowHealthBadge: el("workflowHealthBadge"),
  workflowSummaryGrid: el("workflowSummaryGrid"),
  workflowLaunchControls: el("workflowLaunchControls"),
  workflowNameInput: el("workflowNameInput"),
  workflowTemplateSelect: el("workflowTemplateSelect"),
  workflowLaunchHint: el("workflowLaunchHint"),
  workflowLaunchActions: el("workflowLaunchActions"),
  startFlowButton: el("startFlowButton"),
  workflowActions: el("workflowActions"),
  workflowSteps: el("workflowSteps"),
  activityList: el("activityList"),
};

installStandaloneLocalization();
bindEvents();
void init();

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
  if (!source || currentLanguage() !== "en" || !hasCjkText(source)) {
    return source;
  }
  const trimmed = source.trim();
  if (STANDALONE_EN_TEXT[trimmed]) {
    return source.replace(trimmed, STANDALONE_EN_TEXT[trimmed]);
  }
  let result = source
    .replace(/第\s*(\d+)\s*页/g, "Page $1")
    .replace(/(\d+)\s*条批注/g, "$1 annotations")
    .replace(/(\d+)\s*项/g, "$1 items")
    .replace(/附件最多支持\s*(\d+)\s*项。/g, "Attachments support up to $1 items.")
    .replace(/(定点|Point)批注\s*·\s*Page\s*(\d+)/g, "Point Annotation · Page $2")
    .replace(/(矩形|Rectangle)批注\s*·\s*Page\s*(\d+)/g, "Rectangle Annotation · Page $2")
    .replace(/(文本|Text)批注\s*·\s*Page\s*(\d+)/g, "Text Annotation · Page $2")
    .replace(/(箭头|Arrow)批注\s*·\s*Page\s*(\d+)/g, "Arrow Annotation · Page $2")
    .replace(/(手绘|Freehand)批注\s*·\s*Page\s*(\d+)/g, "Freehand Annotation · Page $2");
  Object.entries(STANDALONE_EN_TEXT)
    .filter(([zh]) => hasCjkText(zh) && Array.from(zh).length > 3)
    .sort((left, right) => right[0].length - left[0].length)
    .forEach(([zh, en]) => {
      result = result.replaceAll(zh, en);
    });
  return result
    .replace(/Point Annotation来自 EmbedPDF Native Annotation/g, "Point Annotation from EmbedPDF native annotation")
    .replace(/Rectangle Annotation来自 EmbedPDF Native Annotation/g, "Rectangle Annotation from EmbedPDF native annotation")
    .replace(/Text Annotation来自 EmbedPDF Native Annotation/g, "Text annotation from EmbedPDF native annotation")
    .replace(/Arrow Annotation来自 EmbedPDF Native Annotation/g, "Arrow annotation from EmbedPDF native annotation")
    .replace(/Freehand Annotation来自 EmbedPDF Native Annotation/g, "Freehand annotation from EmbedPDF native annotation")
    .replace(/\s+\/\s+/g, " / ");
}

function hasCjkText(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function localizeUserMessage(value, fallback = t("操作失败，请稍后重试。", "Operation failed. Please try again later.")) {
  const fallbackValue = String(fallback || "").trim() || t("操作失败，请稍后重试。", "Operation failed. Please try again later.");
  const source = String(value || "").trim() || fallbackValue;
  const localized = localizeStandaloneText(source);
  if (currentLanguage() === "en" && hasCjkText(localized)) {
    const fallbackLocalized = localizeStandaloneText(fallbackValue);
    return hasCjkText(fallbackLocalized) ? "Operation failed. Please try again later." : fallbackLocalized;
  }
  return localized || fallbackValue;
}

function installStandaloneLocalization() {
  document.documentElement.lang = currentLanguage() === "en" ? "en-US" : "zh-CN";
  document.title = localizeStandaloneText(document.title);
  const originalConfirm = window.confirm?.bind(window);
  const originalPrompt = window.prompt?.bind(window);
  if (originalConfirm) {
    window.confirm = (message) => originalConfirm(localizeStandaloneText(message));
  }
  if (originalPrompt) {
    window.prompt = (message, defaultValue) => originalPrompt(localizeStandaloneText(message), defaultValue);
  }
  applyStandaloneTranslations();
}

function applyStandaloneTranslations(root = document.body) {
  if (currentLanguage() !== "en" || !root) {
    return;
  }
  // Skip EmbedPDF's own native UI (it has its own i18n), but always allow the
  // CDE-injected sidebars even though they live inside the EmbedPDF subtree.
  const skip = (el) => Boolean(el && el.closest && el.closest("#embedPdfViewer") && !el.closest("[data-cde-native-shell]"));
  // 1) Visible text nodes (the previous implementation only ever reached
  //    attributes because querySelectorAll("*") returns elements, not text).
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    textNodes.push(node);
  }
  textNodes.forEach((node) => {
    if (!hasCjkText(node.nodeValue) || skip(node.parentElement)) {
      return;
    }
    node.nodeValue = localizeStandaloneText(node.nodeValue);
  });
  // 2) Translatable attributes.
  const translateAttrs = (node) => {
    if (skip(node)) {
      return;
    }
    ["placeholder", "title", "aria-label", "alt"].forEach((attribute) => {
      const attributeValue = node.getAttribute(attribute);
      if (attributeValue && hasCjkText(attributeValue)) {
        node.setAttribute(attribute, localizeStandaloneText(attributeValue));
      }
    });
  };
  if (root.nodeType === Node.ELEMENT_NODE) {
    translateAttrs(root);
  }
  root.querySelectorAll?.("*").forEach(translateAttrs);
}

function bindEvents() {
  elements.loginButton?.addEventListener("click", () => {
    window.location.href = "/";
  });
  elements.commentReportButton?.addEventListener("click", () => void exportCommentReport());
  elements.exportButton?.addEventListener("click", () => void exportReviewedPdf());
  elements.cdeTabs.forEach((button) => {
    button.addEventListener("click", () => showCdePanel(button.dataset.cdePanelTab || "annotations"));
  });
  document.querySelectorAll("[data-native-tool]").forEach((button) => {
    button.addEventListener("click", () => setNativeTool(button.dataset.nativeTool || null));
  });
  elements.annotationFilter?.addEventListener("change", () => {
    state.filter = elements.annotationFilter.value || "all";
    renderAnnotationList();
  });
  elements.annotationStatusGroup?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-annotation-status]");
    if (button) {
      void updateAnnotationStatus(button.dataset.annotationStatus || "open");
    }
  });
  elements.saveAnnotationButton?.addEventListener("click", () => void saveSelectedAnnotation());
  elements.deleteAnnotationButton?.addEventListener("click", () => void deleteSelectedAnnotation());
  elements.annotationTitleInput?.addEventListener("input", syncAnnotationDraftFromInputs);
  elements.annotationDetailInput?.addEventListener("input", syncAnnotationDraftFromInputs);
  elements.attachImageButton?.addEventListener("click", () => void pickAnnotationFiles("image"));
  elements.attachFileButton?.addEventListener("click", () => void pickAnnotationFiles("document"));
  elements.attachLinkButton?.addEventListener("click", () => void addAnnotationLink());
  elements.replyAttachImageButton?.addEventListener("click", () => void pickReplyFiles("image"));
  elements.replyAttachFileButton?.addEventListener("click", () => void pickReplyFiles("document"));
  elements.replyAttachLinkButton?.addEventListener("click", () => void addReplyLink());
  elements.replyButton?.addEventListener("click", () => void replyToSelectedAnnotation());
  elements.saveRemarksButton?.addEventListener("click", () => void saveRemarks());
  elements.startFlowButton?.addEventListener("click", () => void launchWorkflow());
}

async function init() {
  if (!state.docId) {
    showState("缺少文件参数", "PDF 页面需要通过系统入口打开，当前 URL 中没有文件 ID。");
    return;
  }
  try {
    showProgress("正在加载 PDF", "正在读取当前会话、文件权限和 PDF 版本。", 0.12);
    const session = await fetchJson("/api/session");
    if (!session.authenticated) {
      hideProgress();
      elements.loginCard?.classList.add("visible");
      return;
    }
    state.actor = session.currentUser?.name || "系统";
    showProgress("正在加载 PDF", "正在校验文件权限。", 0.32);
    await loadDocument();
    renderShell();
    showProgress("正在加载 PDF", "正在启动 EmbedPDF 原生审阅器。", 0.58);
    await initEmbedPdfViewer();
    hideProgress();
    void loadWorkflowTemplates();
    if (state.selectedAnnotationId) {
      selectAnnotation(state.selectedAnnotationId);
    }
  } catch (error) {
    console.error(error);
    hideProgress();
    showState("PDF 加载失败", error.message || "请刷新页面重试，或回到系统重新打开。");
  }
}

async function loadDocument() {
  const payload = await fetchJson(`/api/documents/${encodeURIComponent(state.docId)}`);
  state.document = payload.document;
  if (!state.document) {
    throw new Error("未找到文件。");
  }
  if (!canPreviewDocument()) {
    throw new Error("当前用户没有查看该 PDF 的权限。");
  }
  if (!isPdfDocument(state.document)) {
    throw new Error("当前独立页面只支持 PDF 文件。");
  }
  await loadWorkflowSnapshot();
}

async function loadWorkflowSnapshot() {
  if (!state.document?.activeWorkflowId) {
    state.workflows = [];
    return;
  }
  try {
    const payload = await fetchJson("/api/documents");
    state.workflows = Array.isArray(payload.workflows) ? payload.workflows : [];
    const freshDocument = Array.isArray(payload.documents)
      ? payload.documents.find((doc) => doc.id === state.document.id)
      : null;
    if (freshDocument) {
      state.document = freshDocument;
    }
  } catch (error) {
    console.warn("流程快照加载失败", error);
    state.workflows = [];
  }
}

async function initEmbedPdfViewer() {
  const source = currentPdfSource();
  const src = appendCacheParam(source.url, source.updatedAt || state.document.updatedAt || "");
  elements.embedPdfViewer.innerHTML = "";
  state.viewer = EmbedPDF.init({
    type: "container",
    target: elements.embedPdfViewer,
    src,
    worker: true,
    wasmUrl: localEmbedPdfAssetUrl(EMBEDPDF_WASM_PATH),
    tabBar: "never",
    fonts: { ui: null, signature: null },
    theme: {
      preference: "light",
      light: {
        background: { app: "#f4f6f5", surface: "#ffffff", surfaceAlt: "#f7f9f8", elevated: "#ffffff", input: "#ffffff" },
        foreground: { primary: "#17211e", secondary: "#4f5d58", muted: "#7b8984", onAccent: "#ffffff" },
        border: { default: "#d9dfdd", subtle: "#e7ecea", strong: "#b5c0bc" },
        accent: { primary: "#0f766e", primaryHover: "#0b5f59", primaryActive: "#0b4f4a", primaryLight: "#e6f3f1", primaryForeground: "#ffffff" },
        interactive: { hover: "#edf3f1", active: "#e6f3f1", selected: "#dcefed", focus: "#0f766e", focusRing: "#99d5cf" },
        state: { error: "#b3403c", errorLight: "#fff0ef", warning: "#a16207", warningLight: "#fff6db", success: "#3f7a4b", successLight: "#edf7ef", info: "#2f6f9f", infoLight: "#edf6fb" },
      },
    },
    export: { defaultFileName: state.document?.name || "document.pdf" },
    annotations: {
      annotationAuthor: state.actor,
      selectAfterCreate: true,
    },
    fullscreen: {
      targetElement: "#viewerFrame",
    },
    permissions: {
      enforceDocumentPermissions: false,
      overrides: {
        print: true,
        copyContents: true,
        modifyAnnotations: canCreateAnnotation(),
      },
    },
  });
  if (!state.viewer?.registry) {
    throw new Error("EmbedPDF 初始化失败。");
  }
  state.registry = await state.viewer.registry;
  registerCdeCommands();
  wireNativeAnnotationEvents();
  scheduleCdeNativeAnnotationSync();
  setupCdeNativeSidebars();
}

function registerCdeCommands() {
  const registry = state.registry;
  const commands = registry?.getPlugin("commands")?.provides();
  const ui = registry?.getPlugin("ui")?.provides();
  if (!commands || !ui) {
    return;
  }
  commands.registerCommand({
    id: "custom.cde.toggle-review-panel",
    label: t("审阅面板", "Review Panel"),
    icon: "sidebar",
    action: () => toggleCdeDock(),
    active: () => isCdeReviewSidebarOpen(),
    categories: ["custom", "cde", "panel"],
  });
  commands.registerCommand({
    id: "custom.cde.export-reviewed",
    label: t("导出批注版", "Export Reviewed PDF"),
    icon: "download",
    action: () => void exportReviewedPdf(),
    disabled: () => !annotationPermissions().export,
    categories: ["custom", "cde", "document-export"],
  });
  commands.registerCommand({
    id: "custom.cde.comment-report",
    label: t("导出评论", "Export Comments"),
    icon: "file",
    action: () => void exportCommentReport(),
    disabled: () => !annotationPermissions().export,
    categories: ["custom", "cde", "document-export"],
  });
  mergeCdeToolbarSchema(ui);
  mergeCdeSidebarSchema(ui);
}

function mergeCdeToolbarSchema(ui) {
  const schema = ui.getSchema();
  const toolbar = schema.toolbars?.["main-toolbar"];
  if (!toolbar) {
    return;
  }
  const items = cloneJson(toolbar.items || []);
  const cdeGroup = {
    type: "group",
    id: "cde-review-group",
    gap: 2,
    alignment: "end",
    items: [
      { type: "command-button", id: "cde-toggle-review-panel", commandId: "custom.cde.toggle-review-panel", variant: "icon" },
    ],
  };
  removeToolbarItemsByCommandIds(items, new Set([
    "panel:toggle-comment",
  ]));
  const existing = items.findIndex((item) => item.id === "cde-review-group");
  if (existing >= 0) {
    items.splice(existing, 1, cdeGroup);
  } else {
    const rightGroup = items.find((item) => item.id === "right-group" && Array.isArray(item.items));
    if (rightGroup) {
      rightGroup.items = [{ type: "divider", id: "cde-right-divider", orientation: "vertical" }, cdeGroup, ...rightGroup.items];
    } else {
      items.push({ type: "spacer", id: "cde-spacer", flex: true }, cdeGroup);
    }
  }
  ui.mergeSchema({
    toolbars: {
      "main-toolbar": { ...toolbar, items },
    },
  });
}

function mergeCdeSidebarSchema(ui) {
  const schema = ui.getSchema();
  const leftSidebar = schema.sidebars?.[CDE_LEFT_SIDEBAR_ID];
  if (!leftSidebar) {
    return;
  }
  ui.mergeSchema({
    sidebars: {
      [CDE_LEFT_SIDEBAR_ID]: {
        ...leftSidebar,
        content: {
          ...leftSidebar.content,
          defaultTab: CDE_ANNOTATION_TAB_ID,
        },
        defaultOpen: true,
        width: CDE_LEFT_SIDEBAR_WIDTH,
        collapsible: true,
      },
      [CDE_REVIEW_SIDEBAR_ID]: {
        id: CDE_REVIEW_SIDEBAR_ID,
        position: { placement: "right", slot: "main", order: 0 },
        content: { type: "component", componentId: "comment-sidebar" },
        width: CDE_REVIEW_SIDEBAR_WIDTH,
        collapsible: true,
        defaultOpen: true,
        categories: ["custom", "cde", "panel"],
      },
    },
  });
}

function removeToolbarItemsByCommandIds(items, commandIds) {
  if (!Array.isArray(items)) {
    return;
  }
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (commandIds.has(item?.commandId)) {
      items.splice(index, 1);
      continue;
    }
    if (Array.isArray(item?.items)) {
      removeToolbarItemsByCommandIds(item.items, commandIds);
    }
  }
}

function setupCdeNativeSidebars() {
  openNativeLeftSidebar();
  openCdeReviewSidebar();
  observeCdeNativePanelMounts();
  scheduleCdeNativePanelMount();
  [80, 240, 700, 1400].forEach((delay) => {
    window.setTimeout(() => {
      observeCdeNativePanelMounts();
      openNativeLeftSidebar();
      activateNativeOutlineTab();
      openCdeReviewSidebar();
      mountCdeNativePanels();
      scheduleCdeNativeAnnotationSync();
    }, delay);
  });
}

function observeCdeNativePanelMounts() {
  const shadowRoot = embedPdfShadowRoot();
  if (!shadowRoot || state.nativePanelObserverRoot === shadowRoot) {
    return;
  }
  state.nativePanelObserver?.disconnect();
  state.nativePanelObserverRoot = shadowRoot;
  state.nativePanelObserver = new MutationObserver(() => scheduleCdeNativePanelMount());
  state.nativePanelObserver.observe(shadowRoot, { childList: true, subtree: true });
}

function scheduleCdeNativePanelMount() {
  if (state.nativePanelMountTimer) {
    window.clearTimeout(state.nativePanelMountTimer);
  }
  state.nativePanelMountTimer = window.setTimeout(() => {
    state.nativePanelMountTimer = 0;
    mountCdeNativePanels();
  }, 0);
}

function mountCdeNativePanels() {
  const shadowRoot = embedPdfShadowRoot();
  if (!shadowRoot) {
    return false;
  }
  activateNativeOutlineTab();
  installCdeNativePanelStyles(shadowRoot);
  const leftHost = shadowRoot.querySelector(`[data-sidebar-id="${CDE_LEFT_SIDEBAR_ID}"]`);
  const activeHost = findNativeRightSidebarHost(shadowRoot);
  mountCdeAnnotationIntoNativeOutline(leftHost);
  const reviewMounted = mountCdeReviewIntoNativeSidebar(activeHost);
  return Boolean(leftHost && reviewMounted);
}

function activateNativeOutlineTab() {
  if (state.nativeLeftOutlineActivated) {
    return true;
  }
  const host = embedPdfShadowRoot()?.querySelector(`[data-sidebar-id="${CDE_LEFT_SIDEBAR_ID}"]`);
  const tabs = Array.from(host?.querySelectorAll('[role="tab"]') || []);
  const outlineTab = tabs[1];
  if (!outlineTab) {
    return false;
  }
  if (outlineTab.getAttribute("aria-selected") === "true") {
    state.nativeLeftOutlineActivated = true;
    return true;
  }
  outlineTab.click();
  state.nativeLeftOutlineActivated = true;
  return true;
}

function mountCdeAnnotationIntoNativeOutline(host) {
  const shell = elements.cdeAnnotationSidebarShell;
  if (!host || !shell) {
    return false;
  }
  const body = findNativeLeftSidebarBody(host);
  if (!body) {
    return false;
  }
  if (!isCdeAnnotationTabSelected(host)) {
    body.style.overflow = "";
    if (shell.parentElement === body) {
      elements.cdeNativePanels?.append(shell);
    }
    return false;
  }
  if (shell.parentElement === body && body.childElementCount === 1) {
    return true;
  }
  body.style.overflow = "hidden";
  body.replaceChildren(shell);
  shell.removeAttribute("aria-hidden");
  applyStandaloneTranslations(shell);
  return true;
}

function findNativeLeftSidebarBody(host) {
  const tablist = host.querySelector('[role="tablist"]');
  if (!tablist) {
    return null;
  }
  let candidate = tablist.nextElementSibling;
  while (candidate) {
    if (candidate instanceof HTMLElement) {
      return candidate;
    }
    candidate = candidate.nextElementSibling;
  }
  return null;
}

function isCdeAnnotationTabSelected(host) {
  const tabs = Array.from(host.querySelectorAll('[role="tab"]'));
  const selectedIndex = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  if (selectedIndex >= 0) {
    return selectedIndex === 1;
  }
  return uiScope()?.getSidebarTab(CDE_LEFT_SIDEBAR_ID) === CDE_ANNOTATION_TAB_ID;
}

function findNativeRightSidebarHost(shadowRoot) {
  const shell = elements.cdeReviewPanelShell;
  const hosts = Array.from(shadowRoot.querySelectorAll("[data-sidebar-id]"));
  return hosts.find((host) => {
    const id = host.getAttribute("data-sidebar-id");
    return id === CDE_REVIEW_SIDEBAR_ID || id === CDE_SEARCH_SIDEBAR_ID || host.contains(shell);
  }) || null;
}

function mountCdeReviewIntoNativeSidebar(activeHost) {
  const shell = elements.cdeReviewPanelShell;
  if (!shell) {
    return false;
  }
  const activeSidebarId = activeHost ? activeHost.getAttribute("data-sidebar-id") || "" : "";
  if (activeSidebarId !== CDE_REVIEW_SIDEBAR_ID || !isCdeReviewSidebarOpen()) {
    releaseCdeReviewSidebarShell(activeHost);
    return false;
  }
  const body = findNativeRightSidebarBody(activeHost);
  mountCdeShell(body || activeHost, shell);
  return true;
}

function releaseCdeReviewSidebarShell(activeHost = null) {
  const shell = elements.cdeReviewPanelShell;
  if (!shell) {
    return false;
  }
  const mountedHost = shell.closest("[data-sidebar-id]");
  if (!mountedHost) {
    return false;
  }
  const activeSidebarId = activeHost ? activeHost.getAttribute("data-sidebar-id") || "" : "";
  mountedHost.classList.remove("cde-native-sidebar-host");
  if (activeSidebarId === CDE_SEARCH_SIDEBAR_ID || activeHost !== mountedHost) {
    shell.setAttribute("aria-hidden", "true");
    elements.cdeNativePanels?.append(shell);
    return true;
  }
  return false;
}

function findNativeRightSidebarBody(host) {
  if (!host) {
    return null;
  }
  return Array.from(host.children).find((child) => (
    child instanceof HTMLElement &&
    child.classList.contains("min-h-0") &&
    child.classList.contains("flex-1")
  )) || null;
}

function mountCdeShell(host, shell) {
  if (!host || !shell || shell.parentElement === host) {
    return;
  }
  const nativeHost = host.matches?.("[data-sidebar-id]")
    ? host
    : host.closest?.("[data-sidebar-id]");
  nativeHost?.classList.add("cde-native-sidebar-host");
  host.replaceChildren(shell);
  shell.removeAttribute("aria-hidden");
  applyStandaloneTranslations(shell);
}

function installCdeNativePanelStyles(shadowRoot) {
  if (shadowRoot.querySelector("style[data-cde-native-panel-styles]")) {
    return;
  }
  const style = document.createElement("style");
  style.dataset.cdeNativePanelStyles = "";
  style.textContent = CDE_NATIVE_PANEL_CSS;
  shadowRoot.append(style);
}

function embedPdfShadowRoot() {
  return elements.embedPdfViewer?.querySelector("embedpdf-container")?.shadowRoot || null;
}

function uiScope(documentId = activeEmbedDocumentId()) {
  const ui = state.registry?.getPlugin("ui")?.provides();
  if (!ui || !documentId) {
    return null;
  }
  return ui.forDocument(documentId);
}

function nativeAnnotationApi() {
  return state.registry?.getPlugin("annotation")?.provides() || null;
}

function wireNativeAnnotationEvents() {
  const annotationApi = nativeAnnotationApi();
  if (!annotationApi) {
    return;
  }
  annotationApi.onAnnotationEvent((event) => {
    void syncNativeAnnotationEvent(event);
  });
  annotationApi.onStateChange?.(() => {
    syncCdeSelectionFromNative();
  });
  annotationApi.onActiveToolChange?.(({ tool }) => {
    document.querySelectorAll("[data-native-tool]").forEach((button) => {
      button.classList.toggle("active", tool?.id === button.dataset.nativeTool);
    });
  });
}

async function syncNativeAnnotationEvent(event) {
  if (!state.document || readOnlyMode()) {
    return;
  }
  const nativeAnnotation = event?.annotation || null;
  const nativeId = String(nativeAnnotation?.id || "");
  if (!nativeId || state.syncingNativeAnnotations.has(nativeId) || state.suppressedNativeAnnotationEvents.has(nativeId)) {
    return;
  }
  const existing = cdeAnnotationForNative(nativeAnnotation);
  if (event.type === "delete") {
    if (existing && canDeleteAnnotation(existing)) {
      await deleteAnnotation(existing, { skipConfirm: true, quiet: true, skipNative: true });
    }
    return;
  }
  if (event.type !== "create" && event.type !== "update") {
    return;
  }
  if (event.type === "create" && !canCreateAnnotation()) {
    return;
  }
  if (event.type === "update") {
    if (existing && !canEditAnnotation(existing)) {
      return;
    }
    if (!existing && !canCreateAnnotation()) {
      return;
    }
  }
  state.syncingNativeAnnotations.add(nativeId);
  try {
    if (existing) {
      const patch = nativeAnnotationPatchPayload(event, nativeAnnotation);
      const response = await patchJson(
        `/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(existing.id)}`,
        { actor: state.actor, nativeAnnotationId: nativeId, nativeAnnotation, ...patch },
      );
      syncDocument(response.document);
      clearAnnotationDraft(existing.id);
      state.selectedAnnotationId = existing.id;
      renderShell();
      return;
    }
    const payload = nativeAnnotationToCdePayload(event);
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations`, payload);
    syncDocument(response.document);
    state.selectedAnnotationId = response.annotation?.id || state.selectedAnnotationId;
    renderShell();
    notify("原生批注已同步到 CDE。", "success");
  } catch (error) {
    console.error(error);
    notify(error.message || "创建批注失败。", "alert");
  } finally {
    state.syncingNativeAnnotations.delete(nativeId);
  }
}

function syncCdeSelectionFromNative() {
  if (state.syncingNativeSelection || !state.document) {
    return;
  }
  const annotationApi = nativeAnnotationApi();
  if (!annotationApi) {
    return;
  }
  const selected = annotationApi.getSelectedAnnotations?.()[0] || annotationApi.getSelectedAnnotation?.();
  const annotation = selected ? cdeAnnotationForNative(trackedNativeAnnotation(selected)) : null;
  const nextId = annotation?.id || "";
  if (nextId === state.selectedAnnotationId) {
    return;
  }
  state.selectedAnnotationId = nextId;
  resetReplyDraftForAnnotation(nextId);
  if (nextId) {
    state.cdePanel = "annotations";
    openCdeReviewSidebar();
  }
  renderAnnotationList();
  renderDetail();
  renderPanelState();
}

function selectNativeAnnotationForCde(annotation) {
  const annotationApi = nativeAnnotationApi();
  const nativeId = cdeNativeAnnotationId(annotation);
  if (!annotationApi || !nativeId) {
    return false;
  }
  if (!annotationApi.getAnnotationById?.(nativeId)) {
    syncCdeAnnotationsToNativeLayer();
  }
  const pageIndex = cdeNativePageIndex(annotation);
  state.syncingNativeSelection = true;
  try {
    annotationApi.selectAnnotation(pageIndex, nativeId);
    return true;
  } finally {
    window.setTimeout(() => {
      state.syncingNativeSelection = false;
    }, 0);
  }
}

function syncNativeAnnotationFromCde(annotation) {
  const annotationApi = nativeAnnotationApi();
  const nativeId = cdeNativeAnnotationId(annotation);
  if (!annotationApi || !nativeId) {
    return false;
  }
  const pageIndex = cdeNativePageIndex(annotation);
  const patch = nativeAnnotationPatchFromCde(annotation);
  suppressNativeAnnotationEvent(nativeId);
  annotationApi.updateAnnotation(pageIndex, nativeId, patch);
  return true;
}

function deleteNativeAnnotationForCde(annotation) {
  const annotationApi = nativeAnnotationApi();
  const nativeId = cdeNativeAnnotationId(annotation);
  if (!annotationApi || !nativeId) {
    return false;
  }
  suppressNativeAnnotationEvent(nativeId);
  annotationApi.deleteAnnotation(cdeNativePageIndex(annotation), nativeId);
  state.importedCdeNativeAnnotationIds.delete(nativeId);
  return true;
}

function scheduleCdeNativeAnnotationSync() {
  if (state.nativeAnnotationSyncTimer) {
    window.clearTimeout(state.nativeAnnotationSyncTimer);
  }
  state.nativeAnnotationSyncTimer = window.setTimeout(() => {
    state.nativeAnnotationSyncTimer = 0;
    syncCdeAnnotationsToNativeLayer();
  }, 0);
}

function syncCdeAnnotationsToNativeLayer() {
  const annotationApi = nativeAnnotationApi();
  const annotations = state.document?.annotations || [];
  if (!annotationApi || !annotations.length) {
    return false;
  }
  let existingNativeIds = new Set();
  try {
    existingNativeIds = new Set((annotationApi.getAnnotations?.() || []).map((item) => trackedNativeAnnotation(item)?.id).filter(Boolean));
  } catch {
    existingNativeIds = new Set();
  }
  const transferItems = [];
  annotations.forEach((annotation) => {
    const nativeId = cdeNativeAnnotationId(annotation);
    if (!nativeId || existingNativeIds.has(nativeId) || state.importedCdeNativeAnnotationIds.has(nativeId)) {
      return;
    }
    const nativeAnnotation = cdeAnnotationToNativeAnnotation(annotation);
    if (!nativeAnnotation) {
      return;
    }
    suppressNativeAnnotationEvent(nativeId);
    state.importedCdeNativeAnnotationIds.add(nativeId);
    transferItems.push({ annotation: nativeAnnotation });
  });
  if (!transferItems.length) {
    return false;
  }
  annotationApi.importAnnotations(transferItems);
  return true;
}

function suppressNativeAnnotationEvent(nativeId, ttl = 1200) {
  if (!nativeId) {
    return;
  }
  state.suppressedNativeAnnotationEvents.add(nativeId);
  window.setTimeout(() => {
    state.suppressedNativeAnnotationEvents.delete(nativeId);
  }, ttl);
}

function trackedNativeAnnotation(item) {
  return item?.object || item?.annotation || item || null;
}

function cdeAnnotationForNative(nativeAnnotation) {
  const native = trackedNativeAnnotation(nativeAnnotation);
  const nativeId = String(native?.id || "");
  const cdeId = String(native?.custom?.cdeAnnotationId || "");
  return (state.document?.annotations || []).find((annotation) => {
    if (cdeId && annotation.id === cdeId) return true;
    return nativeId && (
      annotation.nativeAnnotationId === nativeId ||
      annotation.nativeAnnotation?.id === nativeId ||
      cdeNativeAnnotationId(annotation) === nativeId
    );
  }) || null;
}

function cdeNativeAnnotationId(annotation) {
  if (!annotation?.id) {
    return "";
  }
  return String(annotation.nativeAnnotationId || annotation.nativeAnnotation?.id || `cde-${annotation.id}`);
}

function cdeNativePageIndex(annotation) {
  if (annotation?.nativeAnnotation && Number.isFinite(Number(annotation.nativeAnnotation.pageIndex))) {
    return Math.max(0, Number(annotation.nativeAnnotation.pageIndex));
  }
  return Math.max(0, Number(annotation?.page ?? 1) - 1);
}

function cdeAnnotationToNativeAnnotation(annotation) {
  const pageIndex = cdeNativePageIndex(annotation);
  const base = {
    id: cdeNativeAnnotationId(annotation),
    pageIndex,
    rect: cdeNativeRect(annotation),
    contents: String(annotation.note || annotation.title || "").trim(),
    author: annotation.actor || state.actor || "CDE",
    flags: ["print"],
    custom: {
      ...(annotation.nativeAnnotation?.custom || {}),
      cdeAnnotationId: annotation.id,
      cdeManaged: true,
    },
  };
  const strokeColor = cdeNativeColor(annotation.color);
  if (annotation.nativeAnnotation?.id) {
    return {
      ...annotation.nativeAnnotation,
      ...base,
      custom: base.custom,
      contents: base.contents,
    };
  }
  if (annotation.type === "note" || annotation.type === "text") {
    return {
      ...base,
      type: PdfAnnotationSubtype.TEXT,
      strokeColor,
      opacity: 1,
    };
  }
  if (annotation.type === "line") {
    const rect = base.rect;
    return {
      ...base,
      type: PdfAnnotationSubtype.LINE,
      color: "#ffffff",
      opacity: 1,
      strokeWidth: 2,
      strokeColor,
      strokeStyle: PdfAnnotationBorderStyle.SOLID,
      linePoints: {
        start: { x: rect.origin.x, y: rect.origin.y },
        end: { x: rect.origin.x + rect.size.width, y: rect.origin.y + rect.size.height },
      },
    };
  }
  return {
    ...base,
    type: annotation.type === "circle" ? PdfAnnotationSubtype.CIRCLE : PdfAnnotationSubtype.SQUARE,
    color: "#ffffff",
    opacity: 0.18,
    strokeWidth: 2,
    strokeColor,
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
  };
}

function nativeAnnotationPatchFromCde(annotation) {
  return {
    contents: String(annotation.note || annotation.title || "").trim(),
    custom: {
      ...(annotation.nativeAnnotation?.custom || {}),
      cdeAnnotationId: annotation.id,
      cdeManaged: true,
    },
  };
}

function nativeAnnotationPatchPayload(event, nativeAnnotation) {
  const rect = nativeAnnotationRect(nativeAnnotation);
  const contents = String(nativeAnnotation?.contents || nativeAnnotation?.text || nativeAnnotation?.value || "").trim();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    ...(contents ? { note: contents } : {}),
  };
}

function cdeNativeRect(annotation) {
  if (annotation?.nativeAnnotation?.rect) {
    return annotation.nativeAnnotation.rect;
  }
  const x = clampRatio(annotation?.x ?? 0.18) * PDF_POINT_WIDTH;
  const y = clampRatio(annotation?.y ?? 0.18) * PDF_POINT_HEIGHT;
  const width = Math.max(24, clampRatio(annotation?.width ?? 0.12) * PDF_POINT_WIDTH);
  const height = Math.max(24, clampRatio(annotation?.height ?? 0.08) * PDF_POINT_HEIGHT);
  return {
    origin: { x, y },
    size: { width, height },
  };
}

function cdeNativeColor(color) {
  return {
    red: "#b3403c",
    amber: "#a16207",
    blue: "#2f6f9f",
  }[String(color || "").toLowerCase()] || "#0f766e";
}

function nativeAnnotationToCdePayload(event) {
  const annotation = event.annotation || {};
  const page = Number(event.pageIndex ?? annotation.pageIndex ?? 0) + 1;
  const type = cdeTypeFromNativeAnnotation(annotation);
  const rect = nativeAnnotationRect(annotation);
  return {
    actor: state.actor,
    source: "embedpdf_native",
    type,
    variant: type === "line" ? "arrow" : "",
    page,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    title: defaultAnnotationTitle(type, page),
    note: nativeAnnotationLabel(annotation, type),
    color: COLOR_BY_NATIVE_TYPE[type] || "red",
    status: "open",
    nativeAnnotationId: String(annotation.id || ""),
    nativeAnnotation: annotation,
  };
}

function nativeAnnotationLabel(annotation, type) {
  const contents = annotation.contents || annotation.text || annotation.value || "";
  return String(contents || `${annotationTypeLabel(type)}来自 EmbedPDF 原生批注`).trim();
}

function cdeTypeFromNativeAnnotation(annotation) {
  const subtypeName = nativeSubtypeName(annotation?.type || annotation?.subtype || "");
  if (/INK/.test(subtypeName)) return "pen";
  if (/CIRCLE/.test(subtypeName)) return "circle";
  if (/SQUARE|POLYGON|POLYLINE/.test(subtypeName)) return "mark";
  if (/LINE/.test(subtypeName)) return "line";
  if (/TEXT|FREE_TEXT|FREETEXT|HIGHLIGHT|UNDERLINE|STRIKEOUT|SQUIGGLY/.test(subtypeName)) return "note";
  return "note";
}

function nativeSubtypeName(value) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  const entry = Object.entries(PdfAnnotationSubtype || {}).find(([, enumValue]) => enumValue === value);
  return String(entry?.[0] || value || "").toUpperCase();
}

function nativeAnnotationRect(annotation) {
  const rect = annotation?.rect || annotation?.bounds || {};
  const origin = rect.origin || rect;
  const size = rect.size || rect;
  const rawX = Number(origin.x ?? rect.x ?? 0);
  const rawY = Number(origin.y ?? rect.y ?? 0);
  const rawWidth = Number(size.width ?? rect.width ?? 90);
  const rawHeight = Number(size.height ?? rect.height ?? 58);
  const pageWidth = Number(annotation?.pageSize?.width || annotation?.pageWidth || 612);
  const pageHeight = Number(annotation?.pageSize?.height || annotation?.pageHeight || 792);
  const x = rawX > 1 ? rawX / pageWidth : rawX;
  const y = rawY > 1 ? rawY / pageHeight : rawY;
  const width = rawWidth > 1 ? rawWidth / pageWidth : rawWidth;
  const height = rawHeight > 1 ? rawHeight / pageHeight : rawHeight;
  return {
    x: clampRatio(x),
    y: clampRatio(y),
    width: Math.max(0.02, Math.min(0.5, clampRatio(width || 0.12))),
    height: Math.max(0.02, Math.min(0.5, clampRatio(height || 0.08))),
  };
}

function renderShell() {
  renderTopbar();
  renderDocSummary();
  renderAnnotationList();
  renderDetail();
  renderReplies(selectedAnnotation());
  renderRemarks();
  renderWorkflowPanel();
  renderPanelState();
  applyStandaloneTranslations();
  applyStandaloneTranslations(elements.cdeAnnotationSidebarShell);
  applyStandaloneTranslations(elements.cdeReviewPanelShell);
  ensureCdeLocalizationObserver();
  scheduleCdeNativePanelMount();
  scheduleCdeNativeAnnotationSync();
}

// Re-localize the CDE sidebars whenever their content changes. Per-interaction
// renders (selecting an annotation, switching tabs) rebuild innerHTML in Chinese
// without going through renderShell, so a single render-time pass is not enough.
let cdeLocalizationObserver = null;
let cdeLocalizationQueued = false;
function ensureCdeLocalizationObserver() {
  if (cdeLocalizationObserver || currentLanguage() !== "en") {
    return;
  }
  const shells = [elements.cdeAnnotationSidebarShell, elements.cdeReviewPanelShell].filter(Boolean);
  if (!shells.length) {
    return;
  }
  const observe = () => shells.forEach((shell) => cdeLocalizationObserver.observe(shell, { subtree: true, childList: true, characterData: true }));
  cdeLocalizationObserver = new MutationObserver(() => {
    if (cdeLocalizationQueued) {
      return;
    }
    cdeLocalizationQueued = true;
    requestAnimationFrame(() => {
      cdeLocalizationQueued = false;
      cdeLocalizationObserver.disconnect();
      shells.forEach((shell) => applyStandaloneTranslations(shell));
      observe();
    });
  });
  observe();
}

function renderTopbar() {
  const doc = state.document || {};
  const source = currentPdfSource();
  document.title = `${doc.name || "PDF"} - PDF`;
  setText(elements.documentTitle, doc.name || "PDF 审阅页");
  setText(elements.documentVersion, source.version || doc.version || "V1");
  if (elements.documentStatus) {
    elements.documentStatus.textContent = statusBadge(doc.status);
    elements.documentStatus.className = `status-pill ${escapeHtml(doc.status || "neutral")}`;
  }
  setText(elements.documentPageSummary, `${(doc.annotations || []).length} 条批注`);
  const canExport = Boolean(annotationPermissions().export);
  if (elements.commentReportButton) {
    elements.commentReportButton.disabled = !canExport;
  }
  if (elements.exportButton) {
    elements.exportButton.disabled = !canExport;
  }
  setText(elements.documentMeta, [
    doc.projectName || doc.projectId || "CDE",
    doc.workflowName || activeWorkflow()?.workflowName || t("未关联流程", "No linked workflow"),
    readOnlyMode() ? t("只读", "Read Only") : t("审阅", "Review"),
  ].filter(Boolean).join(" / "));
}

function renderDocSummary() {
  const doc = state.document || {};
  const annotations = doc.annotations || [];
  const open = annotations.filter((item) => item.status !== "resolved").length;
  elements.reviewDocSummary.innerHTML = `
    <div class="summary-card"><span>批注总数</span><strong>${annotations.length}</strong></div>
    <div class="summary-card"><span>未闭环</span><strong>${open}</strong></div>
    <div class="summary-card"><span>版本</span><strong>${escapeHtml(currentPdfSource().version)}</strong></div>
    <div class="summary-card"><span>权限</span><strong>${escapeHtml(readOnlyMode() ? "只读" : "可审阅")}</strong></div>
  `;
  setText(elements.annotationTabBadge, String(annotations.length));
}

function renderAnnotationList() {
  const annotations = filteredAnnotations();
  if (!annotations.length) {
    elements.reviewAnnotationSidebarList.innerHTML = `<div class="empty-state"><strong>暂无批注</strong><p>使用 EmbedPDF 原生批注工具在图面上创建第一条审阅意见。</p></div>`;
    return;
  }
  elements.reviewAnnotationSidebarList.innerHTML = annotations.map((annotation, index) => `
    <button class="item-card ${annotation.id === state.selectedAnnotationId ? "active" : ""}" data-select-annotation="${escapeHtml(annotation.id)}" type="button">
      <div class="item-meta">
        <strong>${escapeHtml(displayAnnotation(annotation).title || defaultAnnotationTitle(annotation.type, annotation.page))}</strong>
        <span class="pill signal-pill ${escapeHtml(annotation.status || "open")}">${escapeHtml(statusLabel(annotation.status))}</span>
      </div>
      <p>${escapeHtml(displayAnnotation(annotation).note || "未填写说明")}</p>
      <p>第 ${Number(annotation.page || 1)} 页 / #${index + 1} / ${escapeHtml(annotation.actor || "系统")}</p>
    </button>
  `).join("");
  elements.reviewAnnotationSidebarList.querySelectorAll("[data-select-annotation]").forEach((button) => {
    button.addEventListener("click", () => {
      selectAnnotation(button.dataset.selectAnnotation || "");
      showCdePanel("annotations");
    });
  });
}

function displayAnnotation(annotation) {
  if (!annotation?.id) {
    return annotation;
  }
  const draft = state.annotationDrafts.get(annotation.id);
  return draft ? { ...annotation, ...draft } : annotation;
}

function syncAnnotationDraftFromInputs() {
  const annotation = selectedAnnotation();
  if (!annotation || !canEditAnnotation(annotation)) {
    return;
  }
  const title = elements.annotationTitleInput?.value || "";
  const note = elements.annotationDetailInput?.value || "";
  state.annotationDrafts.set(annotation.id, { title, note });
  setText(elements.annotationDetailHeading, title || annotation.title || "未选中批注");
  renderAnnotationList();
}

function clearAnnotationDraft(annotationId) {
  if (annotationId) {
    state.annotationDrafts.delete(annotationId);
  }
}

function renderDetail() {
  const annotation = selectedAnnotation();
  const draftAnnotation = displayAnnotation(annotation);
  const hasAnnotation = Boolean(annotation);
  elements.annotationEmptyCard?.classList.toggle("hidden", hasAnnotation);
  elements.annotationDetailBody?.classList.toggle("hidden", !hasAnnotation);
  setText(elements.annotationDetailHeading, draftAnnotation?.title || "未选中批注");
  setText(elements.annotationDetailBadge, annotation ? `#${annotationIndex(annotation.id)}` : "--");
  setText(elements.annotationMetaLine, annotation ? `${statusLabel(annotation.status)} / ${formatDateTime(annotation.createdAt)}` : "选择图面批注后查看说明、证据和处理记录。");
  if (!annotation) {
    renderAttachments(null);
    return;
  }
  setText(elements.annotationActorInput, annotation.actor || "系统");
  setText(elements.annotationPageInput, `第 ${Number(annotation.page || 1)} 页`);
  setText(elements.annotationTypeInput, annotationTypeLabel(annotation.type));
  setText(elements.annotationCreatedInput, formatDateTime(annotation.createdAt));
  if (elements.annotationTitleInput) elements.annotationTitleInput.value = draftAnnotation.title || "";
  if (elements.annotationDetailInput) elements.annotationDetailInput.value = draftAnnotation.note || "";
  elements.annotationStatusGroup?.querySelectorAll("[data-annotation-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.annotationStatus === (annotation.status || "open"));
    button.disabled = !canChangeAnnotationStatus(annotation);
  });
  const editable = canEditAnnotation(annotation);
  if (elements.saveAnnotationButton) elements.saveAnnotationButton.disabled = !editable;
  if (elements.deleteAnnotationButton) elements.deleteAnnotationButton.disabled = !canDeleteAnnotation(annotation);
  [elements.annotationTitleInput, elements.annotationDetailInput, elements.attachImageButton, elements.attachFileButton, elements.attachLinkButton].forEach((node) => {
    if (node) node.disabled = !editable;
  });
  renderAttachments(annotation);
  renderReplies(annotation);
  resetReplyDraftForAnnotation(annotation.id);
}

function renderAttachments(annotation) {
  const attachments = Array.isArray(annotation?.attachments) ? annotation.attachments : [];
  setText(elements.attachmentCountBadge, `${attachments.length} 项`);
  elements.annotationAttachmentList.innerHTML = attachments.length
    ? attachments.map((attachment) => renderAttachment(attachment, { removable: canEditAnnotation(annotation), action: "annotation" })).join("")
    : `<p class="section-text">暂无附件。</p>`;
  elements.annotationAttachmentList.querySelectorAll("[data-remove-annotation-attachment]").forEach((button) => {
    button.addEventListener("click", () => void removeAnnotationAttachment(button.dataset.removeAnnotationAttachment || ""));
  });
}

function renderReplies(annotation) {
  const replies = Array.isArray(annotation?.replies) ? annotation.replies : [];
  const canReply = Boolean(annotation) && canReplyAnnotation();
  if (elements.replyInput) elements.replyInput.disabled = !canReply;
  if (elements.replyButton) elements.replyButton.disabled = !canReply;
  [elements.replyAttachImageButton, elements.replyAttachFileButton, elements.replyAttachLinkButton].forEach((node) => {
    if (node) node.disabled = !canReply;
  });
  elements.replyList.innerHTML = !annotation
    ? `<div class="empty-state"><strong>未选中批注</strong><p>选择批注后查看回复与处理记录。</p></div>`
    : replies.length
      ? replies.map((reply) => `
        <article class="item-card">
          <div class="item-meta"><strong>${escapeHtml(reply.actor || "系统")}</strong><span class="pill">${escapeHtml(formatDateTime(reply.createdAt))}</span></div>
          <p>${escapeHtml(reply.content || "补充了附件")}</p>
          ${(reply.attachments || []).map((attachment) => renderAttachment(attachment)).join("")}
        </article>
      `).join("")
      : `<div class="empty-state"><strong>暂无回复</strong><p>处理过程、修订说明和结论会出现在这里。</p></div>`;
  renderReplyAttachments();
}

function renderReplyAttachments() {
  const attachments = state.replyAttachments || [];
  setText(elements.replyAttachmentCountBadge, `${attachments.length} 项`);
  elements.replyAttachmentList.innerHTML = attachments.length
    ? attachments.map((attachment) => renderAttachment(attachment, { removable: true, action: "reply" })).join("")
    : "";
  elements.replyAttachmentList.querySelectorAll("[data-remove-reply-attachment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.replyAttachments = state.replyAttachments.filter((attachment) => attachment.id !== button.dataset.removeReplyAttachment);
      renderReplyAttachments();
    });
  });
}

function renderAttachment(attachment, options = {}) {
  const href = attachment.url || attachment.previewUrl || "#";
  const label = attachment.name || attachment.url || "附件";
  const removeButton = options.removable
    ? `<button class="ghost-button" data-remove-${escapeHtml(options.action || "annotation")}-attachment="${escapeHtml(attachment.id)}" type="button">移除</button>`
    : "";
  return `
    <article class="attachment-card">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(attachment.kind || attachment.mimeType || "attachment")} / ${escapeHtml(formatBytes(attachment.size || 0))}</span>
      </div>
      <div class="button-row">
        ${href && href !== "#" ? `<a class="link-button" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">打开</a>` : ""}
        ${removeButton}
      </div>
    </article>`;
}

function renderRemarks() {
  if (elements.remarksInput) {
    elements.remarksInput.value = state.document?.remarks || "";
    elements.remarksInput.disabled = readOnlyMode();
  }
  if (elements.saveRemarksButton) {
    elements.saveRemarksButton.disabled = readOnlyMode();
  }
}

function renderWorkflowPanel() {
  const doc = state.document || {};
  const workflow = activeWorkflow();
  const hasWorkflow = Boolean(doc.activeWorkflowId || workflow?.id || doc.workflowId);
  setText(elements.workflowHealthBadge, hasWorkflow ? (doc.statusLabel || statusBadge(doc.status)) : "待发起");
  elements.workflowHealthBadge.className = `pill signal-pill ${doc.status === "approved" ? "success" : doc.status === "rejected" ? "danger" : "open"}`;
  const annotations = doc.annotations || [];
  const open = annotations.filter((item) => item.status !== "resolved").length;
  elements.workflowSummaryGrid.innerHTML = `
    <div class="summary-card"><span>当前流程</span><strong>${escapeHtml(workflow?.workflowName || doc.workflowName || "未发起")}</strong></div>
    <div class="summary-card"><span>文档状态</span><strong>${escapeHtml(doc.statusLabel || statusBadge(doc.status))}</strong></div>
    <div class="summary-card"><span>批注总数</span><strong>${annotations.length}</strong></div>
    <div class="summary-card"><span>未解决</span><strong>${open}</strong></div>`;
  if (elements.workflowTemplateSelect) {
    elements.workflowTemplateSelect.innerHTML = state.templates.length
      ? state.templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`).join("")
      : `<option value="">暂无模板</option>`;
  }
  if (elements.workflowNameInput && !elements.workflowNameInput.value) {
    elements.workflowNameInput.value = doc.name ? `${doc.name} 审阅` : "";
  }
  const canLaunch = canLaunchWorkflow();
  elements.workflowLaunchControls?.classList.toggle("hidden", !canLaunch && Boolean(doc.activeWorkflowId));
  elements.workflowLaunchActions?.classList.toggle("hidden", !canLaunch);
  if (elements.startFlowButton) elements.startFlowButton.disabled = !canLaunch;
  setText(elements.workflowLaunchHint, hasWorkflow
    ? "当前文件已关联审批流程。"
    : state.templates.length
      ? "选择模板并填写名称后发起审批流程。"
      : "当前没有可用流程模板，请先在系统中配置。");
  renderWorkflowActions();
  renderWorkflowSteps();
  renderActivityList();
}

function renderWorkflowActions() {
  const actions = workflowActionDefinitions();
  elements.workflowActions.innerHTML = actions.length
    ? actions.map((item) => `<button class="${item.tone === "primary" ? "primary-button" : "ghost-button"} ${item.tone === "danger" ? "danger-button" : ""}" data-workflow-action="${escapeHtml(item.action)}" type="button">${escapeHtml(item.label)}</button>`).join("")
    : `<span class="section-text">${escapeHtml(workflowIdleNote())}</span>`;
  elements.workflowActions.querySelectorAll("[data-workflow-action]").forEach((button) => {
    button.addEventListener("click", () => void runWorkflowAction(button.dataset.workflowAction || ""));
  });
}

function renderWorkflowSteps() {
  const workflow = activeWorkflow();
  const steps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  elements.workflowSteps.innerHTML = steps.length
    ? steps.map((step, index) => `
      <article class="item-card">
        <div class="item-meta"><strong>${escapeHtml(`${index + 1}. ${step.name || "审批节点"}`)}</strong><span class="pill">${escapeHtml(workflowStepLabel(step.status))}</span></div>
        <p>${escapeHtml((step.reviewers || []).map((reviewer) => reviewer.name).filter(Boolean).join(" / ") || "未指定")}</p>
        <p>${escapeHtml(step.completedAt ? formatDateTime(step.completedAt) : "等待处理")}</p>
      </article>`).join("")
    : "";
}

function renderActivityList() {
  const workflow = activeWorkflow();
  const items = Array.isArray(workflow?.activity) && workflow.activity.length
    ? workflow.activity
    : Array.isArray(state.document?.activity)
      ? [...state.document.activity].reverse()
      : [];
  elements.activityList.innerHTML = items.length
    ? items.slice(0, 10).map((item) => `
      <article class="item-card">
        <div class="item-meta"><strong>${escapeHtml(item.actor || "系统")}</strong><span class="pill">${escapeHtml(item.label || "活动")}</span></div>
        <p>${escapeHtml(item.note || "")}</p>
        <p>${escapeHtml(formatDateTime(item.timestamp))}</p>
      </article>`).join("")
    : "";
}

function renderPanelState() {
  elements.cdeTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.cdePanelTab === state.cdePanel);
  });
  elements.panelSections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.panelName !== state.cdePanel);
  });
  setText(elements.cdePanelTitle, {
    annotations: "批注详情",
    comments: "评论与备注",
    workflow: "流程中心",
  }[state.cdePanel] || "批注与流程");
}

function showCdePanel(panel) {
  state.cdePanel = ["annotations", "comments", "workflow"].includes(panel) ? panel : "annotations";
  openCdeReviewSidebar();
  renderPanelState();
  scheduleCdeNativePanelMount();
}

function toggleCdeDock() {
  if (isCdeReviewSidebarOpen()) {
    closeCdeReviewSidebar();
  } else {
    openCdeReviewSidebar();
  }
  scheduleCdeNativePanelMount();
}

function openNativeLeftSidebar(documentId = activeEmbedDocumentId()) {
  const scope = uiScope(documentId);
  if (!scope) {
    return;
  }
  scope.setActiveSidebar("left", "main", CDE_LEFT_SIDEBAR_ID, CDE_ANNOTATION_TAB_ID);
  scope.setSidebarTab(CDE_LEFT_SIDEBAR_ID, CDE_ANNOTATION_TAB_ID);
}

function openCdeReviewSidebar(documentId = activeEmbedDocumentId()) {
  const scope = uiScope(documentId);
  if (!scope) {
    return;
  }
  scope.setActiveSidebar("right", "main", CDE_REVIEW_SIDEBAR_ID);
}

function closeCdeReviewSidebar(documentId = activeEmbedDocumentId()) {
  const scope = uiScope(documentId);
  if (!scope) {
    return;
  }
  scope.closeSidebarSlot("right", "main");
}

function isCdeReviewSidebarOpen(documentId = activeEmbedDocumentId()) {
  const scope = uiScope(documentId);
  return Boolean(scope?.isSidebarOpen("right", "main", CDE_REVIEW_SIDEBAR_ID));
}

function activeEmbedDocumentId() {
  return state.registry?.getStore?.().getState?.().core?.activeDocumentId || "";
}

function setNativeTool(toolId) {
  if (readOnlyMode()) {
    notify("当前为只读模式，不能创建批注。", "alert");
    return;
  }
  const annotationApi = state.registry?.getPlugin("annotation")?.provides();
  if (!annotationApi) {
    return;
  }
  annotationApi.setActiveTool(toolId || null);
}

async function saveSelectedAnnotation() {
  const annotation = selectedAnnotation();
  if (!annotation || !canEditAnnotation(annotation)) {
    return;
  }
  const title = elements.annotationTitleInput?.value?.trim() || annotation.title;
  const note = elements.annotationDetailInput?.value?.trim() || "";
  try {
    const response = await patchJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}`, {
      actor: state.actor,
      title,
      note,
    });
    const updatedAnnotation = response.annotation || response.document?.annotations?.find((item) => item.id === annotation.id) || { ...annotation, title, note };
    syncDocument(response.document);
    clearAnnotationDraft(annotation.id);
    syncNativeAnnotationFromCde(updatedAnnotation);
    notify("批注已保存。", "success");
    renderShell();
  } catch (error) {
    notify(error.message || "保存批注失败。", "alert");
  }
}

async function updateAnnotationStatus(status) {
  const annotation = selectedAnnotation();
  if (!annotation || !canChangeAnnotationStatus(annotation)) {
    return;
  }
  try {
    const response = await patchJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}`, {
      actor: state.actor,
      status,
    });
    syncDocument(response.document);
    notify("状态已更新。", "success");
    renderShell();
  } catch (error) {
    notify(error.message || "更新状态失败。", "alert");
  }
}

async function deleteSelectedAnnotation() {
  const annotation = selectedAnnotation();
  if (annotation) {
    await deleteAnnotation(annotation);
  }
}

async function deleteAnnotation(annotation, options = {}) {
  if (!annotation || !canDeleteAnnotation(annotation)) {
    return;
  }
  if (!options.skipConfirm && !window.confirm("确认删除这条批注吗？")) {
    return;
  }
  try {
    const response = await deleteJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}`, { actor: state.actor });
    syncDocument(response.document);
    if (!options.skipNative) {
      deleteNativeAnnotationForCde(annotation);
    }
    clearAnnotationDraft(annotation.id);
    if (state.selectedAnnotationId === annotation.id) {
      state.selectedAnnotationId = "";
    }
    if (!options.quiet) notify("批注已删除。", "success");
    renderShell();
  } catch (error) {
    notify(error.message || "删除批注失败。", "alert");
  }
}

async function pickAnnotationFiles(kind) {
  const annotation = selectedAnnotation();
  if (!annotation || !canEditAnnotation(annotation)) {
    return;
  }
  const files = await chooseFiles(kind);
  if (!files.length) return;
  try {
    const next = await filesToAttachments(files, kind, annotation.attachments || []);
    await updateAnnotationAttachments([...(annotation.attachments || []), ...next]);
  } catch (error) {
    notify(error.message || "添加附件失败。", "alert");
  }
}

async function addAnnotationLink() {
  const annotation = selectedAnnotation();
  if (!annotation || !canEditAnnotation(annotation)) {
    return;
  }
  const url = window.prompt("请输入附件链接 URL");
  if (!url) return;
  const next = {
    id: randomId(),
    kind: "link",
    name: url,
    mimeType: "text/uri-list",
    url,
    size: 0,
    createdAt: new Date().toISOString(),
  };
  try {
    await updateAnnotationAttachments([...(annotation.attachments || []), next]);
  } catch (error) {
    notify(error.message || "添加链接失败。", "alert");
  }
}

async function removeAnnotationAttachment(attachmentId) {
  const annotation = selectedAnnotation();
  if (!annotation || !canEditAnnotation(annotation)) {
    return;
  }
  await updateAnnotationAttachments((annotation.attachments || []).filter((attachment) => attachment.id !== attachmentId));
}

async function updateAnnotationAttachments(attachments) {
  const annotation = selectedAnnotation();
  const response = await patchJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}`, {
    actor: state.actor,
    attachments: serializeAttachments(attachments),
  });
  syncDocument(response.document);
  notify("附件已更新。", "success");
  renderShell();
}

async function pickReplyFiles(kind) {
  const annotation = selectedAnnotation();
  if (!annotation || !canReplyAnnotation()) {
    return;
  }
  const files = await chooseFiles(kind);
  if (!files.length) return;
  try {
    state.replyAttachments = [
      ...(state.replyAttachments || []),
      ...(await filesToAttachments(files, kind, state.replyAttachments || [])),
    ];
    renderReplyAttachments();
  } catch (error) {
    notify(error.message || "添加回复附件失败。", "alert");
  }
}

function addReplyLink() {
  const annotation = selectedAnnotation();
  if (!annotation || !canReplyAnnotation()) {
    return;
  }
  const url = window.prompt("请输入回复附件链接 URL");
  if (!url) return;
  state.replyAttachments = [
    ...(state.replyAttachments || []),
    {
      id: randomId(),
      kind: "link",
      name: url,
      mimeType: "text/uri-list",
      url,
      size: 0,
      createdAt: new Date().toISOString(),
    },
  ];
  renderReplyAttachments();
}

async function replyToSelectedAnnotation() {
  const annotation = selectedAnnotation();
  const content = elements.replyInput?.value?.trim() || "";
  const attachments = serializeAttachments(state.replyAttachments || []);
  if (!annotation || (!content && !attachments.length)) {
    notify("请输入回复内容或添加附件。", "alert");
    return;
  }
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}/replies`, {
      actor: state.actor,
      content,
      attachments,
    });
    syncDocument(response.document);
    if (elements.replyInput) elements.replyInput.value = "";
    state.replyAttachments = [];
    notify("回复已发布。", "success");
    renderShell();
  } catch (error) {
    notify(error.message || "发布回复失败。", "alert");
  }
}

async function saveRemarks() {
  if (readOnlyMode()) {
    return;
  }
  try {
    const response = await fetchJson(`/api/documents/${encodeURIComponent(state.document.id)}/remarks`, {
      method: "PATCH",
      body: JSON.stringify({
        actor: state.actor,
        remarks: elements.remarksInput?.value || "",
      }),
    });
    syncDocument(response.document);
    notify("备注已保存。", "success");
    renderShell();
  } catch (error) {
    notify(error.message || "保存备注失败。", "alert");
  }
}

async function exportReviewedPdf() {
  if (!annotationPermissions().export) {
    notify("你没有导出批注版的权限。", "alert");
    return;
  }
  setBusy(elements.exportButton, true, "导出中");
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/export`, { actor: state.actor, language: currentLanguage() });
    syncDocument(response.document);
    if (response.downloadUrl) {
      window.open(response.downloadUrl, "_blank", "noopener");
    }
    notify("批注版已生成。", "success");
  } catch (error) {
    notify(error.message || "导出批注版失败。", "alert");
  } finally {
    setBusy(elements.exportButton, false, "导出批注版");
  }
}

async function exportCommentReport() {
  if (!annotationPermissions().export) {
    notify("你没有导出评论清单的权限。", "alert");
    return;
  }
  setBusy(elements.commentReportButton, true, "导出中");
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/comment-report`, { actor: state.actor, language: currentLanguage() });
    syncDocument(response.document);
    if (response.downloadUrl) {
      window.open(response.downloadUrl, "_blank", "noopener");
    }
    notify("评论清单已生成。", "success");
  } catch (error) {
    notify(error.message || "导出评论清单失败。", "alert");
  } finally {
    setBusy(elements.commentReportButton, false, "导出评论");
  }
}

async function loadWorkflowTemplates() {
  if (!elements.workflowTemplateSelect) {
    return;
  }
  try {
    const payload = await fetchJson("/api/workflow-templates");
    state.templates = Array.isArray(payload.workflowTemplates)
      ? payload.workflowTemplates
      : (Array.isArray(payload.templates) ? payload.templates : []);
    renderWorkflowPanel();
  } catch (error) {
    console.warn("流程模板加载失败", error);
  }
}

async function launchWorkflow() {
  const templateId = elements.workflowTemplateSelect?.value || "";
  const name = elements.workflowNameInput?.value?.trim() || "";
  if (!templateId || !name) {
    notify("请选择流程模板并填写流程名称。", "alert");
    return;
  }
  try {
    const response = await postJson("/api/workflows", {
      actor: state.actor,
      templateId,
      workflowName: name,
      documentIds: [state.document.id],
    });
    syncDocument(response.document);
    syncWorkflow(response.workflow);
    notify("流程已发起。", "success");
    renderShell();
  } catch (error) {
    notify(error.message || "发起流程失败。", "alert");
  }
}

async function runWorkflowAction(action) {
  const definition = workflowActionDefinitions().find((item) => item.action === action);
  if (!definition) return;
  if (definition.confirmation && !window.confirm(definition.confirmation)) {
    return;
  }
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/actions`, {
      action,
      actor: state.actor,
    });
    syncDocument(response.document);
    syncWorkflow(response.workflow);
    notify("流程已更新。", "success");
    renderShell();
  } catch (error) {
    notify(error.message || "流程动作失败。", "alert");
  }
}

function workflowActionDefinitions() {
  if (!state.document || readOnlyMode() || !state.document.activeWorkflowId) {
    return [];
  }
  const permissions = state.document.permissions?.workflow || {};
  const workflow = activeWorkflow();
  const actions = [];
  if (permissions.withdraw) {
    actions.push({ action: "withdrawFlow", label: "撤回流程", tone: "ghost", confirmation: "确认撤回当前流程吗？" });
  }
  if (permissions.run) {
    const isFinal = Boolean(workflow?.permissions?.isFinalStep || permissions.assignedApprover || state.document.status === "final_review");
    if (isFinal) {
      actions.push(
        { action: "rejectFlow", label: "退回修改", tone: "danger", confirmation: "确认退回发起人修改吗？" },
        { action: "approveFlow", label: "批准归档", tone: "primary", confirmation: "确认批准归档吗？归档后批注和回复会锁定。" },
      );
    } else {
      actions.push(
        { action: "returnToInitiator", label: "退回发起人", tone: "ghost", confirmation: "确认退回发起人修订吗？" },
        { action: "submitToApprover", label: "提交终审", tone: "primary", confirmation: "确认完成当前节点并提交下一步吗？" },
      );
    }
  }
  return actions;
}

function workflowIdleNote() {
  if (readOnlyMode()) return "只读模式下不显示流转动作。";
  if (canLaunchWorkflow()) return "补充批注、备注和附件后可发起流程。";
  if (state.document?.activeWorkflowId) return "当前节点暂无你可执行的流转动作。";
  return "当前没有运行中的流程。";
}

function activeWorkflow() {
  const workflowId = state.document?.activeWorkflowId || "";
  return workflowId ? state.workflows.find((workflow) => workflow.id === workflowId) || null : null;
}

function canLaunchWorkflow() {
  return state.templates.length > 0 && Boolean(state.document?.permissions?.workflow?.start) && !state.document?.activeWorkflowId && !readOnlyMode();
}

function syncDocument(doc) {
  if (doc) {
    state.document = doc;
  }
}

function syncWorkflow(workflow) {
  if (!workflow?.id) return;
  const index = state.workflows.findIndex((item) => item.id === workflow.id);
  if (index >= 0) {
    state.workflows.splice(index, 1, workflow);
  } else {
    state.workflows.unshift(workflow);
  }
}

function selectAnnotation(annotationId, options = {}) {
  state.selectedAnnotationId = annotationId;
  resetReplyDraftForAnnotation(annotationId);
  renderAnnotationList();
  renderDetail();
  if (options.syncNative !== false) {
    selectNativeAnnotationForCde(selectedAnnotation());
  }
}

function resetReplyDraftForAnnotation(annotationId) {
  if (state.replyAttachmentAnnotationId === annotationId) {
    return;
  }
  state.replyAttachmentAnnotationId = annotationId;
  state.replyAttachments = [];
  if (elements.replyInput) elements.replyInput.value = "";
}

function selectedAnnotation() {
  return (state.document?.annotations || []).find((annotation) => annotation.id === state.selectedAnnotationId) || null;
}

function filteredAnnotations() {
  const annotations = [...(state.document?.annotations || [])];
  const filtered = annotations.filter((annotation) => state.filter === "all" || annotation.status === state.filter);
  return filtered.sort((a, b) => Number(a.page || 1) - Number(b.page || 1) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

function annotationIndex(annotationId) {
  const index = (state.document?.annotations || []).findIndex((annotation) => annotation.id === annotationId);
  return index >= 0 ? index + 1 : "--";
}

function currentPdfSource() {
  const doc = state.document;
  if (!state.versionId) {
    return { url: doc.fileUrl, version: doc.version || "V1", updatedAt: doc.updatedAt, isCurrent: true };
  }
  const entry = (doc.versionHistory || []).find((item) => item.id === state.versionId);
  if (!entry) {
    throw new Error("未找到指定的历史版本。");
  }
  return {
    url: entry.previewUrl || entry.fileUrl,
    version: entry.version || "History",
    updatedAt: entry.uploadedAt || doc.updatedAt,
    isCurrent: entry.isCurrent || entry.id === doc.currentVersionId,
  };
}

function appendCacheParam(url, value) {
  const nextUrl = new URL(url, window.location.origin);
  if (value) {
    nextUrl.searchParams.set("t", value);
  }
  return nextUrl.toString();
}

function localEmbedPdfAssetUrl(pathname) {
  const assetUrl = new URL(pathname, window.location.origin);
  assetUrl.searchParams.set("v", EMBEDPDF_ASSET_VERSION);
  return assetUrl.toString();
}

function isPdfDocument(doc) {
  const name = String(doc?.name || "").toLowerCase();
  return doc?.mimeType === "application/pdf" || name.endsWith(".pdf") || doc?.isPdf;
}

function canPreviewDocument() {
  return Boolean(state.document?.permissions?.preview);
}

function annotationPermissions() {
  return state.document?.permissions?.annotations || {};
}

function readOnlyMode() {
  return state.mode === "view" || state.document?.status === "approved";
}

function canCreateAnnotation() {
  return Boolean(annotationPermissions().create) && !readOnlyMode();
}

function canEditAnnotation(annotation) {
  if (!annotation || readOnlyMode()) return false;
  const permissions = annotationPermissions();
  if (annotation.actor === state.actor) {
    return Boolean(permissions.updateOwn ?? permissions.create);
  }
  return Boolean(permissions.deleteOthers);
}

function canDeleteAnnotation(annotation) {
  if (!annotation || readOnlyMode()) return false;
  const permissions = annotationPermissions();
  if (annotation.actor === state.actor) {
    return Boolean(permissions.deleteOwn ?? permissions.updateOwn ?? permissions.create);
  }
  return Boolean(permissions.deleteOthers);
}

function canReplyAnnotation() {
  return Boolean(annotationPermissions().reply) && !readOnlyMode();
}

function canChangeAnnotationStatus(annotation) {
  if (!annotation || readOnlyMode()) return false;
  const permissions = annotationPermissions();
  if (!permissions.changeStatus) return false;
  if (permissions.changeStatusAny || permissions.deleteOthers) return true;
  return annotation.actor === state.actor && Boolean(permissions.updateOwn ?? permissions.create);
}

async function chooseFiles(kind) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = kind === "image" ? "image/*" : ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.dwg,.dxf,.dgn,.idw,.nwd,.nwc,.rvt,.ifc,.txt,.zip";
    input.addEventListener("change", () => resolve(Array.from(input.files || [])));
    input.click();
  });
}

async function filesToAttachments(files, kind, existing = []) {
  if (existing.length + files.length > MAX_ATTACHMENT_COUNT) {
    throw new Error(`附件最多支持 ${MAX_ATTACHMENT_COUNT} 项。`);
  }
  const attachments = [];
  for (const file of files) {
    validateAttachmentFile(file, kind);
    const dataUrl = await readFileAsDataUrl(file);
    attachments.push({
      id: randomId(),
      kind,
      name: file.name || (kind === "image" ? "未命名图片" : "未命名附件"),
      mimeType: file.type || inferMimeType(file.name, kind),
      size: file.size || 0,
      dataBase64: String(dataUrl).split(",")[1] || "",
      createdAt: new Date().toISOString(),
    });
  }
  return attachments;
}

function validateAttachmentFile(file, kind) {
  if (!file) return;
  if (kind === "image") {
    if (!String(file.type || "").startsWith("image/")) {
      throw new Error("图片附件只支持图片文件。");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("单张图片不能超过 10MB。");
    }
    return;
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("单个文件不能超过 50MB。");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result || ""));
    reader.addEventListener("error", () => reject(reader.error || new Error("文件读取失败。")));
    reader.readAsDataURL(file);
  });
}

function serializeAttachments(attachments = []) {
  return attachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
    storageName: attachment.storageName,
    dataBase64: attachment.dataBase64,
    createdAt: attachment.createdAt,
  }));
}

function inferMimeType(name, kind) {
  if (kind === "image") return "image/png";
  const extension = String(name || "").split(".").pop()?.toLowerCase() || "";
  return {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv; charset=utf-8",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    zip: "application/zip",
  }[extension] || "application/octet-stream";
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  const labelNode = button.querySelector(".text-label") || button;
  labelNode.textContent = localizeStandaloneText(label);
}

function showProgress(title, message, ratio = 0) {
  if (!elements.progressOverlay) return;
  elements.progressOverlay.classList.remove("hidden");
  setText(elements.progressTitle, localizeStandaloneText(title));
  setText(elements.progressText, localizeStandaloneText(message));
  if (elements.progressBar) {
    elements.progressBar.style.width = `${Math.max(4, Math.min(100, ratio * 100))}%`;
  }
}

function hideProgress() {
  elements.progressOverlay?.classList.add("hidden");
}

function showState(title, message) {
  showProgress(localizeStandaloneText(title), localizeStandaloneText(message), 1);
}

function notify(message, tone = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.textContent = tone === "alert"
    ? localizeUserMessage(message, t("操作失败，请稍后重试。", "Operation failed. Please try again later."))
    : localizeUserMessage(message, message);
  elements.toastRegion?.append(toast);
  window.setTimeout(() => toast.remove(), tone === "alert" ? 5200 : 2800);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(localizeUserMessage(payload.error, t("请求失败，请稍后重试。", "Request failed. Please try again later.")));
  }
  return payload;
}

function postJson(url, body) {
  return fetchJson(url, { method: "POST", body: JSON.stringify(body || {}) });
}

function patchJson(url, body) {
  return fetchJson(url, { method: "PATCH", body: JSON.stringify(body || {}) });
}

function deleteJson(url, body) {
  return fetchJson(url, { method: "DELETE", body: JSON.stringify(body || {}) });
}

function defaultAnnotationTitle(type, page) {
  return `${annotationTypeLabel(type)} · 第 ${Number(page || 1)} 页`;
}

function annotationTypeLabel(type) {
  return {
    circle: "定点批注",
    mark: "矩形批注",
    note: "文本批注",
    line: "箭头批注",
    pen: "手绘批注",
  }[type] || "批注";
}

function statusLabel(status) {
  return {
    open: t("未解决", "Open"),
    in_progress: t("进行中", "In Progress"),
    resolved: t("已解决", "Resolved"),
  }[status] || t("未解决", "Open");
}

function statusBadge(status) {
  return {
    draft: t("草稿", "Draft"),
    uploaded: t("已上传", "Uploaded"),
    in_review: t("审阅中", "In Review"),
    final_review: t("终审", "Final Review"),
    approved: t("已归档", "Archived"),
    rejected: t("已退回", "Returned"),
  }[status] || t("待审阅", "Pending Review");
}

function workflowStepLabel(status) {
  return {
    approved: t("已完成", "Completed"),
    active: t("处理中", "In Progress"),
    rejected: t("已退回", "Returned"),
  }[status] || t("等待", "Waiting");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(currentLanguage() === "en" ? "en-US" : "zh-CN", { hour12: false });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

function setText(node, value) {
  if (node) {
    node.textContent = String(value ?? "");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clampRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(1, number));
}

function randomId() {
  return window.crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

window.__cdePdfReview = {
  state,
  showCdePanel,
  openNativeLeftSidebar,
};
