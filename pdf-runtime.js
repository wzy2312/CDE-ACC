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
  activeTool: "pan",
  draft: null,
  drag: null,
  pan: null,
  searchHighlight: parseSearchHighlight(params),
};

const elements = {
  documentTitle: document.querySelector("#documentTitle"),
  documentMeta: document.querySelector("#documentMeta"),
  permissionHint: document.querySelector("#permissionHint"),
  prevPageButton: document.querySelector("#prevPageButton"),
  nextPageButton: document.querySelector("#nextPageButton"),
  floatingPrevButton: document.querySelector("#floatingPrevButton"),
  floatingNextButton: document.querySelector("#floatingNextButton"),
  pageInput: document.querySelector("#pageInput"),
  floatingPageInput: document.querySelector("#floatingPageInput"),
  pageTotal: document.querySelector("#pageTotal"),
  floatingPageTotal: document.querySelector("#floatingPageTotal"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomLabel: document.querySelector("#zoomLabel"),
  fitButton: document.querySelector("#fitButton"),
  panButton: document.querySelector("#panButton"),
  markButton: document.querySelector("#markButton"),
  noteButton: document.querySelector("#noteButton"),
  addAnnotationButton: document.querySelector("#addAnnotationButton"),
  exportReviewButton: document.querySelector("#exportReviewButton"),
  exportReportButton: document.querySelector("#exportReportButton"),
  viewerScroll: document.querySelector("#viewerScroll"),
  pageWrap: document.querySelector("#pageWrap"),
  pdfCanvas: document.querySelector("#pdfCanvas"),
  annotationLayer: document.querySelector("#annotationLayer"),
  annotationList: document.querySelector("#annotationList"),
  detailCard: document.querySelector("#detailCard"),
  stateWrap: document.querySelector("#stateWrap"),
  stateTitle: document.querySelector("#stateTitle"),
  stateMessage: document.querySelector("#stateMessage"),
  stateActions: document.querySelector("#stateActions"),
  toastRegion: document.querySelector("#toastRegion"),
  filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
};

const canvasContext = elements.pdfCanvas.getContext("2d");

function parseSearchHighlight(searchParams) {
  const raw = searchParams.get("ocrMatch");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return normalizeSearchHighlight(parsed);
    } catch {
      return null;
    }
  }
  const bbox = searchParams.get("bbox");
  if (!bbox) {
    return null;
  }
  const [x, y, width, height] = bbox.split(",").map((item) => Number(item));
  return normalizeSearchHighlight({
    id: searchParams.get("matchId") || "search-highlight",
    page: Number(searchParams.get("page") || 1) || 1,
    text: searchParams.get("matchText") || "",
    bbox: { x, y, width, height },
  });
}

function normalizeSearchHighlight(value) {
  const bbox = value?.bbox || {};
  const x = Number(bbox.x);
  const y = Number(bbox.y);
  const width = Number(bbox.width ?? bbox.w);
  const height = Number(bbox.height ?? bbox.h);
  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }
  return {
    id: String(value.id || "search-highlight"),
    page: Math.max(1, Number(value.page || 1) || 1),
    text: String(value.text || ""),
    bbox: {
      x: normalizeRatio(x),
      y: normalizeRatio(y),
      width: normalizeRatio(width),
      height: normalizeRatio(height),
    },
  };
}

async function init() {
  bindEvents();
  if (!state.docId) {
    showState("缺少文件参数", "PDF 页面需要通过系统入口打开，当前 URL 中没有文件 ID。", true);
    return;
  }
  try {
    showState("正在加载 PDF", "正在读取当前会话、文件权限和 PDF 版本。");
    const session = await fetchJson("/api/session");
    if (!session.authenticated) {
      showState("需要登录", "当前会话已失效，请回到系统登录后重新打开 PDF。", true);
      return;
    }
    state.actor = session.currentUser?.name || "系统";
    await loadDocument();
    await loadPdf();
    renderShell();
    await renderCurrentPage();
    hideState();
    if (state.selectedAnnotationId) {
      await focusAnnotation(state.selectedAnnotationId, state.page);
    } else if (state.searchHighlight?.page) {
      state.page = state.searchHighlight.page;
      await renderCurrentPage();
      scrollToBox(state.searchHighlight.bbox);
    }
  } catch (error) {
    console.error(error);
    showState("PDF 加载失败", error.message || "请刷新页面重试，或回到系统重新打开。", true);
  }
}

