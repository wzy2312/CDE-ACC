const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(20080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 8000;
const BOOTSTRAP_PASSWORD = "cde@123456";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, pathname, { body, cookie, binary = false } = {}) {
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
        const chunks = [];
        let responseBody = "";
        if (!binary) {
          res.setEncoding("utf8");
        }
        res.on("data", (chunk) => {
          if (binary) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            return;
          }
          responseBody += chunk;
        });
        res.on("end", () => {
          const rawBody = binary ? Buffer.concat(chunks) : responseBody;
          let json = null;
          if (!binary && responseBody) {
            try {
              json = JSON.parse(responseBody);
            } catch {
              json = null;
            }
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: rawBody, json });
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

function startMockAiEndpoint(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, () => {
      server.off("error", reject);
      const port = server.address().port;
      resolve({
        url: `http://${HOST}:${port}/mock-ai`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
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
    throw new Error(`${label} expected ${expected}, received ${response.statusCode}: ${response.body}`);
  }
  return response.json;
}

function sessionCookie(response) {
  const cookies = response.headers["set-cookie"] || [];
  const session = cookies.find((item) => item.startsWith("cde_session="));
  if (!session) {
    throw new Error("Login response did not set cde_session cookie");
  }
  return session.split(";")[0];
}

async function loginAs(email, expectedRole) {
  const response = await request("POST", "/api/session/login", {
    body: {
      email,
      password: BOOTSTRAP_PASSWORD,
    },
  });
  const payload = assertStatus(response, 200, `login ${email}`);
  if (!payload.authenticated || payload.currentUser?.email !== email) {
    throw new Error(`Login response did not return expected user ${email}`);
  }
  const cookie = sessionCookie(response);
  if (expectedRole) {
    const access = assertStatus(await request("GET", "/api/access", { cookie }), 200, `access ${email}`);
    if (access.capabilities?.role !== expectedRole) {
      throw new Error(`Expected ${email} role ${expectedRole}, received ${access.capabilities?.role}`);
    }
    payload.access = access;
  }
  return { cookie, payload };
}

function folderByPolicy(folders, policyKey) {
  const folder = folders.find((item) => item.policyKey === policyKey);
  if (!folder) {
    throw new Error(`Missing folder with policyKey ${policyKey}`);
  }
  return folder;
}

async function assertCreateDocumentStatus(cookie, expectedStatus, label, overrides = {}) {
  const fixture = pdfFixtureData();
  const response = await request("POST", "/api/documents", {
    cookie,
    body: {
      name: `smoke-${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}.pdf`,
      mimeType: "application/pdf",
      size: fixture.size,
      dataBase64: fixture.dataBase64,
      actor: label,
      conflictMode: "rename",
      ...overrides,
    },
  });
  if (response.statusCode !== expectedStatus) {
    throw new Error(`${label} create document expected ${expectedStatus}, received ${response.statusCode}: ${response.body}`);
  }
  return response.json;
}

function pdfFixtureData() {
  const pdfBase64 =
    "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwgL0xlbmd0aCAzID4+CnN0cmVhbQpCBQplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAzIDAgUiAvUmVzb3VyY2VzIDw8ID4+IC9Db250ZW50cyAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXQo+PgplbmRvYmoKMyAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzQgMCBSIF0gL0NvdW50IDEgPj4KZW5kb2JqCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDMgMCBSID4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyMzMgMDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMTc0IDAwMDAwIG4gCjAwMDAwMDAwNjcgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgoyODIKJSVFT0YK";
  const fileContent = Buffer.from(pdfBase64, "base64");
  return {
    size: fileContent.length,
    dataBase64: pdfBase64,
  };
}

function escapePdfText(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function simplePdfFixtureData({ revision, pipe, includePump = false, includeValve = false, movedY = 600 }) {
  const text = (x, y, size, value) => `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`;
  const commands = [
    "0 0 0 RG",
    "0.75 w",
    "48 48 499 746 re S",
    text(72, 780, 16, `P-010-001 REDLINE TEST ${revision}`),
    text(72, 720, 13, pipe),
    "2 w",
    "72 700 m 360 700 l S",
    text(72, movedY, 12, "PUMP_ROOM"),
  ];
  if (includePump) {
    commands.push(text(384, 560, 13, "P-101"));
    commands.push("384 540 84 42 re S");
  }
  if (includeValve) {
    commands.push(text(96, 520, 13, "V-003"));
    commands.push("96 500 74 36 re S");
  }
  const content = `${commands.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R /MediaBox [0 0 595 842] >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const fileContent = Buffer.from(body, "utf8");
  return {
    size: fileContent.length,
    dataBase64: fileContent.toString("base64"),
  };
}

async function runDrawingMetadataUpload(cookie) {
  const reference = await assertCreateDocumentStatus(cookie, 201, "drawing-reference", {
    name: `P-001-000_索引图_RevA-${Date.now()}.pdf`,
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-001-000",
      drawingName: "索引图",
      discipline: "总图",
      revision: "Rev.A",
    },
  });
  const referenceNumber = reference.document?.drawingMetadata?.drawingNumber;
  if (referenceNumber !== "P-001-000") {
    throw new Error(`Expected reference drawing metadata to round-trip, received ${referenceNumber || "empty"}`);
  }

  const invalid = await assertCreateDocumentStatus(cookie, 400, "drawing-metadata-invalid", {
    name: `P-001-002_缺字段_RevA-${Date.now()}.pdf`,
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-001-002",
    },
  });
  if (!String(invalid.error || "").includes("图纸属性声明缺少必填项")) {
    throw new Error(`Expected missing drawing metadata fields to be rejected, received: ${JSON.stringify(invalid)}`);
  }

  const created = await assertCreateDocumentStatus(cookie, 201, "drawing-metadata", {
    name: `P-001-001_总平面布置图_RevA-${Date.now()}.pdf`,
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-001-001",
      drawingName: "总平面布置图",
      discipline: "总图",
      revision: "Rev.A",
      relatedDrawingNumber: "P-001-000",
    },
  });
  const metadata = created.document?.drawingMetadata || {};
  if (
    metadata.markedAsDrawing !== true ||
    metadata.drawingNumber !== "P-001-001" ||
    metadata.drawingName !== "总平面布置图" ||
    metadata.discipline !== "总图" ||
    metadata.revision !== "Rev.A" ||
    metadata.relatedDrawingNumber !== "P-001-000" ||
    metadata.relatedDrawingId !== reference.document?.id
  ) {
    throw new Error(`Created drawing metadata did not round-trip: ${JSON.stringify(metadata)}`);
  }

  const docsAfter = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after drawing metadata upload");
  const listed = docsAfter.documents.find((item) => item.id === created.document.id);
  if (!listed || listed.drawingMetadata?.drawingNumber !== "P-001-001") {
    throw new Error("Documents list did not include persisted drawing metadata");
  }

  console.log("drawing metadata smoke passed: upload declaration is persisted and listed");
}

async function runDrawingRegister(cookie) {
  const stamp = Date.now();
  const pdf = await assertCreateDocumentStatus(cookie, 201, "drawing-register-pdf", {
    name: `P-777-001_循环水泵房布置图_RevB-${stamp}.pdf`,
    mimeType: "application/pdf",
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-777-001",
      drawingName: "循环水泵房布置图",
      discipline: "工艺",
      revision: "Rev.B",
    },
  });
  const dwg = await assertCreateDocumentStatus(cookie, 201, "drawing-register-dwg", {
    name: `P-777-001_循环水泵房布置图_RevB-${stamp}.dwg`,
    mimeType: "application/acad",
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-777-001",
      drawingName: "循环水泵房布置图",
      discipline: "工艺",
      revision: "Rev.B",
    },
  });
  const warningDwg = await assertCreateDocumentStatus(cookie, 201, "drawing-register-warning-dwg", {
    name: `P-777-002_基础平面布置图_RevC-${stamp}.dwg`,
    mimeType: "application/acad",
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-777-002",
      drawingName: "基础平面布置图",
      discipline: "结构",
      revision: "Rev.C",
    },
  });
  await assertCreateDocumentStatus(cookie, 201, "drawing-register-warning-pdf", {
    name: `P-777-002_基础平面图_RevC-${stamp}.pdf`,
    mimeType: "application/pdf",
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-777-002",
      drawingName: "基础平面图",
      discipline: "结构",
      revision: "Rev.C",
    },
  });
  const declaredWeakNamePdf = await assertCreateDocumentStatus(cookie, 201, "drawing-register-declared-weak-pdf", {
    name: `现场扫描图纸-${stamp}.pdf`,
    mimeType: "application/pdf",
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-777-005",
      drawingName: "现场扫描总平面图",
      discipline: "总图",
      revision: "Rev.A",
    },
  });
  const autoPdf = await assertCreateDocumentStatus(cookie, 201, "drawing-register-auto-pdf", {
    name: `P-777-004_自动归集管廊详图_RevA-${stamp}.pdf`,
    mimeType: "application/pdf",
  });
  const autoDwg = await assertCreateDocumentStatus(cookie, 201, "drawing-register-auto-dwg", {
    name: `P-777-004_自动归集管廊详图_RevA-${stamp}.dwg`,
    mimeType: "application/acad",
  });
  const looseAutoDwg = await assertCreateDocumentStatus(cookie, 201, "drawing-register-loose-auto-dwg", {
    name: `营地总平布置0908_t3-${stamp}.dwg`,
    mimeType: "application/acad",
  });
  const editablePdf = await assertCreateDocumentStatus(cookie, 201, "drawing-register-editable-pdf", {
    name: `P-777-006_待编辑目录项_RevA-${stamp}.pdf`,
    mimeType: "application/pdf",
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-777-006",
      drawingName: "待编辑目录项",
      discipline: "工艺",
      revision: "Rev.A",
    },
  });
  const editedMetadata = {
    markedAsDrawing: true,
    drawingNumber: "P-777-006A",
    drawingName: "目录编辑后图名",
    discipline: "管道",
    revision: "Rev.B",
  };
  const editedDoc = assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(editablePdf.document.id)}`, {
      cookie,
      body: {
        actor: "drawing-register-editor",
        drawingMetadata: editedMetadata,
      },
    }),
    200,
    "drawing register metadata edit updates source document",
  );
  if (
    editedDoc.document?.drawingMetadata?.drawingNumber !== editedMetadata.drawingNumber ||
    editedDoc.document?.drawingMetadata?.drawingName !== editedMetadata.drawingName ||
    editedDoc.document?.drawingMetadata?.discipline !== editedMetadata.discipline ||
    editedDoc.document?.drawingMetadata?.revision !== editedMetadata.revision
  ) {
    throw new Error(`Document PATCH did not persist edited drawing metadata: ${JSON.stringify(editedDoc.document?.drawingMetadata)}`);
  }

  const register = assertStatus(await request("GET", "/api/drawing-apps/register", { cookie }), 200, "drawing register");
  const editedEntry = register.entries?.find((item) => item.drawingNo === editedMetadata.drawingNumber);
  if (
    !editedEntry ||
    editedEntry.name !== editedMetadata.drawingName ||
    editedEntry.discipline !== editedMetadata.discipline ||
    editedEntry.currentVersion?.version !== editedMetadata.revision ||
    editedEntry.currentVersion?.formats?.pdf?.fileId !== editablePdf.document.id
  ) {
    throw new Error(`Drawing register did not reflect edited source document metadata: ${JSON.stringify(editedEntry)}`);
  }
  if (register.entries?.some((item) => item.drawingNo === "P-777-006")) {
    throw new Error("Drawing register still contains the stale drawing number after metadata edit");
  }
  const docsAfterEdit = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after drawing register metadata edit");
  const listedEditable = docsAfterEdit.documents?.find((item) => item.id === editablePdf.document.id);
  if (
    listedEditable?.drawingMetadata?.drawingNumber !== editedMetadata.drawingNumber ||
    listedEditable?.drawingMetadata?.drawingName !== editedMetadata.drawingName
  ) {
    throw new Error(`File management document list did not receive edited drawing metadata: ${JSON.stringify(listedEditable?.drawingMetadata)}`);
  }
  const entry = register.entries?.find((item) => item.drawingNo === "P-777-001");
  if (!entry || entry.currentVersion?.formats?.pdf?.fileId !== pdf.document.id || entry.currentVersion?.formats?.dwg?.fileId !== dwg.document.id) {
    throw new Error(`Drawing register did not group PDF and DWG under one entry: ${JSON.stringify(entry)}`);
  }
  if (entry.currentVersion.consistencyStatus !== "pass") {
    throw new Error(`Expected drawing register consistency pass, received ${entry.currentVersion.consistencyStatus}`);
  }
  const warningEntry = register.entries?.find((item) => item.drawingNo === "P-777-002");
  if (!warningEntry || warningEntry.currentVersion?.consistencyStatus !== "warning" || !warningEntry.currentVersion.consistencyDetails?.length) {
    throw new Error(`Drawing register did not surface PDF/DWG consistency warning: ${JSON.stringify(warningEntry)}`);
  }
  if (!register.completeness || Number(register.completeness.both || 0) < 1 || Number(register.completeness.inconsistent || 0) < 1) {
    throw new Error(`Drawing register completeness summary is missing expected counts: ${JSON.stringify(register.completeness)}`);
  }
  const declaredWeakPdfEntry = register.entries?.find((item) => item.drawingNo === "P-777-005");
  if (
    !declaredWeakPdfEntry ||
    declaredWeakPdfEntry.currentVersion?.formats?.pdf?.fileId !== declaredWeakNamePdf.document.id ||
    declaredWeakPdfEntry.currentVersion?.metadataSource !== "declared" ||
    declaredWeakPdfEntry.currentVersion?.metadataConfidence !== "user" ||
    declaredWeakPdfEntry.currentVersion?.requiresMetadataConfirmation
  ) {
    throw new Error(`Declared PDF drawing metadata did not drive register aggregation: ${JSON.stringify(declaredWeakPdfEntry)}`);
  }
  const autoEntry = register.entries?.find((item) => item.drawingNo === "P-777-004");
  if (
    !autoEntry ||
    autoEntry.currentVersion?.formats?.pdf?.fileId !== autoPdf.document.id ||
    autoEntry.currentVersion?.formats?.dwg?.fileId !== autoDwg.document.id ||
    autoEntry.currentVersion?.metadataSource !== "auto" ||
    autoEntry.currentVersion?.metadataConfidence !== "filename"
  ) {
    throw new Error(`Drawing register did not automatically aggregate inferable PDF/DWG files: ${JSON.stringify(autoEntry)}`);
  }
  const looseAutoEntry = register.entries?.find((item) => item.currentVersion?.formats?.dwg?.fileId === looseAutoDwg.document.id);
  if (
    !looseAutoEntry ||
    looseAutoEntry.currentVersion?.metadataSource !== "auto" ||
    looseAutoEntry.currentVersion?.metadataConfidence !== "filename_loose" ||
    !looseAutoEntry.currentVersion?.requiresMetadataConfirmation ||
    looseAutoEntry.currentVersion?.version !== "V1"
  ) {
    throw new Error(`Drawing register did not auto-collect loose DWG from file management: ${JSON.stringify(looseAutoEntry)}`);
  }

  const expectedResult = assertStatus(
    await request("POST", "/api/drawing-apps/register/expected", {
      cookie,
      body: {
        drawings: [
          {
            drawingNo: "P-777-001",
            name: "循环水泵房布置图",
            discipline: "工艺",
            plannedDate: "2026-04-30",
            responsible: "工艺负责人",
          },
          {
            drawingNo: `P-777-003-${stamp}`,
            name: "未提交管廊详图",
            discipline: "结构",
            plannedDate: "2026-04-01",
            responsible: "结构负责人",
          },
        ],
      },
    }),
    200,
    "drawing register expected list upsert",
  );
  if (!expectedResult.expectedSummary || Number(expectedResult.expectedSummary.overdue || 0) < 1 || Number(expectedResult.expectedSummary.uploaded || 0) < 1) {
    throw new Error(`Drawing register expected summary did not reflect uploaded and overdue drawings: ${JSON.stringify(expectedResult.expectedSummary)}`);
  }

  const confirmedConsistency = assertStatus(
    await request("POST", `/api/drawing-apps/register/versions/${encodeURIComponent(warningEntry.currentVersion.id)}/consistency/confirm`, {
      cookie,
      body: {
        basis: "pdf",
        note: "以 PDF 图框字段为准，DWG 下次出图同步修正。",
      },
    }),
    200,
    "drawing register consistency confirm",
  );
  const confirmedEntry = confirmedConsistency.register?.entries?.find((item) => item.drawingNo === "P-777-002");
  if (confirmedEntry?.currentVersion?.consistencyStatus !== "confirmed" || Number(confirmedConsistency.register?.completeness?.inconsistent || 0) >= Number(register.completeness.inconsistent || 0)) {
    throw new Error(`Drawing register consistency confirmation did not clear the warning: ${JSON.stringify(confirmedEntry?.currentVersion)}`);
  }

  const exportResult = assertStatus(
    await request("POST", "/api/drawing-apps/register/export", {
      cookie,
      body: { format: "all" },
    }),
    200,
    "drawing register export",
  );
  if (!exportResult.downloadUrl || !String(exportResult.downloadUrl).includes(".xlsx")) {
    throw new Error("Drawing register export did not return an xlsx download URL");
  }
  const exportDownload = await request("GET", exportResult.downloadUrl, { cookie, binary: true });
  if (exportDownload.statusCode !== 200 || !Buffer.isBuffer(exportDownload.body) || !exportDownload.body.length) {
    throw new Error(`Expected drawing register workbook download, received ${exportDownload.statusCode}`);
  }
  const registerRows = readWorkbookRows(exportDownload.body, "图纸目录");
  if (!registerRows.some((row) => row["图纸编号"] === "P-777-001" && row["PDF状态"] === "存在" && row["DWG状态"] === "存在")) {
    throw new Error("Drawing register workbook is missing grouped PDF/DWG row");
  }
  if (!registerRows.some((row) => row["图纸编号"] === "P-777-004" && row["归集来源"] === "自动归集")) {
    throw new Error("Drawing register workbook is missing auto aggregation source");
  }

  const packageResult = assertStatus(
    await request("POST", "/api/drawing-apps/packages", {
      cookie,
      body: {
        name: "第一批施工图",
        type: "complete",
        versionIds: [entry.currentVersion.id, warningEntry.currentVersion.id],
        recipients: [
          { name: "业主代表 B", format: "pdf", ackRequired: true },
        ],
      },
    }),
    201,
    "create drawing package",
  );
  if (!packageResult.package?.packageNo || packageResult.package?.drawingCount !== 2 || !packageResult.package.preCheckWarnings?.length) {
    throw new Error(`Drawing package creation did not persist package and warnings: ${JSON.stringify(packageResult.package)}`);
  }
  if (packageResult.package.preCheckWarnings.some((warning) => String(warning).includes("格式一致性"))) {
    throw new Error(`Confirmed consistency warning should not block package pre-checks: ${JSON.stringify(packageResult.package.preCheckWarnings)}`);
  }
  const registerAfterPackage = assertStatus(await request("GET", "/api/drawing-apps/register", { cookie }), 200, "drawing register after package");
  if (!registerAfterPackage.packages?.some((item) => item.id === packageResult.package.id && item.status === "draft")) {
    throw new Error("Drawing register payload did not include the created print package");
  }

  const publishedPackage = assertStatus(
    await request("POST", `/api/drawing-apps/packages/${encodeURIComponent(packageResult.package.id)}/publish`, {
      cookie,
      body: {
        note: "系统内发送，生成受控访问链接。",
      },
    }),
    200,
    "publish drawing package",
  );
  if (publishedPackage.package?.status !== "published" || !publishedPackage.package?.publishedAt || !publishedPackage.package?.recipients?.[0]?.linkExpiresAt) {
    throw new Error(`Drawing package publish did not set published state and controlled links: ${JSON.stringify(publishedPackage.package)}`);
  }
  const lockedRegister = publishedPackage.register?.entries?.find((item) => item.drawingNo === "P-777-001");
  if (!lockedRegister?.currentVersion?.locked || lockedRegister.currentVersion.publishStatusKey !== "published") {
    throw new Error(`Published drawing package did not lock referenced versions: ${JSON.stringify(lockedRegister?.currentVersion)}`);
  }

  const recipientId = publishedPackage.package.recipients[0].id;
  const ackedPackage = assertStatus(
    await request("POST", `/api/drawing-apps/packages/${encodeURIComponent(packageResult.package.id)}/recipients/${encodeURIComponent(recipientId)}/ack`, {
      cookie,
      body: {
        ackBy: "业主代表 B",
      },
    }),
    200,
    "ack drawing package recipient",
  );
  if (ackedPackage.package?.ackSummary !== "1/1 方" || !ackedPackage.package?.recipients?.[0]?.ackAt) {
    throw new Error(`Drawing package acknowledgement did not update recipient status: ${JSON.stringify(ackedPackage.package)}`);
  }

  console.log("drawing register smoke passed: grouped formats, expected list, consistency confirmation, export, publish, and ack");
}

function officeCommentFixtureData() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-office-comment-fixture-"));
  const filePath = path.join(workDir, "office-comment.xlsx");
  const script = [
    "from openpyxl import Workbook",
    "from openpyxl.comments import Comment",
    "import sys",
    "wb = Workbook()",
    "ws = wb.active",
    'ws.title = "审阅表"',
    'ws["A1"] = "预算"',
    'ws["B2"] = 128',
    'ws["B2"].comment = Comment("请更新预算数字", "管理员")',
    "wb.save(sys.argv[1])",
  ].join("\n");
  const result = spawnSync("python3", ["-c", script, filePath], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw new Error(`Failed to build office fixture workbook: ${result.stderr || result.stdout}`);
  }
  const buffer = fs.readFileSync(filePath);
  fs.rmSync(workDir, { recursive: true, force: true });
  return {
    size: buffer.length,
    dataBase64: buffer.toString("base64"),
  };
}

function readWorkbookRows(buffer, sheetName = "评论清单") {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-comment-report-"));
  const filePath = path.join(workDir, "report.xlsx");
  fs.writeFileSync(filePath, buffer);
  const script = [
    "from openpyxl import load_workbook",
    "import json",
    "import sys",
    "wb = load_workbook(sys.argv[1], data_only=True)",
    "ws = wb[sys.argv[2]]",
    "rows = list(ws.iter_rows(values_only=True))",
    "headers = [str(value or '') for value in rows[0]] if rows else []",
    "records = []",
    "for values in rows[1:]:",
    "    if not any(value not in (None, '') for value in values):",
    "        continue",
    "    records.append({headers[index]: ('' if value is None else str(value)) for index, value in enumerate(values)})",
    "print(json.dumps(records, ensure_ascii=False))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", script, filePath, sheetName], {
    encoding: "utf8",
  });
  fs.rmSync(workDir, { recursive: true, force: true });
  if (result.status !== 0) {
    throw new Error(`Failed to inspect exported workbook: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout || "[]");
}

async function createSmokeDocument(cookie, label) {
  const fileName = `smoke-${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}.pdf`;
  const fixture = pdfFixtureData();
  const createDocument = assertStatus(
    await request("POST", "/api/documents", {
      cookie,
      body: {
        name: fileName,
        mimeType: "application/pdf",
        size: fixture.size,
        dataBase64: fixture.dataBase64,
        actor: "管理员",
        conflictMode: "rename",
      },
    }),
    201,
    `create ${label} document`,
  );
  const document = createDocument.document;
  if (!document?.id || document.name !== fileName || !document.fileUrl) {
    throw new Error(`${label} document creation response is missing expected document fields`);
  }
  return document;
}

function folderPathNames(folders, folderId) {
  const names = [];
  let cursor = folders.find((folder) => folder.id === folderId) || null;
  while (cursor) {
    names.unshift(cursor.name);
    cursor = folders.find((folder) => folder.id === cursor.parentId) || null;
  }
  return names;
}

function folderByPathNames(folders, names) {
  let parentId = null;
  let matched = null;
  for (const name of names) {
    matched = folders.find((folder) => (folder.parentId || null) === (parentId || null) && folder.name === name) || null;
    if (!matched) {
      return null;
    }
    parentId = matched.id;
  }
  return matched;
}

async function createSmokeWorkflow(cookie, templateId, document, label) {
  const createWorkflow = assertStatus(
    await request("POST", "/api/workflows", {
      cookie,
      body: {
        workflowName: `Smoke ${label} 流程 ${Date.now()}`,
        templateId,
        fileIds: [document.id],
        actor: "管理员",
      },
    }),
    201,
    `create ${label} workflow`,
  );
  const workflow = createWorkflow.workflow;
  if (!workflow?.id || workflow.status !== "running" || workflow.fileRefs?.[0]?.docId !== document.id) {
    throw new Error(`${label} workflow creation response is missing expected running workflow fields`);
  }
  return workflow;
}

async function runWorkflowAction(cookie, workflowId, action, label) {
  const result = assertStatus(
    await request("POST", `/api/workflows/${encodeURIComponent(workflowId)}/actions`, {
      cookie,
      body: {
        action,
        actor: "管理员",
        comment: `${label} smoke action`,
      },
    }),
    200,
    `${label} workflow action ${action}`,
  );
  if (!result.workflow?.id) {
    throw new Error(`${label} workflow action response is missing workflow`);
  }
  return result.workflow;
}

async function approveWorkflowToEnd(cookie, workflow) {
  let currentWorkflow = workflow;
  let guard = 0;

  while (currentWorkflow.status === "running") {
    guard += 1;
    if (guard > 10) {
      throw new Error("Approval workflow did not finish within expected action count");
    }

    currentWorkflow = await runWorkflowAction(cookie, currentWorkflow.id, "approveFlow", `approve-${guard}`);
  }

  if (currentWorkflow.status !== "approved") {
    throw new Error(`Expected approved workflow status, received ${currentWorkflow.status}`);
  }
  return currentWorkflow;
}

async function waitForWorkflowCrsDraft(cookie, workflowId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const documentsPayload = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents during crs draft polling");
    const workflow = (documentsPayload.workflows || []).find((item) => item.id === workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} disappeared while polling CRS draft status`);
    }
    const status = String(workflow.crsDraft?.status || "").trim();
    if (status === "succeeded" || status === "failed") {
      return workflow;
    }
    await delay(200);
  }
  throw new Error("Timed out waiting for workflow CRS draft generation");
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

