import { GlobalWorkerOptions, getDocument } from "/vendor/pdfjs/pdf.mjs";

GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";

const params = new URLSearchParams(window.location.search);
const state = {
  docId: params.get("id") || params.get("docId") || "",
  versionId: params.get("versionId") || "",
  mode: params.get("mode") === "view" ? "view" : "review",
  actor: "",
  document: null,
  pdfDoc: null,
  page: Math.max(1, Number(params.get("page") || 1) || 1),
  zoom: 1,
  fitWidth: true,
  renderToken: 0,
  selectedAnnotationId: params.get("annotationId") || params.get("issueId") || "",
  filter: "all",
  activeTool: "circle",
  activeColor: "red",
  draft: null,
  drag: null,
  pan: null,
  thumbnailsBuilt: false,
  templates: [],
  searchHighlight: parseSearchHighlight(params),
};

const COLOR_LABELS = { red: "红", amber: "琥珀", blue: "蓝" };

const el = (id) => document.getElementById(id);
const elements = {
  documentTitle: el("documentTitle"),
  documentTitleMirror: el("documentTitleMirror"),
  documentVersion: el("documentVersion"),
  documentVersionMirror: el("documentVersionMirror"),
  documentStatus: el("documentStatus"),
  documentStatusMirror: el("documentStatusMirror"),
  documentMeta: el("documentMeta"),
  documentPageSummary: el("documentPageSummary"),
  documentPageSummaryMirror: el("documentPageSummaryMirror"),
  reviewProjectLine: el("reviewProjectLine"),
  exportButton: el("exportButton"),
  commentReportButton: el("commentReportButton"),
  exportLink: el("exportLink"),
  printButton: el("printButton"),
  shareButton: el("shareButton"),
  reviewDocSummary: el("reviewDocSummary"),
  annotationTabBadge: el("annotationTabBadge"),
  reviewSideTabs: Array.from(document.querySelectorAll("[data-review-tab]")),
  reviewAnnotationSidebar: el("reviewAnnotationSidebar"),
  annotationFilter: el("annotationFilter"),
  reviewAnnotationSidebarList: el("reviewAnnotationSidebarList"),
  reviewThumbList: el("reviewThumbList"),
  viewerFrame: el("viewerFrame"),
  canvasPageControls: el("canvasPageControls"),
  prevPageButton: el("prevPageButton"),
  nextPageButton: el("nextPageButton"),
  pageInput: el("pageInput"),
  pageIndicator: el("pageIndicator"),
  viewerEmpty: el("viewerEmpty"),
  progressOverlay: el("progressOverlay"),
  progressBar: el("progressBar"),
  progressText: el("progressText"),
  progressTitle: el("progressTitle"),
  canvasWrap: el("canvasWrap"),
  pageStage: el("pageStage"),
  pdfCanvas: el("pdfCanvas"),
  annotationLayer: el("annotationLayer"),
  zoomOutButton: el("zoomOutButton"),
  zoomInButton: el("zoomInButton"),
  zoomIndicator: el("zoomIndicator"),
  fitViewButton: el("fitViewButton"),
  fullscreenButton: el("fullscreenButton"),
  toolStrip: el("toolStrip"),
  toolButtons: Array.from(document.querySelectorAll("[data-tool]")),
  annotationModeButton: el("annotationModeButton"),
  fauxToolButtons: Array.from(document.querySelectorAll("[data-faux-tool]")),
  toolbarColorButtons: Array.from(document.querySelectorAll("[data-toolbar-color]")),
  draftHint: el("draftHint"),
  reviewPermissionHint: el("reviewPermissionHint"),
  pageAnnotationSummary: el("pageAnnotationSummary"),
  cancelDraftButton: el("cancelDraftButton"),
  // right panel - workflow
  workflowPanel: el("workflowPanel"),
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
  reviewWorkflowActionGroup: el("reviewWorkflowActionGroup"),
  // right panel - annotation detail
  annotationDetailHeading: el("annotationDetailHeading"),
  annotationMetaLine: el("annotationMetaLine"),
  annotationDetailBadge: el("annotationDetailBadge"),
  annotationEmptyCard: el("annotationEmptyCard"),
  annotationReadonlyNote: el("annotationReadonlyNote"),
  annotationDetailBody: el("annotationDetailBody"),
  annotationStatusGroup: el("annotationStatusGroup"),
  annotationColorGroup: el("annotationColorGroup"),
  annotationColorReadout: el("annotationColorReadout"),
  annotationActorInput: el("annotationActorInput"),
  annotationCreatedInput: el("annotationCreatedInput"),
  annotationPageInput: el("annotationPageInput"),
  annotationTypeInput: el("annotationTypeInput"),
  annotationSummaryNote: el("annotationSummaryNote"),
  annotationViewActions: el("annotationViewActions"),
  editAnnotationButton: el("editAnnotationButton"),
  annotationEditCard: el("annotationEditCard"),
  annotationTitleInput: el("annotationTitleInput"),
  annotationDetailInput: el("annotationDetailInput"),
  attachmentBlock: el("attachmentBlock"),
  attachImageButton: el("attachImageButton"),
  attachFileButton: el("attachFileButton"),
  attachLinkButton: el("attachLinkButton"),
  attachmentCountBadge: el("attachmentCountBadge"),
  attachmentHelperText: el("attachmentHelperText"),
  annotationAttachmentList: el("annotationAttachmentList"),
  cancelAnnotationEditButton: el("cancelAnnotationEditButton"),
  saveAnnotationButton: el("saveAnnotationButton"),
  resolveQuickButton: el("resolveQuickButton"),
  deleteAnnotationButton: el("deleteAnnotationButton"),
  // replies + remarks
  replyList: el("replyList"),
  replyInput: el("replyInput"),
  replyButton: el("replyButton"),
  replyAttachLinkButton: el("replyAttachLinkButton"),
  replyAttachmentList: el("replyAttachmentList"),
  replyAttachmentCountBadge: el("replyAttachmentCountBadge"),
  remarksInput: el("remarksInput"),
  saveRemarksButton: el("saveRemarksButton"),
  // overlays
  loginCard: el("loginCard"),
  loginButton: el("loginButton"),
  toastRegion: el("toastRegion"),
};

const canvasContext = elements.pdfCanvas.getContext("2d");