function bindEvents() {
  elements.prevPageButton.addEventListener("click", () => changePage(-1));
  elements.nextPageButton.addEventListener("click", () => changePage(1));
  elements.floatingPrevButton.addEventListener("click", () => changePage(-1));
  elements.floatingNextButton.addEventListener("click", () => changePage(1));
  elements.pageInput.addEventListener("change", () => commitPageInput(elements.pageInput.value));
  elements.floatingPageInput.addEventListener("change", () => commitPageInput(elements.floatingPageInput.value));
  elements.zoomOutButton.addEventListener("click", () => adjustZoom(-0.15));
  elements.zoomInButton.addEventListener("click", () => adjustZoom(0.15));
  elements.fitButton.addEventListener("click", () => {
    state.fitWidth = true;
    state.zoom = 1;
    void renderCurrentPage();
  });
  elements.panButton.addEventListener("click", () => setTool("pan"));
  elements.markButton.addEventListener("click", () => setTool("mark"));
  elements.noteButton.addEventListener("click", () => setTool("note"));
  elements.addAnnotationButton.addEventListener("click", () => setTool("mark"));
  elements.exportReviewButton.addEventListener("click", () => exportReviewedPdf());
  elements.exportReportButton.addEventListener("click", () => exportCommentReport());
  elements.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter || "all";
      renderAnnotations();
    });
  });
  elements.annotationLayer.addEventListener("pointerdown", handleLayerPointerDown);
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
  const task = getDocument({
    url,
    withCredentials: true,
  });
  state.pdfDoc = await task.promise;
  state.page = clampPage(state.page);
}

function currentPdfSource() {
  const doc = state.document;
  if (!state.versionId) {
    return {
      url: doc.fileUrl,
      version: doc.version || "V1",
      updatedAt: doc.updatedAt,
      isCurrent: true,
    };
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
  elements.documentTitle.textContent = doc.name || "PDF";
  elements.documentMeta.textContent = [
    source.version,
    source.isCurrent ? "当前版本" : "历史版本",
    doc.workflowName || "",
    formatDateTime(doc.updatedAt),
  ].filter(Boolean).join(" · ");
  const permissions = annotationPermissions();
  elements.permissionHint.textContent = state.mode === "view"
    ? "浏览模式：可查看批注、附件和回复。"
    : permissions.create
      ? "审阅模式：可新增批注，并按权限编辑自己的批注或更新状态。"
      : "当前节点只允许查看或处理已有批注。";
  elements.addAnnotationButton.disabled = !canCreateAnnotation();
  elements.exportReviewButton.disabled = !permissions.export;
  elements.exportReportButton.disabled = !permissions.export;
  renderToolButtons();
  renderAnnotations();
  renderDetail();
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
  const availableWidth = Math.max(320, elements.viewerScroll.clientWidth - 96);
  const fitScale = availableWidth / baseViewport.width;
  const scale = Math.max(0.25, Math.min(5, (state.fitWidth ? fitScale : 1) * state.zoom));
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  elements.pdfCanvas.width = Math.floor(viewport.width * outputScale);
  elements.pdfCanvas.height = Math.floor(viewport.height * outputScale);
  elements.pdfCanvas.style.width = `${viewport.width}px`;
  elements.pdfCanvas.style.height = `${viewport.height}px`;
  elements.pageWrap.style.width = `${viewport.width}px`;
  elements.pageWrap.style.height = `${viewport.height}px`;
  canvasContext.setTransform(outputScale, 0, 0, outputScale, 0, 0);
  await page.render({
    canvasContext,
    viewport,
  }).promise;
  if (token !== state.renderToken) {
    return;
  }
  renderPageControls();
  renderAnnotations();
}

function renderPageControls() {
  const total = state.pdfDoc?.numPages || 0;
  elements.pageInput.value = String(state.page);
  elements.floatingPageInput.value = String(state.page);
  elements.pageTotal.textContent = `/ ${total}`;
  elements.floatingPageTotal.textContent = `/ ${total}`;
  elements.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  const atStart = state.page <= 1;
  const atEnd = state.page >= total;
  elements.prevPageButton.disabled = atStart;
  elements.floatingPrevButton.disabled = atStart;
  elements.nextPageButton.disabled = atEnd;
  elements.floatingNextButton.disabled = atEnd;
}

function renderToolButtons() {
  const toolButtons = {
    pan: elements.panButton,
    mark: elements.markButton,
    note: elements.noteButton,
  };
  Object.entries(toolButtons).forEach(([tool, button]) => {
    button.classList.toggle("active", state.activeTool === tool);
  });
  const canCreate = canCreateAnnotation();
  elements.markButton.disabled = !canCreate;
  elements.noteButton.disabled = !canCreate;
  if (!canCreate && state.activeTool !== "pan") {
    state.activeTool = "pan";
  }
}

function renderAnnotations() {
  renderPageControls();
  renderToolButtons();
  renderAnnotationLayer();
  renderAnnotationList();
}

function renderAnnotationLayer() {
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
    annotation.color || "blue",
    annotation.type || "mark",
    annotation.id === state.selectedAnnotationId ? "selected" : "",
  ].filter(Boolean).join(" ");
  return `
    <button class="${classNames}" data-annotation-id="${escapeHtml(annotation.id)}" style="${boxStyle(annotation)}" title="${escapeHtml(annotationTitle(annotation))}" type="button"></button>
  `;
}