async function runWorkflowReportAutoExport(cookie, templates) {
  const autoExportTemplate = templates.find(
    (item) => item.autoExport?.enabled && item.autoExport?.exportApprovalReport && Array.isArray(item.steps) && item.steps.length,
  );
  if (!autoExportTemplate) {
    throw new Error("No auto-export workflow template is available for report smoke test");
  }

  const document = await createSmokeDocument(cookie, "workflow-report");
  const workflow = await createSmokeWorkflow(cookie, autoExportTemplate.id, document, "workflow-report");
  const approvedWorkflow = await approveWorkflowToEnd(cookie, workflow);
  if (approvedWorkflow.status !== "approved") {
    throw new Error(`Expected report workflow to be approved, received ${approvedWorkflow.status}`);
  }

  const autoExport = approvedWorkflow.autoExport || {};
  const files = Array.isArray(autoExport.files) ? autoExport.files : [];
  if (autoExport.status !== "success" || !files.length) {
    throw new Error(`Expected workflow auto export success, received ${autoExport.status}: ${autoExport.error || "no files"}`);
  }
  const reportFile = files.find((item) => item.kind === "approval_record");
  if (!reportFile?.url || !reportFile.documentId) {
    throw new Error("Workflow auto export did not include an approval record file");
  }

  const download = await request("GET", reportFile.url, { cookie });
  if (download.statusCode !== 200 || !download.body.startsWith("%PDF")) {
    throw new Error(`Workflow report download expected a PDF, received ${download.statusCode}: ${download.body.slice(0, 40)}`);
  }

  const docsAfter = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after workflow report export");
  const exportedReport = docsAfter.documents.find((item) => item.id === reportFile.documentId);
  if (!exportedReport || exportedReport.status !== "approved" || !String(exportedReport.remarks || "").includes("审批记录单")) {
    throw new Error("Exported workflow approval record document is missing expected archive metadata");
  }

  console.log("workflow report smoke passed: auto-export approval record generated and downloadable");
}