function parseSearchHighlight(searchParams) {
  const raw = searchParams.get("ocrMatch");
  const bboxParam = searchParams.get("bbox");
  if (!raw && !bboxParam) {
    return null;
  }
  const bbox = normalizeSearchHighlight(bboxParam);
  if (!bbox) {
    return null;
  }
  return {
    id: searchParams.get("matchId") || "search-highlight",
    page: Number(searchParams.get("page") || 1) || 1,
    text: searchParams.get("matchText") || "",
    bbox,
  };
}

function normalizeSearchHighlight(value) {
  if (!value) {
    return null;
  }
  const parts = String(value).split(",").map((item) => Number(item.trim()));
  if (parts.length !== 4 || parts.some((item) => !Number.isFinite(item))) {
    return null;
  }
  const [x, y, width, height] = parts;
  return {
    x: normalizeRatio(x),
    y: normalizeRatio(y),
    width: Math.max(0.01, normalizeRatio(width)),
    height: Math.max(0.01, normalizeRatio(height)),
  };
}

async function init() {
  bindEvents();
  if (!state.docId) {
    showEmpty("缺少文件参数", "PDF 页面需要通过系统入口打开，当前 URL 中没有文件 ID。");
    return;
  }
  try {
    showProgress("正在加载 PDF", "正在读取当前会话、文件权限和 PDF 版本。", 0.1);
    const session = await fetchJson("/api/session");
    if (!session.authenticated) {
      hideProgress();
      showLogin();
      return;
    }
    state.actor = session.currentUser?.name || "系统";
    showProgress("正在加载 PDF", "正在校验文件权限…", 0.3);
    await loadDocument();
    showProgress("正在加载 PDF", "正在准备文档流…", 0.55);
    await loadPdf();
    renderShell();
    await renderCurrentPage();
    hideProgress();
    revealViewer();
    void loadWorkflowTemplates();
    if (state.selectedAnnotationId) {
      await focusAnnotation(state.selectedAnnotationId, state.page);
    } else if (state.searchHighlight?.page) {
      state.page = state.searchHighlight.page;
      await renderCurrentPage();
      scrollToBox(state.searchHighlight.bbox);
    }
  } catch (error) {
    console.error(error);
    hideProgress();
    showEmpty("PDF 加载失败", error.message || "请刷新页面重试，或回到系统重新打开。");
  }
}

function bindEvents() {
  elements.prevPageButton?.addEventListener("click", () => changePage(-1));
  elements.nextPageButton?.addEventListener("click", () => changePage(1));
  elements.pageInput?.addEventListener("change", () => commitPageInput(elements.pageInput.value));
  elements.zoomOutButton?.addEventListener("click", () => adjustZoom(-0.15));
  elements.zoomInButton?.addEventListener("click", () => adjustZoom(0.15));
  elements.zoomIndicator?.addEventListener("change", () => commitZoomInput(elements.zoomIndicator.value));
  elements.fitViewButton?.addEventListener("click", () => {
    state.fitWidth = true;
    state.zoom = 1;
    void renderCurrentPage();
  });
  elements.fullscreenButton?.addEventListener("click", () => toggleFullscreen());
  elements.annotationModeButton?.addEventListener("click", () => setTool("select"));
  elements.fauxToolButtons.forEach((button) => {
    button.addEventListener("click", () => setTool("pan"));
  });
  elements.toolButtons.forEach((button) => {
    button.addEventListener("click", () => setTool(button.dataset.tool || "circle"));
  });
  elements.toolbarColorButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveColor(button.dataset.toolbarColor || "red"));
  });
  elements.cancelDraftButton?.addEventListener("click", () => {
    state.draft = null;
    renderAnnotationLayer();
  });
  elements.exportButton?.addEventListener("click", () => exportReviewedPdf());
  elements.commentReportButton?.addEventListener("click", () => exportCommentReport());
  elements.printButton?.addEventListener("click", () => window.print());
  elements.shareButton?.addEventListener("click", () => shareLink());
  elements.loginButton?.addEventListener("click", () => {
    window.location.href = "/";
  });
  elements.annotationFilter?.addEventListener("change", () => {
    state.filter = elements.annotationFilter.value || "all";
    renderAnnotations();
  });
  elements.reviewSideTabs.forEach((button) => {
    button.addEventListener("click", () => switchSideTab(button.dataset.reviewTab || "annotations"));
  });
  // right-panel annotation detail
  elements.editAnnotationButton?.addEventListener("click", () => {
    elements.annotationEditCard?.classList.remove("hidden");
    elements.annotationViewActions?.classList.add("hidden");
  });
  elements.cancelAnnotationEditButton?.addEventListener("click", () => renderDetail());
  elements.saveAnnotationButton?.addEventListener("click", () => void saveSelectedAnnotation());
  elements.deleteAnnotationButton?.addEventListener("click", () => void deleteSelectedAnnotation());
  elements.replyButton?.addEventListener("click", () => void replyToSelectedAnnotation());
  elements.attachLinkButton?.addEventListener("click", () => void addAnnotationLink());
  elements.attachImageButton?.addEventListener("click", () => notify("请在系统内的审阅工作台上传图片附件。", "info"));
  elements.attachFileButton?.addEventListener("click", () => notify("请在系统内的审阅工作台上传文件附件。", "info"));
  elements.resolveQuickButton?.addEventListener("click", () => void updateAnnotationStatus("resolved"));
  el("replyAttachLinkButton")?.addEventListener("click", () => notify("请在回复正文中粘贴链接，或在系统审阅工作台添加回复附件。", "info"));
  el("replyAttachImageButton")?.addEventListener("click", () => notify("请在系统内的审阅工作台为回复添加图片附件。", "info"));
  el("replyAttachFileButton")?.addEventListener("click", () => notify("请在系统内的审阅工作台为回复添加文件附件。", "info"));
  elements.saveRemarksButton?.addEventListener("click", () => void saveRemarks());
  elements.startFlowButton?.addEventListener("click", () => void launchWorkflow());
  // canvas interactions
  elements.annotationLayer?.addEventListener("pointerdown", handleLayerPointerDown);
  window.addEventListener("pointermove", handleWindowPointerMove);
  window.addEventListener("pointerup", handleWindowPointerUp);
  window.addEventListener("resize", debounce(() => {
    if (state.pdfDoc) {
      void renderCurrentPage();
    }
  }, 120));
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
}