function renderDraftBox(draft) {
  return `<div class="draft-box" style="${boxStyle(draft)}"></div>`;
}

function renderAnnotationList() {
  elements.filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
  const annotations = filteredAnnotations();
  if (!annotations.length) {
    elements.annotationList.innerHTML = `<article class="annotation-card"><strong>暂无批注</strong><span>${canCreateAnnotation() ? "点击“新增批注”后在图纸上拖拽创建。" : "当前没有符合筛选条件的批注。"}</span></article>`;
    return;
  }
  elements.annotationList.innerHTML = annotations.map((annotation) => `
    <button class="annotation-card ${annotation.id === state.selectedAnnotationId ? "active" : ""}" data-list-annotation="${escapeHtml(annotation.id)}" type="button">
      <strong>${escapeHtml(annotationTitle(annotation))}</strong>
      <span>P.${Number(annotation.page || 1)} · ${escapeHtml(annotation.note || "未填写说明")}</span>
      <div class="pill-row">
        <span class="pill ${escapeHtml(annotation.status || "open")}">${escapeHtml(statusLabel(annotation.status))}</span>
        <span class="pill">${escapeHtml(typeLabel(annotation.type))}</span>
        <span class="pill">${escapeHtml(annotation.actor || "系统")}</span>
      </div>
      <small>${escapeHtml(formatDateTime(annotation.createdAt))}</small>
    </button>
  `).join("");
  Array.from(elements.annotationList.querySelectorAll("[data-list-annotation]")).forEach((button) => {
    button.addEventListener("click", () => selectAnnotation(button.dataset.listAnnotation || ""));
  });
}