async function runApsState(cookie) {
  const modelContent = Buffer.from("ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n", "utf8");
  const createDocument = assertStatus(
    await request("POST", "/api/documents", {
      cookie,
      body: {
        name: `smoke-model-${Date.now()}-${Math.floor(Math.random() * 1000)}.ifc`,
        mimeType: "application/octet-stream",
        size: modelContent.length,
        dataBase64: modelContent.toString("base64"),
        actor: "管理员",
        conflictMode: "rename",
      },
    }),
    201,
    "create aps model document",
  );
  const document = createDocument.document;
  if (!document?.id || document.aps?.translationStatus !== "queued") {
    throw new Error(`Expected APS model upload to queue translation, received ${document?.aps?.translationStatus}`);
  }

  const pendingConfig = assertStatus(
    await request("GET", `/api/aps/documents/${encodeURIComponent(document.id)}/config`, { cookie }),
    200,
    "aps pending config",
  );
  if (pendingConfig.enabled !== false || pendingConfig.reason !== "translation_pending") {
    throw new Error(`Expected APS pending/missing credentials config, received ${pendingConfig.reason}`);
  }

  const manualUrn = "urn:adsk.objects:os.object:bucket/smoke-model.ifc";
  const updateAps = assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(document.id)}/aps`, {
      cookie,
      body: {
        actor: "管理员",
        aps: {
          urn: manualUrn,
          translationStatus: "success",
          translationProgress: "100%",
          translationMessage: "手动填写 APS URN",
          defaultView: "3d",
          layoutMode: "linked",
          viewable2dGuid: "sheet-guid-smoke",
          viewable3dGuid: "model-guid-smoke",
          savedViews: [
            {
              name: "Smoke 视点",
              layoutMode: "linked",
              primaryRole: "3d",
              primaryGuid: "model-guid-smoke",
              primaryState: { viewport: { eye: [1, 2, 3], target: [0, 0, 0] } },
            },
          ],
          isolatedDbIds: [1, 2, 3],
          themingColors: [{ dbId: 1, color: [1, 0, 0, 1], label: "重点构件" }],
        },
      },
    }),
    200,
    "update aps config",
  );
  const updatedAps = updateAps.document?.aps;
  if (!updatedAps || updatedAps.urn !== manualUrn || updatedAps.translationStatus !== "success") {
    throw new Error(`Expected manual APS URN to mark success, received ${updatedAps?.translationStatus}`);
  }
  if (updatedAps.defaultView !== "3d" || updatedAps.savedViews?.length !== 1 || updatedAps.isolatedDbIds?.length !== 3) {
    throw new Error("APS config did not persist view state fields");
  }

  const enabledConfig = assertStatus(
    await request("GET", `/api/aps/documents/${encodeURIComponent(document.id)}/config`, { cookie }),
    200,
    "aps enabled config",
  );
  if (enabledConfig.enabled !== true || enabledConfig.viewerVersion !== "7.*" || enabledConfig.viewerApi !== "streamingV2") {
    throw new Error(`Expected APS viewer config to use saved system settings, received ${JSON.stringify(enabledConfig).slice(0, 160)}`);
  }

  const retry = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(document.id)}/aps/translate`, {
      cookie,
      body: { actor: "管理员", reason: "smoke retry" },
    }),
    200,
    "retry aps translation",
  );
  if (retry.document?.aps?.translationStatus !== "queued" || !retry.document?.aps?.translationRequestId) {
    throw new Error(`Expected APS retry to queue translation, received ${retry.document?.aps?.translationStatus}`);
  }

  console.log("aps smoke passed: queued/manual urn/view state/retry boundaries");
}

async function runOnlyOfficeCallback(cookie) {
  const initialContent = Buffer.from("name,value\ninitial,1\n", "utf8");
  const createDocument = assertStatus(
    await request("POST", "/api/documents", {
      cookie,
      body: {
        name: `smoke-office-${Date.now()}-${Math.floor(Math.random() * 1000)}.csv`,
        mimeType: "text/csv",
        size: initialContent.length,
        dataBase64: initialContent.toString("base64"),
        actor: "管理员",
        conflictMode: "rename",
      },
    }),
    201,
    "create office document",
  );
  const document = createDocument.document;
  if (!document?.id || !document.currentVersionId || document.version !== "V1") {
    throw new Error("Office document creation response is missing expected version fields");
  }

  const savedContent = Buffer.from("name,value\nupdated,2\n", "utf8");
  const configPayload = assertStatus(
    await request("GET", `/api/onlyoffice/documents/${encodeURIComponent(document.id)}/config?mode=edit`, { cookie }),
    200,
    "onlyoffice editable config",
  );
  const callbackUrl = configPayload.config?.editorConfig?.callbackUrl || "";
  if (!callbackUrl) {
    throw new Error("OnlyOffice editable config did not include callbackUrl");
  }
  const callbackTarget = new URL(callbackUrl);
  const callback = assertStatus(
    await request("POST", `${callbackTarget.pathname}${callbackTarget.search}`, {
      body: {
        status: 2,
        url: `data:text/csv;base64,${savedContent.toString("base64")}`,
      },
    }),
    200,
    "onlyoffice callback",
  );
  if (callback.error !== 0) {
    throw new Error(`OnlyOffice callback returned error ${callback.error}`);
  }

  const docsAfter = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after onlyoffice callback");
  const updated = docsAfter.documents.find((item) => item.id === document.id);
  if (!updated || updated.version !== "V2" || updated.versionHistory?.length < 2) {
    throw new Error(`Expected OnlyOffice callback to create V2, received ${updated?.version}`);
  }
  const latestVersion = updated.versionHistory.find((item) => item.isCurrent);
  if (!latestVersion || latestVersion.note !== "OnlyOffice 在线编辑保存") {
    throw new Error("OnlyOffice callback did not mark the current version with the expected note");
  }

  const duplicateCallback = assertStatus(
    await request("POST", `${callbackTarget.pathname}${callbackTarget.search}`, {
      body: {
        status: 2,
        url: `data:text/csv;base64,${savedContent.toString("base64")}`,
      },
    }),
    200,
    "duplicate onlyoffice callback",
  );
  if (duplicateCallback.error !== 0 || duplicateCallback.skipped !== true) {
    throw new Error("Duplicate OnlyOffice callback should be skipped idempotently");
  }

  console.log("onlyoffice smoke passed: callback saved V2 and duplicate skipped");
}