async function loadPdf() {
  const source = currentPdfSource();
  if (!source?.url) {
    throw new Error("没有找到可加载的 PDF 文件地址。");
  }
  const url = appendCacheParam(source.url, source.updatedAt || state.document.updatedAt || "");
  const task = getDocument({ url, withCredentials: true });
  task.onProgress = (progress) => {
    if (progress?.total) {
      showProgress("正在加载 PDF", "正在下载文档流…", 0.55 + 0.4 * (progress.loaded / progress.total));
    }
  };
  state.pdfDoc = await task.promise;
  state.page = clampPage(state.page);
  state.thumbnailsBuilt = false;
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

function renderShell() {
  const doc = state.document;
  const source = currentPdfSource();
  document.title = `${doc.name} - PDF`;
  setText(elements.documentTitle, doc.name || "PDF");
  setText(elements.documentTitleMirror, doc.name || "PDF");
  setText(elements.documentVersion, source.version);
  setText(elements.documentVersionMirror, source.version);
  const statusText = doc.statusLabel || statusBadge(doc.status);
  setText(elements.documentStatus, statusText);
  setText(elements.documentStatusMirror, statusText);
  setText(elements.documentMeta, [
    source.isCurrent ? "当前版本" : "历史版本",
    doc.workflowName || "",
    formatDateTime(doc.updatedAt),
  ].filter(Boolean).join(" · "));
  setText(elements.reviewProjectLine, `${doc.projectName || "CDE 文件管理系统"} / PDF 审阅工作台`);
  const permissions = annotationPermissions();
  setText(elements.reviewPermissionHint, state.mode === "view"
    ? "浏览模式：可查看批注、附件和回复。"
    : permissions.create
      ? "审阅模式：可新增批注，并按权限编辑自己的批注或更新状态。"
      : "当前节点只允许查看或处理已有批注。");
  if (elements.exportButton) elements.exportButton.disabled = !permissions.export;
  if (elements.commentReportButton) elements.commentReportButton.disabled = !permissions.export;
  if (elements.remarksInput) elements.remarksInput.value = doc.remarks || "";
  renderDocSummary();
  renderToolButtons();
  renderColorButtons();
  renderAnnotations();
  renderDetail();
}

function renderDocSummary() {
  if (!elements.reviewDocSummary) return;
  const doc = state.document;
  const total = Array.isArray(doc.annotations) ? doc.annotations.length : 0;
  const open = (doc.annotations || []).filter((a) => a.status !== "resolved").length;
  elements.reviewDocSummary.innerHTML = `
    <strong>${escapeHtml(doc.name || "PDF")}</strong>
    <span>${escapeHtml(doc.workflowName || "未关联流程")}</span>
    <div class="pill-row">
      <span class="mini-pill">批注 ${total}</span>
      <span class="mini-pill">未解决 ${open}</span>
    </div>`;
}

async function renderCurrentPage() {
  if (!state.pdfDoc) {
    return;
  }
  state.page = clampPage(state.page);
  const token = ++state.renderToken;
  const page = await state.pdfDoc.getPage(state.page);
  if (token !== state.renderToken) {
    return;
  }
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(320, (elements.viewerFrame?.clientWidth || 800) - 96);
  const fitScale = availableWidth / baseViewport.width;
  const scale = Math.max(0.25, Math.min(5, (state.fitWidth ? fitScale : 1) * state.zoom));
  if (state.fitWidth) {
    state.zoom = scale / fitScale;
  }
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  elements.pdfCanvas.width = Math.floor(viewport.width * outputScale);
  elements.pdfCanvas.height = Math.floor(viewport.height * outputScale);
  elements.pdfCanvas.style.width = `${viewport.width}px`;
  elements.pdfCanvas.style.height = `${viewport.height}px`;
  if (elements.pageStage) {
    elements.pageStage.style.width = `${viewport.width}px`;
    elements.pageStage.style.height = `${viewport.height}px`;
  }
  canvasContext.setTransform(outputScale, 0, 0, outputScale, 0, 0);
  await page.render({ canvasContext, viewport }).promise;
  if (token !== state.renderToken) {
    return;
  }
  renderPageControls();
  renderAnnotations();
}

function renderPageControls() {
  const total = state.pdfDoc?.numPages || 0;
  if (elements.pageInput) elements.pageInput.value = String(state.page);
  setText(elements.pageIndicator, `/ ${total}`);
  setText(elements.documentPageSummary, `${state.page} / ${total}`);
  setText(elements.documentPageSummaryMirror, `${state.page} / ${total}`);
  if (elements.zoomIndicator) elements.zoomIndicator.value = `${Math.round(state.zoom * 100)}%`;
  if (elements.prevPageButton) elements.prevPageButton.disabled = state.page <= 1;
  if (elements.nextPageButton) elements.nextPageButton.disabled = state.page >= total;
}

function renderToolButtons() {
  elements.toolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === state.activeTool);
  });
  const isSelect = state.activeTool === "select";
  const isPan = state.activeTool === "pan";
  elements.annotationModeButton?.classList.toggle("active", isSelect);
  elements.fauxToolButtons.forEach((button) => button.classList.toggle("active", isPan));
  const canCreate = canCreateAnnotation();
  elements.toolButtons.forEach((button) => { button.disabled = !canCreate; });
  setText(elements.pageAnnotationSummary, `本页 ${currentPageAnnotations().length} 条`);
}

function renderColorButtons() {
  elements.toolbarColorButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.toolbarColor === state.activeColor);
  });
}

function renderAnnotations() {
  renderPageControls();
  renderToolButtons();
  renderAnnotationLayer();
  renderAnnotationList();
  syncThumbnails();
  if (elements.annotationTabBadge) {
    elements.annotationTabBadge.textContent = String((state.document?.annotations || []).length);
  }
}

/* ----------------------------- left navigator ---------------------------- */

function switchSideTab(tab) {
  const target = tab === "thumbnails" ? "thumbnails" : "annotations";
  elements.reviewSideTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.reviewTab === target);
  });
  elements.reviewAnnotationSidebar?.classList.toggle("hidden", target !== "annotations");
  elements.reviewThumbList?.classList.toggle("hidden", target !== "thumbnails");
  if (target === "thumbnails") {
    void renderThumbnails();
  }
}