function renderDetail() {
  const annotation = selectedAnnotation();
  if (!annotation) {
    elements.detailCard.classList.add("hidden");
    elements.detailCard.innerHTML = "";
    return;
  }
  const editable = canEditAnnotation(annotation);
  const canStatus = canChangeAnnotationStatus(annotation);
  const canDelete = canDeleteAnnotation(annotation);
  const canReply = canReplyAnnotation();
  const attachments = Array.isArray(annotation.attachments) ? annotation.attachments : [];
  const replies = Array.isArray(annotation.replies) ? annotation.replies : [];
  elements.detailCard.classList.remove("hidden");
  elements.detailCard.innerHTML = `
    <div class="detail-head">
      <div>
        <strong>${escapeHtml(annotationTitle(annotation))}</strong>
        <span>P.${Number(annotation.page || 1)} · ${escapeHtml(typeLabel(annotation.type))} · ${escapeHtml(annotation.actor || "系统")}</span>
      </div>
      <button class="icon-button" data-detail-action="close" type="button">×</button>
    </div>
    <div class="field-grid">
      <label>标题
        <input class="text-input" data-field="title" value="${escapeHtml(annotation.title || "")}" ${editable ? "" : "disabled"} />
      </label>
      <label>说明
        <textarea class="textarea" data-field="note" ${editable ? "" : "disabled"}>${escapeHtml(annotation.note || "")}</textarea>
      </label>
      <label>状态
        <select class="text-input" data-field="status" ${canStatus ? "" : "disabled"}>
          ${["open", "in_progress", "resolved"].map((status) => `<option value="${status}" ${status === (annotation.status || "open") ? "selected" : ""}>${escapeHtml(statusLabel(status))}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="detail-actions">
      <button class="text-button primary" data-detail-action="save" type="button" ${editable || canStatus ? "" : "disabled"}>保存</button>
      <button class="text-button" data-detail-action="delete" type="button" ${canDelete ? "" : "disabled"}>删除</button>
      <button class="text-button" data-detail-action="locate" type="button">定位</button>
    </div>
    <div class="attachments">
      <div class="mini-row"><strong>证据附件</strong><span>${attachments.length} 个</span></div>
      ${attachments.length ? attachments.map(renderAttachment).join("") : `<span class="pill">暂无附件</span>`}
    </div>
    <div class="replies">
      <div class="mini-row"><strong>回复讨论</strong><span>${replies.length} 条</span></div>
      ${replies.length ? replies.map(renderReply).join("") : `<span class="pill">暂无回复</span>`}
      ${canReply ? `
        <textarea class="textarea" data-field="reply" placeholder="添加回复，不会遮挡图纸画布"></textarea>
        <button class="text-button" data-detail-action="reply" type="button">发送回复</button>
      ` : ""}
    </div>
  `;
  bindDetailEvents(annotation);
}

function renderAttachment(attachment) {
  const href = attachment.url || attachment.previewUrl || "#";
  const label = attachment.name || "附件";
  return `<a class="link-chip" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function renderReply(reply) {
  return `
    <article class="annotation-card">
      <strong>${escapeHtml(reply.actor || "系统")}</strong>
      <span>${escapeHtml(reply.content || "补充了附件")}</span>
      <small>${escapeHtml(formatDateTime(reply.createdAt))}</small>
      ${(reply.attachments || []).map(renderAttachment).join("")}
    </article>
  `;
}

function bindDetailEvents(annotation) {
  elements.detailCard.querySelector('[data-detail-action="close"]')?.addEventListener("click", () => {
    state.selectedAnnotationId = "";
    renderAnnotations();
    renderDetail();
  });
  elements.detailCard.querySelector('[data-detail-action="locate"]')?.addEventListener("click", () => {
    void focusAnnotation(annotation.id, annotation.page);
  });
  elements.detailCard.querySelector('[data-detail-action="save"]')?.addEventListener("click", () => {
    void saveSelectedAnnotation();
  });
  elements.detailCard.querySelector('[data-detail-action="delete"]')?.addEventListener("click", () => {
    void deleteSelectedAnnotation();
  });
  elements.detailCard.querySelector('[data-detail-action="reply"]')?.addEventListener("click", () => {
    void replyToSelectedAnnotation();
  });
}

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
  if (state.activeTool === "pan") {
    state.pan = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: elements.viewerScroll.scrollLeft,
      top: elements.viewerScroll.scrollTop,
    };
    elements.annotationLayer.setPointerCapture?.(event.pointerId);
    return;
  }
  if (!canCreateAnnotation()) {
    return;
  }
  const point = eventPointToPageRatio(event);
  state.drag = {
    pointerId: event.pointerId,
    type: state.activeTool,
    start: point,
    current: point,
  };
  state.draft = draftFromDrag(state.drag);
  elements.annotationLayer.setPointerCapture?.(event.pointerId);
  renderAnnotations();
}