async function runOnlyOfficeCallbackAcrossProjects(cookie) {
  const access = assertStatus(await request("GET", "/api/access", { cookie }), 200, "onlyoffice project access");
  const originalProject = access.projects.find((item) => item.isCurrent) || access.project;
  const alternateProject = access.projects.find((item) => !item.isCurrent);
  if (!originalProject?.id || !alternateProject?.id) {
    console.log("onlyoffice cross-project smoke skipped: requires at least two projects");
    return;
  }

  try {
    assertStatus(
      await request("POST", "/api/session/project", {
        cookie,
        body: { projectId: alternateProject.id },
      }),
      200,
      "switch to alternate project for onlyoffice callback",
    );

    const initialContent = Buffer.from("name,value\nalt,1\n", "utf8");
    const createDocument = assertStatus(
      await request("POST", "/api/documents", {
        cookie,
        body: {
          name: `smoke-office-alt-${Date.now()}-${Math.floor(Math.random() * 1000)}.csv`,
          mimeType: "text/csv",
          size: initialContent.length,
          dataBase64: initialContent.toString("base64"),
          actor: "管理员",
          conflictMode: "rename",
        },
      }),
      201,
      "create alternate project office document",
    );
    const document = createDocument.document;
    if (document.projectId !== alternateProject.id || document.version !== "V1") {
      throw new Error(`Expected alternate project V1 document, received ${document.projectId} ${document.version}`);
    }

    const configPayload = assertStatus(
      await request("GET", `/api/onlyoffice/documents/${encodeURIComponent(document.id)}/config?mode=edit`, { cookie }),
      200,
      "alternate project onlyoffice config",
    );
    const callbackUrl = configPayload.config?.editorConfig?.callbackUrl || "";
    if (!callbackUrl) {
      throw new Error("OnlyOffice editable config did not include a callbackUrl");
    }

    const callbackTarget = new URL(callbackUrl);
    const savedContent = Buffer.from("name,value\nalt-updated,2\n", "utf8");
    assertStatus(
      await request("POST", `${callbackTarget.pathname}${callbackTarget.search}`, {
        body: {
          status: 2,
          url: `data:text/csv;base64,${savedContent.toString("base64")}`,
        },
      }),
      200,
      "alternate project onlyoffice callback",
    );

    const docsAfter = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "alternate project documents after onlyoffice callback");
    const updated = docsAfter.documents.find((item) => item.id === document.id);
    if (!updated || updated.version !== "V2" || updated.versionHistory?.length < 2) {
      throw new Error(`Expected alternate project OnlyOffice callback to create V2, received ${updated?.version}`);
    }

    console.log("onlyoffice cross-project smoke passed: callback preserves project edit grant");
  } finally {
    await request("POST", "/api/session/project", {
      cookie,
      body: { projectId: originalProject.id },
    });
  }
}

async function runReviewExport(cookie) {
  const document = await createSmokeDocument(cookie, "export");
  const createAnnotation = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations`, {
      cookie,
      body: {
        type: "note",
        page: 1,
        x: 0.18,
        y: 0.18,
        width: 0.16,
        height: 0.1,
        title: "导出批注",
        note: "导出 smoke 测试批注",
        actor: "管理员",
      },
    }),
    201,
    "create export annotation",
  );
  if (!createAnnotation.annotation?.id) {
    throw new Error("Export smoke annotation was not created");
  }

  const exportResult = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(document.id)}/export`, {
      cookie,
      body: {},
    }),
    200,
    "export reviewed pdf",
  );
  if (!exportResult.downloadUrl || !exportResult.document?.exportUrl) {
    throw new Error("Export response is missing downloadUrl or document exportUrl");
  }

  const download = await request("GET", exportResult.downloadUrl, { cookie });
  if (download.statusCode !== 200 || !download.body.startsWith("%PDF")) {
    throw new Error(`Export download expected a PDF, received ${download.statusCode}: ${download.body.slice(0, 40)}`);
  }

  console.log("export smoke passed: reviewed PDF generated and downloadable");
}