async function renderThumbnails() {
  if (!elements.reviewThumbList || !state.pdfDoc) {
    return;
  }
  const total = state.pdfDoc.numPages || 0;
  const existing = elements.reviewThumbList.querySelectorAll("[data-thumb-page]").length;
  if (!state.thumbnailsBuilt || existing !== total) {
    elements.reviewThumbList.innerHTML = Array.from({ length: total }, (_, index) => {
      const page = index + 1;
      return `
        <button class="pdf-thumb" data-thumb-page="${page}" type="button">
          <div class="pdf-thumb-preview" data-thumb-preview="${page}"><span>${page}</span></div>
          <div><strong>第 ${page} 页</strong><span data-thumb-count="${page}"></span></div>
        </button>`;
    }).join("");
    Array.from(elements.reviewThumbList.querySelectorAll("[data-thumb-page]")).forEach((button) => {
      button.addEventListener("click", () => goToThumbPage(Number(button.dataset.thumbPage)));
    });
    state.thumbnailsBuilt = true;
    syncThumbnails();
    for (let page = 1; page <= total; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      await renderThumbPreview(page);
    }
  }
  syncThumbnails();
}

async function renderThumbPreview(pageNumber) {
  const box = elements.reviewThumbList.querySelector(`[data-thumb-preview="${pageNumber}"]`);
  if (!box || box.dataset.rendered === "1" || !state.pdfDoc) {
    return;
  }
  try {
    const page = await state.pdfDoc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = 132 / base.width; // ~58px box at 2x for sharpness
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const img = document.createElement("img");
    img.alt = `第 ${pageNumber} 页`;
    img.src = canvas.toDataURL("image/png");
    box.innerHTML = "";
    box.append(img);
    box.classList.add("ready");
    box.dataset.rendered = "1";
  } catch (error) {
    console.error("缩略图渲染失败", pageNumber, error);
  }
}

async function goToThumbPage(pageNumber) {
  const next = clampPage(pageNumber);
  if (next === state.page) {
    return;
  }
  state.page = next;
  await renderCurrentPage();
}

function syncThumbnails() {
  if (!state.thumbnailsBuilt || !elements.reviewThumbList) {
    return;
  }
  const annotations = Array.isArray(state.document?.annotations) ? state.document.annotations : [];
  Array.from(elements.reviewThumbList.querySelectorAll("[data-thumb-page]")).forEach((button) => {
    const page = Number(button.dataset.thumbPage);
    button.classList.toggle("active", page === state.page);
    const countEl = button.querySelector(`[data-thumb-count="${page}"]`);
    if (countEl) {
      const count = annotations.filter((annotation) => Number(annotation.page || 1) === page).length;
      countEl.textContent = count ? `${count} 条批注` : "";
    }
  });
}

/* ----------------------------- annotation layer + list ------------------- */

function renderAnnotationLayer() {
  if (!elements.annotationLayer) return;
  const annotations = currentPageAnnotations();
  const highlight = state.searchHighlight?.page === state.page ? state.searchHighlight : null;
  elements.annotationLayer.innerHTML = [
    highlight ? renderHighlight(highlight) : "",
    ...annotations.map(renderAnnotationBox),
    state.draft ? renderDraftBox(state.draft) : "",
  ].join("");
  Array.from(elements.annotationLayer.querySelectorAll("[data-annotation-id]")).forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      selectAnnotation(node.dataset.annotationId || "");
    });
  });
}

function renderHighlight(highlight) {
  return `<div class="search-highlight" style="${boxStyle(highlight.bbox)}" title="${escapeHtml(highlight.text || "搜索命中")}"></div>`;
}

function renderAnnotationBox(annotation) {
  const classNames = [
    "annotation-box",
    annotation.color || "red",
    annotation.type || "mark",
    annotation.id === state.selectedAnnotationId ? "selected" : "",
  ].filter(Boolean).join(" ");
  return `<button class="${classNames}" data-annotation-id="${escapeHtml(annotation.id)}" style="${boxStyle(annotation)}" title="${escapeHtml(annotationTitle(annotation))}" type="button"></button>`;
}

function renderDraftBox(draft) {
  return `<div class="draft-box ${state.activeColor}" style="${boxStyle(draft)}"></div>`;
}

function renderAnnotationList() {
  if (!elements.reviewAnnotationSidebarList) return;
  if (elements.annotationFilter && elements.annotationFilter.value !== state.filter) {
    elements.annotationFilter.value = state.filter;
  }
  const annotations = filteredAnnotations();
  if (!annotations.length) {
    elements.reviewAnnotationSidebarList.innerHTML = `<div class="pdf-annotation-item"><strong>暂无批注</strong><span>${canCreateAnnotation() ? "选择工具后在图纸上落点或框选创建。" : "当前没有符合筛选条件的批注。"}</span></div>`;
    return;
  }
  elements.reviewAnnotationSidebarList.innerHTML = annotations.map((annotation, index) => `
    <button class="pdf-annotation-item ${annotation.id === state.selectedAnnotationId ? "active" : ""}" data-list-annotation="${escapeHtml(annotation.id)}" type="button">
      <strong><span class="color-dot ${escapeHtml(annotation.color || "red")}" aria-hidden="true"></span> #${index + 1} ${escapeHtml(annotationTitle(annotation))}</strong>
      <span>P.${Number(annotation.page || 1)} · ${escapeHtml(statusLabel(annotation.status))} · ${escapeHtml(annotation.note || "未填写说明")}</span>
    </button>
  `).join("");
  Array.from(elements.reviewAnnotationSidebarList.querySelectorAll("[data-list-annotation]")).forEach((button) => {
    button.addEventListener("click", () => selectAnnotation(button.dataset.listAnnotation || ""));
  });
}

/* ----------------------------- right panel: detail ----------------------- */