function handleWindowPointerMove(event) {
  if (state.pan && state.pan.pointerId === event.pointerId) {
    elements.viewerScroll.scrollLeft = state.pan.left - (event.clientX - state.pan.x);
    elements.viewerScroll.scrollTop = state.pan.top - (event.clientY - state.pan.y);
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
  if (draft.width < 0.006 || draft.height < 0.006) {
    renderAnnotations();
    return;
  }
  void createAnnotationFromDraft(draft);
}

function eventPointToPageRatio(event) {
  const rect = elements.pageWrap.getBoundingClientRect();
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
  return {
    type: drag.type === "note" ? "note" : "mark",
    page: state.page,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

async function createAnnotationFromDraft(draft) {
  try {
    const title = draft.type === "note" ? `文本批注 · 第 ${draft.page} 页` : `矩形批注 · 第 ${draft.page} 页`;
    const payload = {
      ...draft,
      title,
      note: "",
      actor: state.actor,
      color: draft.type === "note" ? "amber" : "blue",
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
  const title = elements.detailCard.querySelector('[data-field="title"]')?.value || annotation.title || "";
  const note = elements.detailCard.querySelector('[data-field="note"]')?.value ?? annotation.note ?? "";
  const status = elements.detailCard.querySelector('[data-field="status"]')?.value || annotation.status || "open";
  const payload = {
    actor: state.actor,
  };
  if (canEditAnnotation(annotation)) {
    payload.title = title;
    payload.note = note;
  }
  if (canChangeAnnotationStatus(annotation)) {
    payload.status = status;
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

async function deleteSelectedAnnotation() {
  const annotation = selectedAnnotation();
  if (!annotation || !canDeleteAnnotation(annotation)) {
    return;
  }
  if (!window.confirm("确认删除这条批注吗？")) {
    return;
  }
  try {
    const response = await deleteJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}`, {
      actor: state.actor,
    });
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
  const textarea = elements.detailCard.querySelector('[data-field="reply"]');
  const content = textarea?.value?.trim() || "";
  if (!annotation || !content) {
    notify("请先输入回复内容。", "alert");
    return;
  }
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/annotations/${encodeURIComponent(annotation.id)}/replies`, {
      actor: state.actor,
      content,
      attachments: [],
    });
    syncDocument(response.document);
    state.selectedAnnotationId = annotation.id;
    notify("回复已发送。", "success");
    renderShell();
  } catch (error) {
    notify(error.message || "发送回复失败。", "alert");
  }
}

async function exportReviewedPdf() {
  if (!annotationPermissions().export) {
    return;
  }
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/export`, {
      actor: state.actor,
    });
    if (response.downloadUrl) {
      window.open(response.downloadUrl, "_blank", "noopener");
    }
  } catch (error) {
    notify(error.message || "导出审阅版失败。", "alert");
  }
}

async function exportCommentReport() {
  if (!annotationPermissions().export) {
    return;
  }
  try {
    const response = await postJson(`/api/documents/${encodeURIComponent(state.document.id)}/comment-report`, {
      actor: state.actor,
    });
    if (response.downloadUrl) {
      window.open(response.downloadUrl, "_blank", "noopener");
    }
  } catch (error) {
    notify(error.message || "导出评论清单失败。", "alert");
  }
}

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
  const width = elements.pageWrap.clientWidth;
  const height = elements.pageWrap.clientHeight;
  elements.viewerScroll.scrollTo({
    left: Math.max(0, box.x * width - elements.viewerScroll.clientWidth / 2),
    top: Math.max(0, box.y * height - elements.viewerScroll.clientHeight / 2),
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
  state.selectedAnnotationId = "";
  state.draft = null;
  renderDetail();
  await renderCurrentPage();
}

async function commitPageInput(value) {
  const nextPage = clampPage(Number.parseInt(String(value || ""), 10) || state.page);
  if (nextPage === state.page) {
    renderPageControls();
    return;
  }
  state.page = nextPage;
  state.selectedAnnotationId = "";
  renderDetail();
  await renderCurrentPage();
}

async function adjustZoom(delta) {
  state.fitWidth = false;
  state.zoom = Math.max(0.35, Math.min(5, state.zoom + delta));
  await renderCurrentPage();
}

function setTool(tool) {
  if (tool !== "pan" && !canCreateAnnotation()) {
    notify("当前权限不允许新增批注。", "alert");
    return;
  }
  state.activeTool = tool;
  renderToolButtons();
}

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
  if (state.filter === "all") {
    return true;
  }
  if (state.filter === "resolved") {
    return annotation.status === "resolved";
  }
  return annotation.status !== "resolved";
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
    circle: "定点",
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

function showState(title, message, showActions = false) {
  elements.stateTitle.textContent = title;
  elements.stateMessage.textContent = message;
  elements.stateActions.classList.toggle("hidden", !showActions);
  elements.stateWrap.classList.remove("hidden");
}

function hideState() {
  elements.stateWrap.classList.add("hidden");
}

function notify(message, tone = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), tone === "alert" ? 5200 : 2800);
}

async function fetchJson(url, options = {}) {
  const { headers = {}, ...rest } = options;
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...rest,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function patchJson(url, body) {
  return fetchJson(url, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function deleteJson(url, body) {
  return fetchJson(url, {
    method: "DELETE",
    body: JSON.stringify(body || {}),
  });
}

function debounce(fn, delay) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

void init();