async function runCommentReportExport(cookie, templateId) {
  const pdfDocument = await createSmokeDocument(cookie, "comment-report-pdf");
  const createAnnotation = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(pdfDocument.id)}/annotations`, {
      cookie,
      body: {
        type: "note",
        page: 1,
        x: 0.22,
        y: 0.2,
        width: 0.16,
        height: 0.1,
        title: "评论导出批注",
        note: "PDF 批注内容需要进入 Excel",
        actor: "管理员",
      },
    }),
    201,
    "create comment report annotation",
  );
  const annotation = createAnnotation.annotation;
  if (!annotation?.id) {
    throw new Error("Comment report annotation was not created");
  }

  assertStatus(
    await request("PUT", `/api/documents/${encodeURIComponent(pdfDocument.id)}/remarks`, {
      cookie,
      body: {
        remarks: "这是文档级备注",
        actor: "管理员",
      },
    }),
    200,
    "save comment report remarks",
  );

  assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(pdfDocument.id)}/annotations/${encodeURIComponent(annotation.id)}/replies`, {
      cookie,
      body: {
        actor: "管理员",
        content: "这是批注回复",
      },
    }),
    201,
    "create comment report reply",
  );

  const pdfExport = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(pdfDocument.id)}/comment-report`, {
      cookie,
      body: {},
    }),
    200,
    "export pdf comment report",
  );
  if (!pdfExport.downloadUrl || !String(pdfExport.downloadUrl).includes(".xlsx")) {
    throw new Error("PDF comment report response is missing an xlsx download URL");
  }

  const pdfDownload = await request("GET", pdfExport.downloadUrl, { cookie, binary: true });
  if (pdfDownload.statusCode !== 200 || !Buffer.isBuffer(pdfDownload.body) || !pdfDownload.body.length) {
    throw new Error(`Expected PDF comment report download, received ${pdfDownload.statusCode}`);
  }
  const pdfRows = readWorkbookRows(pdfDownload.body);
  if (!pdfRows.some((row) => row["记录类型"] === "系统批注" && row["内容"] === "PDF 批注内容需要进入 Excel")) {
    throw new Error("PDF comment report workbook is missing the annotation row");
  }
  if (!pdfRows.some((row) => row["记录类型"] === "批注回复" && row["内容"] === "这是批注回复")) {
    throw new Error("PDF comment report workbook is missing the reply row");
  }
  if (!pdfRows.some((row) => row["记录类型"] === "文档备注" && row["内容"] === "这是文档级备注")) {
    throw new Error("PDF comment report workbook is missing the document remark row");
  }

  if (templateId) {
    const workflow = await createSmokeWorkflow(cookie, templateId, pdfDocument, "workflow-comment-report");
    const workflowExport = assertStatus(
      await request("POST", `/api/workflows/${encodeURIComponent(workflow.id)}/comment-report`, {
        cookie,
        body: {},
      }),
      200,
      "export workflow comment report",
    );
    if (!workflowExport.downloadUrl || !String(workflowExport.downloadUrl).includes(".xlsx")) {
      throw new Error("Workflow comment report response is missing an xlsx download URL");
    }
    const workflowDownload = await request("GET", workflowExport.downloadUrl, { cookie, binary: true });
    if (workflowDownload.statusCode !== 200 || !Buffer.isBuffer(workflowDownload.body) || !workflowDownload.body.length) {
      throw new Error(`Expected workflow comment report download, received ${workflowDownload.statusCode}`);
    }
    const workflowRows = readWorkbookRows(workflowDownload.body);
    if (!workflowRows.some((row) => row["文件名称"] === pdfDocument.name && row["记录类型"] === "系统批注")) {
      throw new Error("Workflow comment report workbook is missing document annotation rows");
    }
  }

  const officeFixture = officeCommentFixtureData();
  const createOfficeDocument = assertStatus(
    await request("POST", "/api/documents", {
      cookie,
      body: {
        name: `office-comment-${Date.now()}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: officeFixture.size,
        dataBase64: officeFixture.dataBase64,
        actor: "管理员",
        conflictMode: "rename",
      },
    }),
    201,
    "create office comment report document",
  );
  const officeDocument = createOfficeDocument.document;
  if (!officeDocument?.id) {
    throw new Error("Office comment report document creation failed");
  }

  const officeExport = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(officeDocument.id)}/comment-report`, {
      cookie,
      body: {},
    }),
    200,
    "export office comment report",
  );
  if (!officeExport.downloadUrl || !String(officeExport.downloadUrl).includes(".xlsx")) {
    throw new Error("Office comment report response is missing an xlsx download URL");
  }

  const officeDownload = await request("GET", officeExport.downloadUrl, { cookie, binary: true });
  if (officeDownload.statusCode !== 200 || !Buffer.isBuffer(officeDownload.body) || !officeDownload.body.length) {
    throw new Error(`Expected office comment report download, received ${officeDownload.statusCode}`);
  }
  const officeRows = readWorkbookRows(officeDownload.body);
  if (!officeRows.some((row) => row["评论来源"] === "OnlyOffice原生评论" && row["内容"] === "请更新预算数字" && row["锚点/定位"] === "B2")) {
    throw new Error("Office comment report workbook is missing the native comment row");
  }

  console.log("comment report smoke passed: document and workflow comments exported to xlsx");
}

async function runWorkflowCrsDraft(cookie, templateId) {
  const document = await createSmokeDocument(cookie, "workflow-crs");
  const workflow = await createSmokeWorkflow(cookie, templateId, document, "workflow-crs");

  const firstAnnotation = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations`, {
      cookie,
      body: {
        type: "mark",
        page: 1,
        x: 0.2,
        y: 0.2,
        width: 0.18,
        height: 0.12,
        title: "结构梁编号错误",
        note: "请核对主梁编号与平面标识，当前编号不一致。",
        actor: "管理员",
      },
    }),
    201,
    "create first crs annotation",
  ).annotation;

  const secondAnnotation = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations`, {
      cookie,
      body: {
        type: "note",
        page: 1,
        x: 0.42,
        y: 0.28,
        width: 0.12,
        height: 0.08,
        title: "主梁编号需统一",
        note: "梁编号与图纸说明存在差异，请统一。",
        actor: "管理员",
      },
    }),
    201,
    "create second crs annotation",
  ).annotation;

  assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations/${encodeURIComponent(firstAnnotation.id)}/replies`, {
      cookie,
      body: {
        actor: "管理员",
        content: "已根据结构说明调整编号，待终审确认。",
      },
    }),
    201,
    "create crs reply",
  );

  assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(document.id)}/annotations/${encodeURIComponent(secondAnnotation.id)}`, {
      cookie,
      body: {
        actor: "管理员",
        status: "resolved",
      },
    }),
    200,
    "resolve second crs annotation",
  );

  await runWorkflowAction(cookie, workflow.id, "approveFlow", "crs-approval");

  const generateResult = await request("POST", `/api/workflows/${encodeURIComponent(workflow.id)}/crs-draft`, {
    cookie,
    body: {},
  });
  if (generateResult.statusCode !== 202) {
    throw new Error(`Expected CRS draft generate response 202, received ${generateResult.statusCode}: ${generateResult.body}`);
  }

  const completedWorkflow = await waitForWorkflowCrsDraft(cookie, workflow.id);
  if (completedWorkflow.crsDraft?.status !== "succeeded") {
    throw new Error(`Expected workflow CRS draft success, received ${completedWorkflow.crsDraft?.status}: ${completedWorkflow.crsDraft?.error || "unknown error"}`);
  }
  if (!completedWorkflow.crsDraft?.report?.executiveSummary || !Array.isArray(completedWorkflow.crsDraft.report.items) || !completedWorkflow.crsDraft.report.items.length) {
    throw new Error("Workflow CRS draft did not return executiveSummary or structured items");
  }

  const firstItem = completedWorkflow.crsDraft.report.items[0];
  const updateResult = assertStatus(
    await request("PATCH", `/api/workflows/${encodeURIComponent(workflow.id)}/crs-draft`, {
      cookie,
      body: {
        confirm: true,
        report: {
          ...completedWorkflow.crsDraft.report,
          executiveSummary: `${completedWorkflow.crsDraft.report.executiveSummary} 已完成 smoke 校验。`,
          items: [
            {
              ...firstItem,
              conclusion: `${firstItem.conclusion} 已由 smoke 用例确认。`,
            },
            ...completedWorkflow.crsDraft.report.items.slice(1),
          ],
        },
      },
    }),
    200,
    "confirm workflow crs draft",
  ).workflow;

  if (!updateResult?.crsDraft?.confirmedAt || !String(updateResult.crsDraft.report?.executiveSummary || "").includes("smoke 校验")) {
    throw new Error("Workflow CRS draft confirm response is missing confirmedAt or updated executiveSummary");
  }

  console.log("workflow CRS draft smoke passed: generate, persist, and confirm structured CRS draft");
}

async function runSystemAiSettings(cookie) {
  const accessBefore = assertStatus(await request("GET", "/api/access", { cookie }), 200, "access before AI settings");
  if (!accessBefore.aiConfiguration?.system) {
    throw new Error("Access payload is missing AI configuration");
  }
  if (!accessBefore.capabilities?.manageAiSettings) {
    throw new Error("Admin should be able to manage AI settings");
  }

  const invalid = await request("PATCH", "/api/system/ai-settings", {
    cookie,
    body: {
      enabled: true,
      endpoint: "",
      model: "smoke-crs",
    },
  });
  if (invalid.statusCode !== 400) {
    throw new Error(`Expected enabling AI without endpoint to fail with 400, received ${invalid.statusCode}`);
  }

  const untestedEnable = await request("PATCH", "/api/system/ai-settings", {
    cookie,
    body: {
      enabled: true,
      endpoint: "http://127.0.0.1:9/cde-crs-smoke",
      model: "smoke-crs",
      apiKey: "smoke-secret",
      timeoutMs: 3000,
      batchSize: 50,
    },
  });
  if (untestedEnable.statusCode !== 400 || !String(untestedEnable.json?.error || "").includes("调用测试")) {
    throw new Error(`Expected enabling AI before a passed test to fail with 400, received ${untestedEnable.statusCode}: ${untestedEnable.body}`);
  }

  const invalidShapeAi = await startMockAiEndpoint((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const invalidShapeTest = await request("POST", "/api/system/ai-settings/test", {
      cookie,
      body: {
        enabled: false,
        endpoint: invalidShapeAi.url,
        model: "smoke-crs",
        apiKey: "smoke-secret",
        timeoutMs: 3000,
        batchSize: 50,
      },
    });
    if (invalidShapeTest.statusCode !== 502 || !String(invalidShapeTest.json?.error || "").includes("响应格式")) {
      throw new Error(`Expected invalid AI test response shape to fail with 502, received ${invalidShapeTest.statusCode}: ${invalidShapeTest.body}`);
    }
  } finally {
    await invalidShapeAi.close();
  }

  let receivedTestPayload = null;
  const mockAi = await startMockAiEndpoint((req, res) => {
    if (req.method !== "POST" || req.url !== "/mock-ai") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      receivedTestPayload = JSON.parse(body || "{}");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        report: {
          executiveSummary: "mock ai ok",
          unresolvedSummary: "",
          manualCheckItems: [],
          items: [],
        },
      }));
    });
  });
  try {
    const testResult = assertStatus(
      await request("POST", "/api/system/ai-settings/test", {
        cookie,
        body: {
          enabled: false,
          endpoint: mockAi.url,
          model: "smoke-crs",
          apiKey: "smoke-secret",
          timeoutMs: 3000,
          batchSize: 50,
        },
      }),
      200,
      "test system AI settings",
    );
    if (!testResult.ok || testResult.status !== "success" || !testResult.latencyMs || !testResult.aiConfiguration?.system) {
      throw new Error(`AI test response missing success metadata: ${JSON.stringify(testResult)}`);
    }
    if (receivedTestPayload?.model !== "smoke-crs" || receivedTestPayload?.input?.task !== "ai_configuration_test") {
      throw new Error(`AI test endpoint did not receive expected payload: ${JSON.stringify(receivedTestPayload)}`);
    }
    if (testResult.aiConfiguration.system.enabled) {
      throw new Error("AI test should persist the passed test metadata without enabling AI");
    }
    const testedSettings = testResult.aiConfiguration.system;
    if (testedSettings.lastTestStatus !== "success" || !testedSettings.testPassed || !testedSettings.lastTestedAt) {
      throw new Error(`AI test did not return persisted passed-test state: ${JSON.stringify(testedSettings)}`);
    }

    const enabledAfterTest = assertStatus(
      await request("PATCH", "/api/system/ai-settings", {
        cookie,
        body: {
          enabled: true,
          endpoint: mockAi.url,
          model: "smoke-crs",
          apiKey: "smoke-secret",
          timeoutMs: 3000,
          batchSize: 50,
        },
      }),
      200,
      "enable system AI settings after passed test",
    );
    const enabledSettings = enabledAfterTest.access?.aiConfiguration?.system;
    if (!enabledSettings?.enabled || !enabledSettings.testPassed || enabledSettings.lastTestStatus !== "success") {
      throw new Error(`AI settings should enable only after a passed matching test: ${JSON.stringify(enabledSettings)}`);
    }
  } finally {
    await mockAi.close();
  }

  const staleEnable = await request("PATCH", "/api/system/ai-settings", {
    cookie,
    body: {
      enabled: true,
      endpoint: "http://127.0.0.1:9/cde-crs-smoke-changed",
      model: "smoke-crs",
      apiKey: "smoke-secret",
      timeoutMs: 3000,
      batchSize: 50,
    },
  });
  if (staleEnable.statusCode !== 400 || !String(staleEnable.json?.error || "").includes("重新执行调用测试")) {
    throw new Error(`Expected changed AI config to require a fresh test, received ${staleEnable.statusCode}: ${staleEnable.body}`);
  }

  const updated = assertStatus(
    await request("PATCH", "/api/system/ai-settings", {
      cookie,
      body: {
        enabled: false,
        endpoint: "http://127.0.0.1:9/cde-crs-smoke",
        model: "smoke-crs",
        apiKey: "smoke-secret",
        timeoutMs: 3000,
        batchSize: 50,
      },
    }),
    200,
    "save system AI settings",
  );
  const settings = updated.access?.aiConfiguration?.system;
  if (!settings || settings.enabled || settings.model !== "smoke-crs" || !settings.hasApiKey || settings.batchSize !== 50 || settings.testPassed) {
    throw new Error("AI settings were not persisted or sanitized as expected");
  }
  if (Object.prototype.hasOwnProperty.call(settings, "apiKey")) {
    throw new Error("AI settings response must not expose apiKey");
  }

  console.log("system AI settings smoke passed: save, sanitize, and validate CRS AI config");
}

async function runSystemApsSettings(cookie) {
  const accessBefore = assertStatus(await request("GET", "/api/access", { cookie }), 200, "access before APS settings");
  if (!accessBefore.apsConfiguration?.system) {
    throw new Error("Access payload is missing APS configuration");
  }
  if (!accessBefore.capabilities?.manageApsSettings) {
    throw new Error("Admin should be able to manage APS settings");
  }

  const invalid = await request("PATCH", "/api/system/aps-settings", {
    cookie,
    body: {
      enabled: true,
      clientId: "",
      clientSecret: "",
    },
  });
  if (invalid.statusCode !== 400) {
    throw new Error(`Expected enabling APS without credentials to fail with 400, received ${invalid.statusCode}`);
  }

  const updated = assertStatus(
    await request("PATCH", "/api/system/aps-settings", {
      cookie,
      body: {
        enabled: true,
        clientId: "aps-smoke-client",
        clientSecret: "aps-smoke-secret",
        bucketKey: "cde-aps-smoke-bucket",
        bucketPolicy: "persistent",
        bucketRegion: "US",
        viewerVersion: "7.*",
        viewerEnv: "AutodeskProduction2",
        viewerApi: "streamingV2",
      },
    }),
    200,
    "save APS settings",
  );
  const settings = updated.access?.apsConfiguration?.system;
  if (!settings || !settings.enabled || settings.status !== "configured" || !settings.hasClientSecret || settings.bucketKey !== "cde-aps-smoke-bucket") {
    throw new Error("APS settings were not persisted or sanitized as expected");
  }
  if (Object.prototype.hasOwnProperty.call(settings, "clientSecret")) {
    throw new Error("APS settings response must not expose clientSecret");
  }

  console.log("system APS settings smoke passed: save, sanitize, and validate Model Derivative config");
}

async function runAuditLogDateFilter(cookie) {
  const access = assertStatus(await request("GET", "/api/access", { cookie }), 200, "access before audit filter");
  if (!Array.isArray(access.auditLogs) || !access.auditLogs.length) {
    throw new Error("Audit filter smoke requires at least one audit log");
  }
  const firstDay = String(access.auditLogs[0].createdAt || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDay)) {
    throw new Error("Audit log createdAt is not date-filterable");
  }

  const matched = assertStatus(
    await request("GET", `/api/access?auditFrom=${encodeURIComponent(firstDay)}&auditTo=${encodeURIComponent(firstDay)}`, { cookie }),
    200,
    "access audit date filter match",
  );
  if (!matched.auditLogs?.length || matched.auditLogs.some((item) => !String(item.createdAt || "").startsWith(firstDay))) {
    throw new Error("Audit date filter did not return logs inside the requested day");
  }
  if (
    matched.auditLogFilter?.from !== firstDay ||
    matched.auditLogFilter?.to !== firstDay ||
    matched.auditLogFilter?.matchedCount < matched.auditLogs.length
  ) {
    throw new Error("Audit date filter metadata did not reflect the requested day range");
  }

  const empty = assertStatus(
    await request("GET", "/api/access?auditFrom=2099-01-01&auditTo=2099-01-02", { cookie }),
    200,
    "access audit date filter empty",
  );
  if (empty.auditLogs?.length) {
    throw new Error("Future audit date filter should return no logs");
  }
  if (empty.auditLogFilter?.matchedCount !== 0) {
    throw new Error("Future audit date filter should report zero matched logs");
  }

  console.log("audit date filter smoke passed: filtered audit logs by inclusive day range");
}

async function runDrawingSmartReview(cookie) {
  const document = await createSmokeDocument(cookie, "drawing-smart-review");
  const runPayload = assertStatus(
    await request("POST", "/api/drawing-apps/smart-review/run", {
      cookie,
      body: {
        documentIds: [document.id],
        checks: {
          rule: true,
          ai: true,
          visual: true,
        },
        gate: {
          blockOnError: true,
          requireWarningDisposition: true,
          requireAiDisposition: true,
          visualFindingsBlocking: false,
          manualIssueCreation: true,
        },
        actor: "管理员",
      },
    }),
    201,
    "drawing smart review run",
  );
  if (!Array.isArray(runPayload.tasks) || runPayload.tasks.length !== 1) {
    throw new Error("Drawing smart review did not create one task");
  }
  if (!Array.isArray(runPayload.results) || !runPayload.results.length) {
    throw new Error("Drawing smart review did not generate findings");
  }
  const task = runPayload.tasks[0];
  if (task.status !== "completed" || task.fileId !== document.id) {
    throw new Error(`Drawing smart review task has unexpected status or document: ${task.status}`);
  }
  if (!runPayload.summary || Number(runPayload.summary.total || 0) !== runPayload.results.length) {
    throw new Error("Drawing smart review summary does not match result count");
  }
  if (!runPayload.report || !Array.isArray(runPayload.report.sections) || !runPayload.report.sections.length) {
    throw new Error("Drawing smart review report is missing structured sections");
  }
  if (!task.report?.issueSummary || task.report.issueSummary.linkedCount !== 0 || task.report.issueSummary.reportOnlyCount !== runPayload.results.length) {
    throw new Error(`Drawing smart review task report should archive findings before manual Issue creation: ${JSON.stringify(task.report?.issueSummary)}`);
  }
  if (!runPayload.report?.issueSummary || runPayload.report.issueSummary.linkedCount !== 0 || runPayload.report.issueSummary.reportOnlyCount !== runPayload.results.length) {
    throw new Error(`Drawing smart review batch report should archive findings before manual Issue creation: ${JSON.stringify(runPayload.report?.issueSummary)}`);
  }
  if (runPayload.results.some((item) => item.annotationId || item.issueLink?.type === "pdf_annotation")) {
    throw new Error("Drawing smart review should not create PDF annotation Issues automatically");
  }
  const reportOnlyFinding = runPayload.results.find((item) => item.issueLink?.type === "precheck_report_item");
  if (!reportOnlyFinding) {
    throw new Error("Drawing smart review result should stay as a report item before manual Issue creation");
  }

  const docsAfter = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after drawing smart review");
  const updatedDocument = docsAfter.documents.find((item) => item.id === document.id);
  if (updatedDocument?.annotations?.some((item) => item.precheckResultId)) {
    throw new Error("Drawing smart review should not return pre-check annotations before manual Issue creation");
  }

  const issuePayload = assertStatus(
    await request("POST", `/api/drawing-apps/smart-review/results/${encodeURIComponent(reportOnlyFinding.id)}/issue`, {
      cookie,
      body: {
        actor: "管理员",
      },
    }),
    201,
    "drawing smart review manual issue creation",
  );
  const generatedIssue = issuePayload.result;
  if (!generatedIssue?.annotationId || generatedIssue.issueLink?.type !== "pdf_annotation" || generatedIssue.issueLink?.target !== "workflow_issue_board") {
    throw new Error(`Manual smart review Issue creation did not return a PDF annotation link: ${JSON.stringify(generatedIssue)}`);
  }
  if (!issuePayload.document?.annotations?.some((item) => item.id === generatedIssue.annotationId && item.precheckResultId === generatedIssue.id)) {
    throw new Error("Manual smart review Issue creation did not persist the PDF annotation");
  }

  const reportExport = assertStatus(
    await request("POST", `/api/drawing-apps/smart-review/tasks/${encodeURIComponent(task.id)}/export`, {
      cookie,
      body: {},
    }),
    200,
    "drawing smart review report export",
  );
  if (!reportExport.downloadUrl || !String(reportExport.downloadUrl).includes(".xlsx")) {
    throw new Error("Drawing smart review report export is missing an xlsx download URL");
  }
  const reportDownload = await request("GET", reportExport.downloadUrl, { cookie, binary: true });
  if (reportDownload.statusCode !== 200 || !Buffer.isBuffer(reportDownload.body) || !reportDownload.body.length) {
    throw new Error(`Expected drawing smart review report workbook download, received ${reportDownload.statusCode}`);
  }
  const reportRows = readWorkbookRows(reportDownload.body, "预审问题");
  if (!reportRows.some((row) => row["问题标题"] === reportOnlyFinding.title && row["文件名称"] === document.name)) {
    throw new Error("Drawing smart review report workbook is missing the pre-check finding row");
  }

  const updatedResult = assertStatus(
    await request("PATCH", `/api/drawing-apps/smart-review/results/${encodeURIComponent(generatedIssue.id)}`, {
      cookie,
      body: {
        status: "accepted",
        disposition: "设计人确认接受，后续版本修复",
        actor: "管理员",
      },
    }),
    200,
    "drawing smart review result disposition",
  );
  if (updatedResult.result?.status !== "accepted" || !updatedResult.result?.disposition) {
    throw new Error("Drawing smart review result disposition was not persisted");
  }

  const dwgCreated = await assertCreateDocumentStatus(cookie, 201, "drawing-smart-review-dwg", {
    name: `P-009-001_智能审查DWG_RevA-${Date.now()}.dwg`,
    mimeType: "application/acad",
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-009-001",
      drawingName: "智能审查DWG",
      discipline: "总图",
      revision: "Rev.A",
    },
  });
  const dwgRunPayload = assertStatus(
    await request("POST", "/api/drawing-apps/smart-review/run", {
      cookie,
      body: {
        documentIds: [dwgCreated.document.id],
        checks: { rule: true, ai: true, visual: true },
        gate: {
          blockOnError: true,
          requireWarningDisposition: true,
          requireAiDisposition: true,
          visualFindingsBlocking: false,
          manualIssueCreation: true,
        },
        actor: "管理员",
      },
    }),
    201,
    "drawing smart review dwg run",
  );
  const dwgFinding = dwgRunPayload.results.find((item) => item.issueLink?.type === "precheck_report_item");
  if (!dwgFinding) {
    throw new Error("DWG smart review should create report-only findings before manual Issue creation");
  }
  const dwgIssuePayload = assertStatus(
    await request("POST", `/api/drawing-apps/smart-review/results/${encodeURIComponent(dwgFinding.id)}/issue`, {
      cookie,
      body: { actor: "管理员" },
    }),
    201,
    "drawing smart review dwg manual issue creation",
  );
  if (
    !dwgIssuePayload.result?.annotationId ||
    dwgIssuePayload.result.issueLink?.type !== "aps_drawing_annotation" ||
    dwgIssuePayload.result.issueLink?.target !== "workflow_issue_board"
  ) {
    throw new Error(`DWG manual Issue creation should return an APS drawing annotation link: ${JSON.stringify(dwgIssuePayload.result)}`);
  }

  const listPayload = assertStatus(await request("GET", "/api/drawing-apps/smart-review", { cookie }), 200, "drawing smart review list");
  if (!Array.isArray(listPayload.tasks) || !listPayload.tasks.some((item) => item.id === task.id)) {
    throw new Error("Drawing smart review list did not include the created task");
  }

  console.log("drawing smart review smoke passed: guided run, manual Issue creation, report export, and dispositions");
}

async function runDrawingRedlineCompare(cookie) {
  const stamp = Date.now();
  const fixtureA = simplePdfFixtureData({
    revision: "Rev.A",
    pipe: "DN100 PN16 CS",
    includePump: false,
    includeValve: true,
    movedY: 600,
  });
  const fixtureB = simplePdfFixtureData({
    revision: "Rev.B",
    pipe: "DN150 PN16 CS",
    includePump: true,
    includeValve: false,
    movedY: 630,
  });
  const created = await assertCreateDocumentStatus(cookie, 201, "drawing-redline", {
    name: `P-010-001_红线对比测试_RevA-${stamp}.pdf`,
    mimeType: "application/pdf",
    size: fixtureA.size,
    dataBase64: fixtureA.dataBase64,
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-010-001",
      drawingName: "红线对比测试",
      discipline: "工艺",
      revision: "Rev.A",
    },
  });
  const documentId = created.document.id;
  const updated = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(documentId)}/version`, {
      cookie,
      body: {
        name: `P-010-001_红线对比测试_RevB-${stamp}.pdf`,
        mimeType: "application/pdf",
        size: fixtureB.size,
        dataBase64: fixtureB.dataBase64,
        actor: "管理员",
        note: "DN100 调整为 DN150；新增 P-101；删除 V-003。",
        drawingMetadata: {
          markedAsDrawing: true,
          drawingNumber: "P-010-001",
          drawingName: "红线对比测试",
          discipline: "工艺",
          revision: "Rev.B",
        },
      },
    }),
    200,
    "append redline version",
  );
  const versions = [...(updated.document.versionHistory || [])].filter((item) => !item.deletedAt);
  const versionA = versions.find((item) => !item.isCurrent) || versions[0];
  const versionB = versions.find((item) => item.isCurrent) || versions[versions.length - 1];
  if (!versionA?.id || !versionB?.id || versionA.id === versionB.id) {
    throw new Error(`Redline test expected two versions, received ${JSON.stringify(versions)}`);
  }

  const home = assertStatus(await request("GET", "/api/drawing-apps/redline", { cookie }), 200, "drawing redline home");
  if (!home.documents?.some((item) => item.id === documentId && item.versionHistory?.length >= 2)) {
    throw new Error("Drawing redline home did not include the two-version PDF drawing");
  }

  const runPayload = assertStatus(
    await request("POST", "/api/drawing-apps/redline/run", {
      cookie,
      body: {
        documentId,
        versionAId: versionA.id,
        versionBId: versionB.id,
        options: {
          minPixelArea: 50,
          opacity: 72,
          includeTypes: ["added", "deleted", "modified", "moved"],
        },
      },
    }),
    202,
    "drawing redline run",
  );
  if (!runPayload.task?.id || runPayload.task.documentId !== documentId) {
    throw new Error(`Drawing redline run did not return a task: ${JSON.stringify(runPayload)}`);
  }

  let detail = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    detail = assertStatus(
      await request("GET", `/api/drawing-apps/redline/tasks/${encodeURIComponent(runPayload.task.id)}`, { cookie }),
      200,
      "drawing redline task detail",
    );
    if (detail.task?.status === "completed") {
      break;
    }
    await delay(150);
  }
  if (detail?.task?.status !== "completed") {
    throw new Error(`Drawing redline task did not complete: ${JSON.stringify(detail?.task)}`);
  }
  if (!Array.isArray(detail.records) || detail.records.length < 4) {
    throw new Error(`Drawing redline task did not generate diff records: ${JSON.stringify(detail.records)}`);
  }
  const diffTypes = new Set(detail.records.map((item) => item.diffType));
  ["added", "deleted", "modified", "moved"].forEach((type) => {
    if (!diffTypes.has(type)) {
      throw new Error(`Drawing redline records are missing ${type}: ${JSON.stringify([...diffTypes])}`);
    }
  });
  if (!detail.aiResult?.summary || !detail.titleBlockChanges?.length || !detail.report?.sections?.length) {
    throw new Error("Drawing redline detail is missing AI summary, title block changes, or report sections");
  }

  const issueRecord = detail.records.find((item) => !item.issueId);
  const issuePayload = assertStatus(
    await request("POST", `/api/drawing-apps/redline/diffs/${encodeURIComponent(issueRecord.id)}/issue`, {
      cookie,
      body: {
        title: "红线差异复核",
        responsible: "工艺负责人",
        dueDate: "2026-05-01",
        note: "请确认管径变化是否已同步规格书。",
      },
    }),
    201,
    "drawing redline issue create",
  );
  if (!issuePayload.record?.issueId || issuePayload.record.issueStatus !== "open" || !issuePayload.issue?.redlineDiffId) {
    throw new Error(`Drawing redline Issue was not linked to the diff record: ${JSON.stringify(issuePayload)}`);
  }

  const exportPayload = assertStatus(
    await request("POST", `/api/drawing-apps/redline/tasks/${encodeURIComponent(runPayload.task.id)}/export`, {
      cookie,
      body: {},
    }),
    200,
    "drawing redline report export",
  );
  if (!exportPayload.downloadUrl || !String(exportPayload.downloadUrl).includes(".pdf")) {
    throw new Error("Drawing redline report export is missing a PDF download URL");
  }
  const reportDownload = await request("GET", exportPayload.downloadUrl, { cookie, binary: true });
  if (reportDownload.statusCode !== 200 || !Buffer.isBuffer(reportDownload.body) || !reportDownload.body.length) {
    throw new Error(`Expected drawing redline report PDF download, received ${reportDownload.statusCode}`);
  }

  console.log("drawing redline smoke passed: version pair task, diff records, manual Issue, and PDF report export");
}