function renderDetail() {
  const annotation = selectedAnnotation();
  const archived = readOnlyMode();
  elements.annotationReadonlyNote?.classList.toggle("hidden", !archived);
  if (!annotation) {
    elements.annotationEmptyCard?.classList.remove("hidden");
    elements.annotationDetailBody?.classList.add("hidden");
    setText(elements.annotationDetailHeading, "未选中批注");
    setText(elements.annotationMetaLine, "选择图面批注后查看说明、证据和处理记录。");
    setText(elements.annotationDetailBadge, "--");
    renderReplies(null);
    return;
  }
  elements.annotationEmptyCard?.classList.add("hidden");
  elements.annotationDetailBody?.classList.remove("hidden");
  const editable = canEditAnnotation(annotation);
  const canStatus = canChangeAnnotationStatus(annotation);
  const canDelete = canDeleteAnnotation(annotation);
  const index = (state.document?.annotations || []).findIndex((item) => item.id === annotation.id);
  setText(elements.annotationDetailHeading, annotationTitle(annotation));
  setText(elements.annotationMetaLine, annotation.note || "未填写说明");
  setText(elements.annotationDetailBadge, index >= 0 ? `#${index + 1}` : "--");
  renderStatusGroup(annotation, canStatus);
  renderColorReadout(annotation, editable);
  setText(elements.annotationActorInput, annotation.actor || "系统");
  setText(elements.annotationCreatedInput, formatDateTime(annotation.createdAt) || "--");
  setText(elements.annotationPageInput, `第 ${Number(annotation.page || 1)} 页`);
  setText(elements.annotationTypeInput, typeLabel(annotation.type));
  setText(elements.annotationSummaryNote, annotation.note || "未填写说明");
  if (elements.annotationTitleInput) {
    elements.annotationTitleInput.value = annotation.title || "";
    elements.annotationTitleInput.disabled = !editable;
  }
  if (elements.annotationDetailInput) {
    elements.annotationDetailInput.value = annotation.note || "";
    elements.annotationDetailInput.disabled = !editable;
  }
  // view vs edit: show edit card when editable, else show view actions only
  elements.annotationEditCard?.classList.toggle("hidden", !editable);
  elements.annotationViewActions?.classList.add("hidden");
  if (elements.saveAnnotationButton) elements.saveAnnotationButton.disabled = !(editable || canStatus);
  if (elements.deleteAnnotationButton) elements.deleteAnnotationButton.disabled = !canDelete;
  elements.resolveQuickButton?.classList.add("hidden");
  renderAttachments(annotation);
  renderReplies(annotation);
}

function renderStatusGroup(annotation, canStatus) {
  if (!elements.annotationStatusGroup) return;
  const current = annotation.status || "open";
  if (!canStatus) {
    elements.annotationStatusGroup.innerHTML = `<span class="mini-pill signal-pill ${current}">${escapeHtml(statusLabel(current))}</span>`;
    return;
  }
  elements.annotationStatusGroup.innerHTML = ["open", "in_progress", "resolved"].map((status) => `
    <button class="mini-pill signal-pill ${status} ${status === current ? "active" : ""}" data-status-option="${status}" type="button">${escapeHtml(statusLabel(status))}</button>
  `).join("");
  Array.from(elements.annotationStatusGroup.querySelectorAll("[data-status-option]")).forEach((button) => {
    button.addEventListener("click", () => void updateAnnotationStatus(button.dataset.statusOption || "open"));
  });
}

function renderColorReadout(annotation, editable) {
  const color = annotation.color || "red";
  if (elements.annotationColorReadout) {
    elements.annotationColorReadout.innerHTML = `<span class="color-dot ${color}" aria-hidden="true"></span><span>${COLOR_LABELS[color] || color}</span>`;
  }
  if (!elements.annotationColorGroup) return;
  // append clickable swatches (keep the readout label as first child)
  const existing = elements.annotationColorGroup.querySelectorAll("[data-detail-color]");
  existing.forEach((node) => node.remove());
  if (!editable) return;
  ["red", "amber", "blue"].forEach((c) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `color-swatch-button ${c === color ? "active" : ""}`;
    button.dataset.detailColor = c;
    button.setAttribute("aria-label", COLOR_LABELS[c] || c);
    button.innerHTML = `<span class="color-dot ${c}" aria-hidden="true"></span>`;
    button.addEventListener("click", () => void updateAnnotationColor(c));
    elements.annotationColorGroup.append(button);
  });
}

function renderAttachments(annotation) {
  const attachments = Array.isArray(annotation.attachments) ? annotation.attachments : [];
  if (elements.attachmentCountBadge) elements.attachmentCountBadge.textContent = `${attachments.length} 项`;
  if (elements.annotationAttachmentList) {
    elements.annotationAttachmentList.innerHTML = attachments.length
      ? attachments.map(renderAttachment).join("")
      : `<p class="section-text">暂无附件。</p>`;
  }
}

function renderAttachment(attachment) {
  const href = attachment.url || attachment.previewUrl || "#";
  const label = attachment.name || attachment.linkUrl || "附件";
  return `<a class="link-chip" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function renderReplies(annotation) {
  if (elements.replyInput) {
    elements.replyInput.disabled = !annotation || !canReplyAnnotation();
  }
  if (elements.replyButton) {
    elements.replyButton.disabled = !annotation || !canReplyAnnotation();
  }
  if (!elements.replyList) return;
  const replies = annotation && Array.isArray(annotation.replies) ? annotation.replies : [];
  if (!annotation) {
    elements.replyList.innerHTML = `<p class="section-text">选择批注后查看处理讨论。</p>`;
    return;
  }
  elements.replyList.innerHTML = replies.length
    ? replies.map((reply) => `
        <article class="reply-card">
          <strong>${escapeHtml(reply.actor || "系统")}</strong>
          <span>${escapeHtml(reply.content || "补充了附件")}</span>
          <small>${escapeHtml(formatDateTime(reply.createdAt))}</small>
          ${(reply.attachments || []).map(renderAttachment).join("")}
        </article>`).join("")
    : `<p class="section-text">暂无回复。</p>`;
}

/* ----------------------------- annotation CRUD --------------------------- */

function boxStyle(box) {
  const x = normalizeRatio(box.x);
  const y = normalizeRatio(box.y);
  const width = Math.max(0.01, normalizeRatio(box.width));
  const height = Math.max(0.01, normalizeRatio(box.height));
  return `left:${x * 100}%;top:${y * 100}%;width:${width * 100}%;height:${height * 100}%;`;
}

function handleLayerPointerDown(event) {
  if (!state.pdfDoc) {
    return;
  }
  if (state.activeTool === "pan" || state.activeTool === "select") {
    if (state.activeTool === "pan") {
      state.pan = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: elements.viewerFrame?.scrollLeft || 0,
        top: elements.viewerFrame?.scrollTop || 0,
      };
      elements.annotationLayer.setPointerCapture?.(event.pointerId);
    }
    return;
  }
  if (!canCreateAnnotation()) {
    return;
  }
  const point = eventPointToPageRatio(event);
  state.drag = { pointerId: event.pointerId, type: state.activeTool, start: point, current: point };
  state.draft = draftFromDrag(state.drag);
  elements.annotationLayer.setPointerCapture?.(event.pointerId);
  renderAnnotationLayer();
}

function handleWindowPointerMove(event) {
  if (state.pan && state.pan.pointerId === event.pointerId && elements.viewerFrame) {
    elements.viewerFrame.scrollLeft = state.pan.left - (event.clientX - state.pan.x);
    elements.viewerFrame.scrollTop = state.pan.top - (event.clientY - state.pan.y);
    return;
  }
  if (!state.drag || state.drag.pointerId !== event.pointerId) {
    return;
  }
  state.drag.current = eventPointToPageRatio(event);
  state.draft = draftFromDrag(state.drag);
  renderAnnotationLayer();
}

function handleWindowPointerUp(event) {
  if (state.pan && state.pan.pointerId === event.pointerId) {
    state.pan = null;
    return;
  }
  if (!state.drag || state.drag.pointerId !== event.pointerId) {
    return;
  }
  const draft = draftFromDrag(state.drag);
  state.drag = null;
  state.draft = null;
  const isPoint = draft.type === "circle";
  if (!isPoint && (draft.width < 0.006 || draft.height < 0.006)) {
    renderAnnotationLayer();
    return;
  }
  void createAnnotationFromDraft(draft);
}

function eventPointToPageRatio(event) {
  const rect = elements.pageStage.getBoundingClientRect();
  return {
    x: normalizeRatio((event.clientX - rect.left) / rect.width),
    y: normalizeRatio((event.clientY - rect.top) / rect.height),
  };
}

function draftFromDrag(drag) {
  const left = Math.min(drag.start.x, drag.current.x);
  const top = Math.min(drag.start.y, drag.current.y);
  const right = Math.max(drag.start.x, drag.current.x);
  const bottom = Math.max(drag.start.y, drag.current.y);
  if (drag.type === "circle" || drag.type === "note") {
    const size = drag.type === "circle" ? 0.03 : 0.16;
    return {
      type: drag.type,
      page: state.page,
      x: Math.max(0, drag.current.x - size / 2),
      y: Math.max(0, drag.current.y - size / 2),
      width: size,
      height: drag.type === "circle" ? size : 0.06,
    };
  }
  return { type: drag.type, page: state.page, x: left, y: top, width: right - left, height: bottom - top };
}

async function createAnnotationFromDraft(draft) {
  try {
    const title = `${typeLabel(draft.type)} · 第 ${draft.page} 页`;
    const payload = {
      ...draft,
      title,
      note: "",
      actor: state.actor,
      color: state.activeColor,
      status: "open",
      attachments: [],
      source: "pdf_standalone",
    };
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations`, payload);
    syncDocument(response.document);
    state.selectedAnnotationId = response.annotation?.id || "";
    notify("批注已创建。", "success");
    renderShell();
    await renderCurrentPage();
  } catch (error) {
    notify(error.message || "创建批注失败。", "alert");
    renderAnnotations();
  }
}