async function runDrawingOcrSearch(cookie) {
  const stamp = Date.now();
  const fixture = simplePdfFixtureData({
    revision: "Rev.A",
    pipe: "P-001A DN150 High Pressure Pump",
    includePump: false,
    includeValve: false,
    movedY: 600,
  });
  const created = await assertCreateDocumentStatus(cookie, 201, "drawing-ocr-search", {
    name: `P-011-001_OCR全文检索测试_RevA-${stamp}.pdf`,
    mimeType: "application/pdf",
    size: fixture.size,
    dataBase64: fixture.dataBase64,
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-011-001",
      drawingName: "OCR全文检索测试",
      discipline: "工艺",
      revision: "Rev.A",
    },
  });
  const documentId = created.document.id;

  let home = null;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    home = assertStatus(await request("GET", "/api/drawing-apps/ocr-search", { cookie }), 200, "drawing ocr search home");
    const task = home.tasks?.find((item) => item.documentId === documentId);
    if (["completed", "quality_warning"].includes(task?.status)) {
      break;
    }
    await delay(150);
  }

  const indexedTask = home?.tasks?.find((item) => item.documentId === documentId);
  if (!indexedTask || !["completed", "quality_warning"].includes(indexedTask.status) || Number(indexedTask.blockCount || 0) < 3) {
    throw new Error(`Drawing OCR task did not complete and index native PDF words: ${JSON.stringify(indexedTask)}`);
  }
  if (!home.documents?.some((item) => item.id === documentId && item.ocrTask?.id === indexedTask.id)) {
    throw new Error("Drawing OCR home did not expose the indexed drawing document");
  }

  const queryPayload = assertStatus(
    await request("POST", "/api/drawing-apps/ocr-search/query", {
      cookie,
      body: {
        query: "P-001A AND DN150",
        mode: "exact",
        filters: {
          versionScope: "current",
          zoneType: "all",
          qualityMin: 70,
        },
      },
    }),
    200,
    "drawing ocr search query",
  );
  const result = queryPayload.results?.find((item) => item.documentId === documentId);
  if (!result || Number(result.matchCount || 0) < 2 || !result.matches?.some((item) => item.text.includes("P-001A"))) {
    throw new Error(`Drawing OCR search did not return highlighted matches for P-001A and DN150: ${JSON.stringify(queryPayload.results)}`);
  }
  const match = result.matches.find((item) => item.text.includes("P-001A")) || result.matches[0];
  if (!match?.id || !match.bbox || match.page !== 1 || !String(match.context || "").includes("P-001A")) {
    throw new Error(`Drawing OCR match is missing page, bbox, context, or stable id: ${JSON.stringify(match)}`);
  }

  const semanticPayload = assertStatus(
    await request("POST", "/api/drawing-apps/ocr-search/query", {
      cookie,
      body: {
        query: "高压泵相关图纸",
        mode: "semantic",
        filters: {
          versionScope: "current",
          qualityMin: 50,
        },
      },
    }),
    200,
    "drawing ocr semantic search",
  );
  if (!semanticPayload.results?.some((item) => item.documentId === documentId)) {
    throw new Error(`Drawing OCR semantic search did not include the high pressure pump drawing: ${JSON.stringify(semanticPayload.results)}`);
  }

  const issuePayload = assertStatus(
    await request("POST", `/api/drawing-apps/ocr-search/results/${encodeURIComponent(match.id)}/issue`, {
      cookie,
      body: {
        title: "OCR 检索结果复核",
        note: "请确认 P-001A 与 DN150 标注是否与规格书一致。",
      },
    }),
    201,
    "drawing ocr search issue create",
  );
  if (!issuePayload.issue?.id || issuePayload.issue.source !== "drawing_ocr_search" || !issuePayload.document?.annotations?.some((item) => item.id === issuePayload.issue.id)) {
    throw new Error(`Drawing OCR search result was not linked to a PDF annotation Issue: ${JSON.stringify(issuePayload)}`);
  }

  console.log("drawing ocr search smoke passed: auto indexing, exact/semantic search, PDF location, and Issue creation");
}

async function runDrawingSmartReviewWorkflowGate(cookie, templateId) {
  const created = await assertCreateDocumentStatus(cookie, 201, "drawing-precheck-gate", {
    name: `P-002-001_智能审查门控_RevA-${Date.now()}.pdf`,
    drawingMetadata: {
      markedAsDrawing: true,
      drawingNumber: "P-002-001",
      drawingName: "智能审查门控",
      discipline: "总图",
      revision: "Rev.A",
    },
  });
  const document = created.document;
  const listBefore = assertStatus(await request("GET", "/api/drawing-apps/smart-review", { cookie }), 200, "drawing gate list before precheck");
  const candidateBefore = listBefore.documents.find((item) => item.id === document.id);
  if (candidateBefore?.precheckGate?.status !== "not_run") {
    throw new Error(`Expected marked drawing to require pre-check before workflow launch, received ${JSON.stringify(candidateBefore?.precheckGate)}`);
  }

  const blockedBeforeRun = await request("POST", "/api/workflows", {
    cookie,
    body: {
      workflowName: `Smoke drawing gate before run ${Date.now()}`,
      templateId,
      fileIds: [document.id],
      actor: "管理员",
    },
  });
  if (blockedBeforeRun.statusCode !== 409 || !String(blockedBeforeRun.json?.error || "").includes("图纸智能审查")) {
    throw new Error(`Expected drawing workflow launch to be blocked before pre-check, received ${blockedBeforeRun.statusCode}: ${blockedBeforeRun.body}`);
  }

  const runPayload = assertStatus(
    await request("POST", "/api/drawing-apps/smart-review/run", {
      cookie,
      body: {
        documentIds: [document.id],
        checks: {
          rule: true,
          ai: true,
          visual: true,
        },
        gate: {
          blockOnError: true,
          requireWarningDisposition: true,
          requireAiDisposition: true,
          visualFindingsBlocking: false,
          manualIssueCreation: true,
        },
        actor: "管理员",
      },
    }),
    201,
    "drawing smart review gate run",
  );
  if (runPayload.tasks?.[0]?.gateStatus?.status !== "blocked") {
    throw new Error(`Expected pre-check gate to be blocked by open findings, received ${JSON.stringify(runPayload.tasks?.[0]?.gateStatus)}`);
  }
  if (!runPayload.report?.gate || runPayload.report.gate.status !== "blocked") {
    throw new Error(`Expected batch pre-check report to include blocked gate status, received ${JSON.stringify(runPayload.report?.gate)}`);
  }

  const blockedAfterRun = await request("POST", "/api/workflows", {
    cookie,
    body: {
      workflowName: `Smoke drawing gate after run ${Date.now()}`,
      templateId,
      fileIds: [document.id],
      actor: "管理员",
    },
  });
  if (blockedAfterRun.statusCode !== 409 || !String(blockedAfterRun.json?.error || "").includes("预审问题")) {
    throw new Error(`Expected drawing workflow launch to be blocked by open findings, received ${blockedAfterRun.statusCode}: ${blockedAfterRun.body}`);
  }

  const blockingResults = runPayload.results.filter((item) =>
    item.status === "open" &&
    (
      item.level === "error" ||
      item.level === "warning" ||
      item.checkType === "ai" ||
      item.checkType === "visual"
    ),
  );
  if (!blockingResults.length) {
    throw new Error("Drawing smart review gate test did not generate any blocking findings");
  }
  for (const result of blockingResults) {
    assertStatus(
      await request("PATCH", `/api/drawing-apps/smart-review/results/${encodeURIComponent(result.id)}`, {
        cookie,
        body: {
          status: "accepted",
          disposition: "门控 smoke 已确认",
          actor: "管理员",
        },
      }),
      200,
      "accept drawing gate finding",
    );
  }

  const listAfter = assertStatus(await request("GET", "/api/drawing-apps/smart-review", { cookie }), 200, "drawing gate list after disposition");
  const candidateAfter = listAfter.documents.find((item) => item.id === document.id);
  if (candidateAfter?.precheckGate?.status !== "ready") {
    throw new Error(`Expected marked drawing gate to be ready after dispositions, received ${JSON.stringify(candidateAfter?.precheckGate)}`);
  }

  const workflow = await createSmokeWorkflow(cookie, templateId, document, "drawing-gate");
  if (workflow.fileRefs?.[0]?.docId !== document.id) {
    throw new Error("Drawing workflow gate allowed workflow but response references the wrong document");
  }

  console.log("drawing smart review gate smoke passed: workflow launch is blocked until pre-check findings are dispositioned");
}

async function runProjectSwitchIsolation(cookie, defaultDocumentId) {
  const defaultWorkspace = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "default project workspace before switch");
  const access = assertStatus(await request("GET", "/api/access", { cookie }), 200, "admin access before project switch");
  const defaultProject = access.projects.find((item) => item.isCurrent);
  const alternateProject = access.projects.find((item) => !item.isCurrent);
  if (!defaultProject?.id || !alternateProject?.id) {
    throw new Error("Project switch smoke test requires at least two accessible projects");
  }
  const defaultReceivedFolder = defaultWorkspace.folders.find((folder) => !folder.parentId && folder.name === "00 RECEIVED") || defaultWorkspace.folders[0];
  if (!defaultReceivedFolder?.id) {
    throw new Error("Default project is missing a folder for stale folder creation regression");
  }

  const switched = assertStatus(
    await request("POST", "/api/session/project", {
      cookie,
      body: { projectId: alternateProject.id },
    }),
    200,
    "switch to alternate project",
  );
  if (switched.access?.project?.id !== alternateProject.id) {
    throw new Error(`Expected active project ${alternateProject.id}, received ${switched.access?.project?.id}`);
  }
  if (switched.documents.some((item) => item.id === defaultDocumentId)) {
    throw new Error("Default project document leaked into alternate project after switch");
  }
  if (!Array.isArray(switched.folders) || !switched.folders.length || !Array.isArray(switched.workflowTemplates) || !switched.workflowTemplates.length) {
    throw new Error("Alternate project did not return seeded folders and workflow templates");
  }
  const defaultFolderPath = folderPathNames(defaultWorkspace.folders, defaultReceivedFolder.id);
  const equivalentAlternateFolder = folderByPathNames(switched.folders, defaultFolderPath);
  if (!equivalentAlternateFolder?.id) {
    throw new Error(`Alternate project is missing equivalent folder path: ${defaultFolderPath.join("/")}`);
  }

  const staleFolderCreate = assertStatus(
    await request("POST", "/api/folders", {
      cookie,
      body: {
        name: `stale-parent-recovery-${Date.now()}`,
        parentId: defaultReceivedFolder.id,
      },
    }),
    201,
    "create folder after project switch with stale parent id",
  ).folder;
  if (staleFolderCreate.projectId !== alternateProject.id || staleFolderCreate.parentId !== equivalentAlternateFolder.id) {
    throw new Error(`Stale parent folder was not remapped to active project: ${JSON.stringify(staleFolderCreate)}`);
  }

  const alternateDocument = await createSmokeDocument(cookie, "project-alt");
  if (alternateDocument.projectId !== alternateProject.id) {
    throw new Error(`Expected alternate document project ${alternateProject.id}, received ${alternateDocument.projectId}`);
  }

  const alternateDocs = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "alternate project documents");
  if (!alternateDocs.documents.some((item) => item.id === alternateDocument.id)) {
    throw new Error("Alternate project document is missing from alternate project list");
  }
  if (alternateDocs.documents.some((item) => item.id === defaultDocumentId)) {
    throw new Error("Default project document leaked into alternate project document list");
  }

  const switchedBack = assertStatus(
    await request("POST", "/api/session/project", {
      cookie,
      body: { projectId: defaultProject.id },
    }),
    200,
    "switch back to default project",
  );
  if (switchedBack.access?.project?.id !== defaultProject.id) {
    throw new Error(`Expected active project ${defaultProject.id}, received ${switchedBack.access?.project?.id}`);
  }
  if (!switchedBack.documents.some((item) => item.id === defaultDocumentId)) {
    throw new Error("Default project document missing after switching back");
  }
  if (switchedBack.documents.some((item) => item.id === alternateDocument.id)) {
    throw new Error("Alternate project document leaked after switching back to default project");
  }

  console.log("project switch smoke passed: project-scoped documents/folders/templates");
}