async function saveSelectedAnnotation() {
  const annotation = selectedAnnotation();
  if (!annotation) {
    return;
  }
  const payload = { actor: state.actor };
  if (canEditAnnotation(annotation)) {
    payload.title = elements.annotationTitleInput?.value || annotation.title || "";
    payload.note = elements.annotationDetailInput?.value ?? annotation.note ?? "";
  }
  try {
    const response = await patchJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}`, payload);
    syncDocument(response.document);
    state.selectedAnnotationId = response.annotation?.id || annotation.id;
    notify("批注已保存。", "success");
    renderShell();
    await renderCurrentPage();
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
    const response = await patchJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}`, { actor: state.actor, status });
    syncDocument(response.document);
    renderShell();
    await renderCurrentPage();
  } catch (error) {
    notify(error.message || "更新状态失败。", "alert");
  }
}

async function updateAnnotationColor(color) {
  const annotation = selectedAnnotation();
  if (!annotation || !canEditAnnotation(annotation)) {
    return;
  }
  try {
    const response = await patchJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}`, { actor: state.actor, color });
    syncDocument(response.document);
    renderShell();
    await renderCurrentPage();
  } catch (error) {
    notify(error.message || "更新颜色失败。", "alert");
  }
}

async function deleteSelectedAnnotation() {
  const annotation = selectedAnnotation();
  if (!annotation || !canDeleteAnnotation(annotation)) {
    return;
  }
  if (!window.confirm("确认删除这条批注吗？")) {
    return;
  }
  try {
    const response = await deleteJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}`, { actor: state.actor });
    syncDocument(response.document);
    state.selectedAnnotationId = "";
    notify("批注已删除。", "success");
    renderShell();
    await renderCurrentPage();
  } catch (error) {
    notify(error.message || "删除批注失败。", "alert");
  }
}

async function replyToSelectedAnnotation() {
  const annotation = selectedAnnotation();
  const content = elements.replyInput?.value?.trim() || "";
  if (!annotation || !content) {
    notify("请先选中批注并输入回复内容。", "alert");
    return;
  }
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}/replies`, { actor: state.actor, content });
    syncDocument(response.document);
    if (elements.replyInput) elements.replyInput.value = "";
    notify("回复已发布。", "success");
    renderShell();
    await renderCurrentPage();
  } catch (error) {
    notify(error.message || "发布回复失败。", "alert");
  }
}

async function addAnnotationLink() {
  const annotation = selectedAnnotation();
  if (!annotation || !canEditAnnotation(annotation)) {
    notify("请先选中可编辑的批注。", "alert");
    return;
  }
  const url = window.prompt("请输入链接地址（http/https）：");
  if (!url) {
    return;
  }
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}/attachments`, {
      actor: state.actor,
      type: "link",
      linkUrl: url,
      name: url,
    });
    syncDocument(response.document);
    notify("链接附件已添加。", "success");
    renderDetail();
  } catch (error) {
    notify(error.message || "添加链接失败。", "alert");
  }
}

async function saveRemarks() {
  try {
    const response = await fetchJson(`/api/documents/${encodeURIComponent(state.document.id)}/remarks`, {
      method: "PUT",
      body: JSON.stringify({ actor: state.actor, remarks: elements.remarksInput?.value || "" }),
    });
    syncDocument(response.document);
    notify("备注已保存。", "success");
  } catch (error) {
    notify(error.message || "保存备注失败。", "alert");
  }
}

/* ----------------------------- export / share ---------------------------- */

async function exportReviewedPdf() {
  if (!annotationPermissions().export) {
    return;
  }
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/export`, { actor: state.actor });
    if (response.downloadUrl) {
      window.open(response.downloadUrl, "_blank", "noopener");
    }
  } catch (error) {
    notify(error.message || "导出批注版失败。", "alert");
  }
}

async function exportCommentReport() {
  if (!annotationPermissions().export) {
    return;
  }
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/comment-report`, { actor: state.actor });
    if (response.downloadUrl) {
      window.open(response.downloadUrl, "_blank", "noopener");
    }
  } catch (error) {
    notify(error.message || "导出评论清单失败。", "alert");
  }
}