async function runAnnotationCollaboration(cookie) {
  const document = await createSmokeDocument(cookie, "annotation");

  const createAnnotation = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations`, {
      cookie,
      body: {
        type: "mark",
        variant: "issue",
        page: 1,
        x: 0.2,
        y: 0.25,
        width: 0.18,
        height: 0.12,
        title: "Smoke 批注",
        note: "请复核此处尺寸",
        actor: "管理员",
        attachments: [
          {
            kind: "link",
            name: "参考链接",
            url: "https://example.com/reference",
          },
        ],
      },
    }),
    201,
    "create annotation",
  );
  const annotation = createAnnotation.annotation;
  if (!annotation?.id || annotation.status !== "open" || annotation.attachments?.length !== 1) {
    throw new Error("Annotation creation response is missing expected fields");
  }

  const createReply = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations/${encodeURIComponent(annotation.id)}/replies`, {
      cookie,
      body: {
        actor: "管理员",
        content: "已补充现场照片和说明",
        attachments: [
          {
            kind: "image",
            name: "现场照片.png",
            mimeType: "image/png",
            dataBase64: Buffer.from("smoke image fixture", "utf8").toString("base64"),
          },
        ],
      },
    }),
    201,
    "create annotation reply",
  );
  const reply = createReply.reply;
  if (!reply?.id || reply.attachments?.length !== 1) {
    throw new Error("Reply creation response is missing expected attachment");
  }

  const resolved = assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(document.id)}/annotations/${encodeURIComponent(annotation.id)}`, {
      cookie,
      body: {
        actor: "管理员",
        status: "resolved",
      },
    }),
    200,
    "resolve annotation",
  );
  if (resolved.annotation?.status !== "resolved" || resolved.annotation?.resolved !== true) {
    throw new Error(`Expected resolved annotation, received ${resolved.annotation?.status}`);
  }

  const deleteReply = assertStatus(
    await request("DELETE", `/api/documents/${encodeURIComponent(document.id)}/annotations/${encodeURIComponent(annotation.id)}/replies/${encodeURIComponent(reply.id)}`, {
      cookie,
      body: { actor: "管理员" },
    }),
    200,
    "delete annotation reply",
  );
  if (!deleteReply.ok || deleteReply.annotation?.replies?.some((item) => item.id === reply.id)) {
    throw new Error("Deleted reply is still present on annotation");
  }

  console.log("annotation smoke passed: create/reply/resolve/delete reply");
}

async function runPermissionMatrix(adminCookie, adminFolders, templateId) {
  const wipFolder = folderByPolicy(adminFolders, "wip");
  const publishFolder = folderByPolicy(adminFolders, "publish");
  const receivedOwnerFolder = folderByPolicy(adminFolders, "received_owner");

  const editor = await loginAs("editor@cde.local", "editor");
  const editorDocs = assertStatus(await request("GET", "/api/documents", { cookie: editor.cookie }), 200, "editor documents list");
  const editorPublish = folderByPolicy(editorDocs.folders, "publish");
  if (editorPublish.permissions.upload || editorPublish.permissions.fileLevel !== "viewer") {
    throw new Error("Editor should only have viewer access in publish folder");
  }
  await assertCreateDocumentStatus(editor.cookie, 201, "editor-wip", { parentId: wipFolder.id });
  await assertCreateDocumentStatus(editor.cookie, 403, "editor-publish", { parentId: publishFolder.id });

  const reviewer = await loginAs("reviewer@cde.local", "reviewer");
  const reviewerDocs = assertStatus(await request("GET", "/api/documents", { cookie: reviewer.cookie }), 200, "reviewer documents list");
  const reviewerPublish = folderByPolicy(reviewerDocs.folders, "publish");
  if (reviewerPublish.permissions.upload || reviewerPublish.permissions.fileLevel !== "viewer") {
    throw new Error("Reviewer should only have viewer access in publish folder");
  }
  const reviewerDocument = (await assertCreateDocumentStatus(reviewer.cookie, 201, "reviewer-wip", { parentId: wipFolder.id })).document;
  const reviewerWorkflow = await createSmokeWorkflow(reviewer.cookie, templateId, reviewerDocument, "reviewer-start");
  if (reviewerWorkflow.status !== "running") {
    throw new Error(`Reviewer workflow should be running, received ${reviewerWorkflow.status}`);
  }
  await runWorkflowAction(reviewer.cookie, reviewerWorkflow.id, "withdrawFlow", "reviewer-withdraw");
  await assertCreateDocumentStatus(reviewer.cookie, 403, "reviewer-publish", { parentId: publishFolder.id });

  const guest = await loginAs("guest@cde.local", "guest");
  const guestDocs = assertStatus(await request("GET", "/api/documents", { cookie: guest.cookie }), 200, "guest documents list");
  if (guestDocs.folders.some((folder) => folder.id === receivedOwnerFolder.id)) {
    throw new Error("Guest should not see received_owner folder with explicit none permission");
  }
  await assertCreateDocumentStatus(guest.cookie, 403, "guest-wip", { parentId: wipFolder.id });

  console.log("permission smoke passed: editor/reviewer/guest folder and workflow boundaries");
}

async function runNotificationCenter(cookie, templateId) {
  const document = await createSmokeDocument(cookie, "notification");
  const workflow = await createSmokeWorkflow(cookie, templateId, document, "notification");
  const docsAfterCreate = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents with notification center");
  const center = docsAfterCreate.notificationCenter;
  if (!center || !Array.isArray(center.todos) || !Array.isArray(center.notifications)) {
    throw new Error("Documents payload is missing notificationCenter.todos or notificationCenter.notifications");
  }
  if (center.todoCount < 1 || !center.todos.some((item) => item.workflowId === workflow.id)) {
    throw new Error("Notification center did not expose the current actionable workflow todo");
  }

  const workflowNotification = center.notifications.find((item) => item.workflowId === workflow.id);
  if (!workflowNotification?.key) {
    throw new Error("Notification center did not expose the workflow activity feed item");
  }

  const unreadBefore = Number(center.unreadCount || 0);
  const readResult = assertStatus(
    await request("POST", "/api/notifications/read", {
      cookie,
      body: {
        keys: [workflowNotification.key],
      },
    }),
    200,
    "mark notification read",
  );
  const nextCenter = readResult.notificationCenter;
  if (!nextCenter || Number(nextCenter.unreadCount || 0) >= unreadBefore) {
    throw new Error("Notification read API did not reduce unreadCount");
  }
  if (!nextCenter.notifications.some((item) => item.key === workflowNotification.key && item.read)) {
    throw new Error("Notification read API did not persist read state for the selected notification");
  }

  console.log("notification smoke passed: todo feed and read state are real");
}

async function runApiScenario() {
  const loginResponse = await request("POST", "/api/session/login", {
    body: {
      email: "admin@cde.local",
      password: BOOTSTRAP_PASSWORD,
    },
  });
  const login = assertStatus(loginResponse, 200, "login");
  if (!login.authenticated || login.currentUser?.email !== "admin@cde.local") {
    throw new Error("Login response did not return the expected admin user");
  }
  const cookie = sessionCookie(loginResponse);

  const docsBefore = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents list");
  if (!Array.isArray(docsBefore.documents) || !Array.isArray(docsBefore.workflowTemplates)) {
    throw new Error("Documents list response is missing documents or workflowTemplates arrays");
  }
  if (docsBefore.access?.project?.id !== "project-cde-demo") {
    throw new Error(`Expected new admin session to default to project-cde-demo, received ${docsBefore.access?.project?.id}`);
  }
  const template =
    docsBefore.workflowTemplates.find((item) => item.autoExport?.enabled === false && Array.isArray(item.steps) && item.steps.length) ||
    docsBefore.workflowTemplates.find((item) => Array.isArray(item.steps) && item.steps.length);
  if (!template) {
    throw new Error("No seeded workflow template is available for smoke test");
  }

  await runNotificationCenter(cookie, template.id);
  await runSystemApsSettings(cookie);
  await runSystemAiSettings(cookie);
  await runAuditLogDateFilter(cookie);
  await runDrawingMetadataUpload(cookie);
  await runDrawingRegister(cookie);
  await runDrawingRedlineCompare(cookie);
  await runDrawingOcrSearch(cookie);
  await runDrawingSmartReview(cookie);
  await runDrawingSmartReviewWorkflowGate(cookie, template.id);

  const withdrawDocument = await createSmokeDocument(cookie, "withdraw");
  const withdrawWorkflow = await createSmokeWorkflow(cookie, template.id, withdrawDocument, "withdraw");
  const withdrawnWorkflow = await runWorkflowAction(cookie, withdrawWorkflow.id, "withdrawFlow", "withdraw");
  if (withdrawnWorkflow.status !== "withdrawn") {
    throw new Error(`Expected withdrawn workflow status, received ${withdrawnWorkflow.status}`);
  }

  const approveDocument = await createSmokeDocument(cookie, "approve");
  const approveWorkflow = await createSmokeWorkflow(cookie, template.id, approveDocument, "approve");
  const approvedWorkflow = await approveWorkflowToEnd(cookie, approveWorkflow);
  if (approvedWorkflow.fileRefs?.[0]?.docId !== approveDocument.id) {
    throw new Error("Approved workflow no longer references the expected document");
  }

  const rejectDocument = await createSmokeDocument(cookie, "reject");
  const rejectWorkflow = await createSmokeWorkflow(cookie, template.id, rejectDocument, "reject");
  const rejectedWorkflow = await runWorkflowAction(cookie, rejectWorkflow.id, "rejectFlow", "reject");
  if (rejectedWorkflow.status !== "rejected") {
    throw new Error(`Expected rejected workflow status, received ${rejectedWorkflow.status}`);
  }

  await runPermissionMatrix(cookie, docsBefore.folders, template.id);
  await runAnnotationCollaboration(cookie);
  await runProjectSwitchIsolation(cookie, withdrawDocument.id);
  await runReviewExport(cookie);
  await runCommentReportExport(cookie, template.id);
  await runWorkflowCrsDraft(cookie, template.id);
  await runOnlyOfficeCallback(cookie);
  await runOnlyOfficeCallbackAcrossProjects(cookie);
  await runApsState(cookie);
  await runWorkflowReportAutoExport(cookie, docsBefore.workflowTemplates);

  const docsAfter = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents list after workflow");
  const expectedDocumentIds = new Set([withdrawDocument.id, approveDocument.id, rejectDocument.id]);
  const returnedDocumentIds = new Set(docsAfter.documents.map((item) => item.id));
  for (const documentId of expectedDocumentIds) {
    if (!returnedDocumentIds.has(documentId)) {
      throw new Error(`Created document ${documentId} was not present in the final documents list`);
    }
  }

  console.log(`api smoke passed: login, document create, workflow withdraw/approve/reject on ${BASE_URL}`);
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-smoke-"));
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
      ONLYOFFICE_SERVER_URL: "http://127.0.0.1:9/onlyoffice",
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
    await runApiScenario();
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