async function shareLink() {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: state.document?.name || "PDF", url });
      return;
    }
    await navigator.clipboard.writeText(url);
    notify("链接已复制到剪贴板。", "success");
  } catch {
    notify("无法分享，请手动复制地址栏链接。", "info");
  }
}

/* ----------------------------- workflow center ---------------------------- */

async function loadWorkflowTemplates() {
  if (!elements.workflowTemplateSelect) {
    return;
  }
  try {
    const payload = await fetchJson("/api/workflow-templates");
    state.templates = Array.isArray(payload.templates) ? payload.templates : (Array.isArray(payload) ? payload : []);
  } catch {
    state.templates = [];
  }
  renderWorkflowPanel();
}

function renderWorkflowPanel() {
  const doc = state.document || {};
  const hasWorkflow = Boolean(doc.workflowName || doc.workflowId);
  setText(elements.workflowHealthBadge, hasWorkflow ? (doc.statusLabel || statusBadge(doc.status)) : "待发起");
  if (elements.workflowSummaryGrid) {
    const total = (doc.annotations || []).length;
    const open = (doc.annotations || []).filter((a) => a.status !== "resolved").length;
    elements.workflowSummaryGrid.innerHTML = `
      <div class="module-stat"><span>当前流程</span><strong>${escapeHtml(doc.workflowName || "未发起")}</strong></div>
      <div class="module-stat"><span>文档状态</span><strong>${escapeHtml(doc.statusLabel || statusBadge(doc.status))}</strong></div>
      <div class="module-stat"><span>批注总数</span><strong>${total}</strong></div>
      <div class="module-stat"><span>未解决</span><strong>${open}</strong></div>`;
  }
  if (elements.workflowTemplateSelect) {
    elements.workflowTemplateSelect.innerHTML = state.templates.length
      ? state.templates.map((tpl) => `<option value="${escapeHtml(tpl.id)}">${escapeHtml(tpl.name || tpl.id)}</option>`).join("")
      : `<option value="">暂无可用流程模板</option>`;
  }
  if (elements.workflowNameInput && !elements.workflowNameInput.value) {
    elements.workflowNameInput.value = doc.name ? `${doc.name} 审阅` : "";
  }
  const canLaunch = state.templates.length > 0 && !hasWorkflow && !readOnlyMode();
  if (elements.startFlowButton) {
    elements.startFlowButton.disabled = !canLaunch;
  }
  setText(elements.workflowLaunchHint, hasWorkflow
    ? "该文件已有关联流程，如需管理请回到系统流程中心。"
    : state.templates.length
      ? "选择模板并填写名称后发起审批流程。"
      : "当前没有可用流程模板，请先在系统中配置。");
}

async function launchWorkflow() {
  if (!state.templates.length) {
    return;
  }
  const templateId = elements.workflowTemplateSelect?.value || "";
  const name = elements.workflowNameInput?.value?.trim() || "";
  if (!templateId || !name) {
    notify("请填写流程名称并选择模板。", "alert");
    return;
  }
  try {
    if (elements.startFlowButton) elements.startFlowButton.disabled = true;
    const response = await postJson("/api/workflows", {
      templateId,
      name,
      documentIds: [state.document.id],
      actor: state.actor,
    });
    if (response.document) {
      syncDocument(response.document);
    } else {
      await loadDocument();
    }
    notify("流程已发起。", "success");
    renderShell();
    renderWorkflowPanel();
  } catch (error) {
    notify(error.message || "发起流程失败。", "alert");
    renderWorkflowPanel();
  }
}

/* ----------------------------- navigation / tools ------------------------- */

function syncDocument(doc) {
  if (doc) {
    state.document = doc;
  }
}

function selectAnnotation(annotationId) {
  state.selectedAnnotationId = annotationId;
  const annotation = selectedAnnotation();
  if (annotation && annotation.page !== state.page) {
    state.page = annotation.page;
    void renderCurrentPage().then(() => {
      scrollToBox(annotation);
      renderDetail();
    });
    return;
  }
  if (annotation) {
    scrollToBox(annotation);
  }
  renderAnnotations();
  renderDetail();
}

async function focusAnnotation(annotationId, page = null) {
  const annotation = (state.document?.annotations || []).find((item) => item.id === annotationId);
  if (!annotation) {
    return;
  }
  state.selectedAnnotationId = annotation.id;
  state.page = clampPage(Number(page || annotation.page || 1) || 1);
  await renderCurrentPage();
  scrollToBox(annotation);
  renderDetail();
}

function scrollToBox(box) {
  if (!elements.pageStage || !elements.viewerFrame || !box) {
    return;
  }
  const width = elements.pageStage.clientWidth;
  const height = elements.pageStage.clientHeight;
  elements.viewerFrame.scrollTo({
    left: Math.max(0, normalizeRatio(box.x) * width - elements.viewerFrame.clientWidth / 2),
    top: Math.max(0, normalizeRatio(box.y) * height - elements.viewerFrame.clientHeight / 2),
    behavior: "smooth",
  });
}

async function changePage(delta) {
  if (!state.pdfDoc) {
    return;
  }
  const nextPage = clampPage(state.page + delta);
  if (nextPage === state.page) {
    return;
  }
  state.page = nextPage;
  await renderCurrentPage();
}

async function commitPageInput(value) {
  const nextPage = clampPage(Number.parseInt(String(value || ""), 10) || state.page);
  if (nextPage === state.page) {
    renderPageControls();
    return;
  }
  state.page = nextPage;
  await renderCurrentPage();
}

async function adjustZoom(delta) {
  state.fitWidth = false;
  state.zoom = Math.max(0.35, Math.min(5, state.zoom + delta));
  await renderCurrentPage();
}

async function commitZoomInput(value) {
  const percent = Number.parseFloat(String(value || "").replace("%", ""));
  if (!Number.isFinite(percent)) {
    renderPageControls();
    return;
  }
  state.fitWidth = false;
  state.zoom = Math.max(0.35, Math.min(5, percent / 100));
  await renderCurrentPage();
}

function setTool(tool) {
  if (tool !== "pan" && tool !== "select" && !canCreateAnnotation()) {
    notify("当前权限不允许新增批注。", "alert");
    return;
  }
  state.activeTool = tool;
  state.draft = null;
  renderToolButtons();
  renderAnnotationLayer();
}

function setActiveColor(color) {
  state.activeColor = color;
  renderColorButtons();
}

function toggleFullscreen() {
  const target = document.getElementById("pdfStandaloneApp") || document.documentElement;
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void target.requestFullscreen?.();
  }
}

/* ----------------------------- selectors / perms ------------------------- */

function selectedAnnotation() {
  return (state.document?.annotations || []).find((annotation) => annotation.id === state.selectedAnnotationId) || null;
}

function currentPageAnnotations() {
  return (state.document?.annotations || [])
    .filter((annotation) => Number(annotation.page || 1) === state.page)
    .filter(filterAnnotation)
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
}

function filteredAnnotations() {
  return (state.document?.annotations || [])
    .filter(filterAnnotation)
    .sort((left, right) => {
      const pageDiff = Number(left.page || 1) - Number(right.page || 1);
      return pageDiff || String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
    });
}

function filterAnnotation(annotation) {
  switch (state.filter) {
    case "current_page":
      return Number(annotation.page || 1) === state.page;
    case "open":
      return annotation.status !== "resolved" && annotation.status !== "in_progress";
    case "in_progress":
      return annotation.status === "in_progress";
    case "resolved":
      return annotation.status === "resolved";
    default:
      return true;
  }
}

function isPdfDocument(doc) {
  return String(doc?.mimeType || "").toLowerCase() === "application/pdf" || String(doc?.name || "").toLowerCase().endsWith(".pdf");
}

function canPreviewDocument() {
  return Boolean(state.document?.permissions?.preview);
}

function annotationPermissions() {
  return state.document?.permissions?.annotations || {};
}

function readOnlyMode() {
  return state.mode === "view";
}

function canCreateAnnotation() {
  return Boolean(annotationPermissions().create) && !readOnlyMode();
}

function canReplyAnnotation() {
  return Boolean(annotationPermissions().reply) && !readOnlyMode();
}

function canEditAnnotation(annotation) {
  if (!annotation || readOnlyMode()) {
    return false;
  }
  const permissions = annotationPermissions();
  if (annotation.actor === state.actor) {
    return Boolean(permissions.updateOwn ?? permissions.create);
  }
  return Boolean(permissions.deleteOthers);
}

function canDeleteAnnotation(annotation) {
  if (!annotation || readOnlyMode()) {
    return false;
  }
  const permissions = annotationPermissions();
  if (annotation.actor === state.actor) {
    return Boolean(permissions.deleteOwn ?? permissions.updateOwn ?? permissions.create);
  }
  return Boolean(permissions.deleteOthers);
}

function canChangeAnnotationStatus(annotation) {
  if (!annotation || readOnlyMode()) {
    return false;
  }
  const permissions = annotationPermissions();
  if (!permissions.changeStatus) {
    return false;
  }
  if (permissions.changeStatusAny || permissions.deleteOthers) {
    return true;
  }
  return annotation.actor === state.actor && Boolean(permissions.updateOwn ?? permissions.create);
}

/* ----------------------------- helpers ----------------------------------- */

function clampPage(value) {
  const total = state.pdfDoc?.numPages || 1;
  return Math.max(1, Math.min(total, Number(value) || 1));
}

function normalizeRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}

function annotationTitle(annotation) {
  return annotation.title || `${typeLabel(annotation.type)} · 第 ${Number(annotation.page || 1)} 页`;
}

function typeLabel(type) {
  return {
    circle: "点批注",
    mark: "矩形",
    note: "文本",
    line: "箭头",
    pen: "画笔",
  }[type] || "批注";
}

function statusLabel(status) {
  return {
    open: "未解决",
    in_progress: "处理中",
    resolved: "已解决",
  }[status] || "未解决";
}

function statusBadge(status) {
  return {
    draft: "草稿",
    in_review: "审阅中",
    current: "现行",
    approved: "已批准",
    archived: "已归档",
    superseded: "已替代",
  }[status] || (status || "—");
}

function setText(node, value) {
  if (node) {
    node.textContent = value ?? "";
  }
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ----------------------------- overlays / state -------------------------- */

function showProgress(title, message, ratio = 0) {
  if (!elements.progressOverlay) return;
  elements.progressOverlay.classList.remove("hidden");
  elements.progressOverlay.style.display = "";
  setText(elements.progressTitle, title);
  setText(elements.progressText, message);
  if (elements.progressBar) {
    elements.progressBar.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }
}

function hideProgress() {
  if (!elements.progressOverlay) return;
  elements.progressOverlay.classList.add("hidden");
  elements.progressOverlay.style.display = "none";
}

function showEmpty(title, message) {
  if (!elements.viewerEmpty) return;
  elements.viewerEmpty.classList.remove("hidden");
  elements.viewerEmpty.innerHTML = `<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p><p><a class="text-button" href="/">返回系统</a></p></div>`;
  elements.canvasWrap?.classList.add("hidden");
  elements.canvasPageControls?.classList.add("hidden");
}

function revealViewer() {
  elements.viewerEmpty?.classList.add("hidden");
  elements.canvasWrap?.classList.remove("hidden");
  elements.canvasPageControls?.classList.remove("hidden");
  document.querySelector(".review-footer")?.classList.remove("hidden");
  elements.printButton?.classList.remove("hidden");
  elements.shareButton?.classList.remove("hidden");
  const exportUrl = state.document?.latestExportUrl || state.document?.exportUrl || "";
  if (elements.exportLink && exportUrl) {
    elements.exportLink.href = exportUrl;
    elements.exportLink.classList.remove("hidden");
  }
}

function showLogin() {
  elements.loginCard?.classList.remove("hidden");
  if (elements.loginCard) elements.loginCard.style.display = "";
}

function notify(message, tone = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  elements.toastRegion?.append(toast);
  window.setTimeout(() => toast.remove(), tone === "alert" ? 5200 : 2800);
}

async function fetchJson(url, options = {}) {
  const { headers = {}, ...rest } = options;
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...headers },
    ...rest,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function postJson(url, body) {
  return fetchJson(url, { method: "POST", body: JSON.stringify(body) });
}

function patchJson(url, body) {
  return fetchJson(url, { method: "PATCH", body: JSON.stringify(body) });
}

function deleteJson(url, body) {
  return fetchJson(url, { method: "DELETE", body: JSON.stringify(body || {}) });
}

function debounce(fn, delay) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

void init();
