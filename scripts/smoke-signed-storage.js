const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(29080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 8000;
const BOOTSTRAP_PASSWORD = "cde@123456";

function pdfFixtureData() {
  const pdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwgL0xlbmd0aCAzID4+CnN0cmVhbQpCBQplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAzIDAgUiAvUmVzb3VyY2VzIDw8ID4+IC9Db250ZW50cyAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXQo+PgplbmRvYmoKMyAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzQgMCBSIF0gL0NvdW50IDEgPj4KZW5kb2JqCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDMgMCBSID4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyMzMgMDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMTc0IDAwMDAwIG4gCjAwMDAwMDAwNjcgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgoyODIKJSVFT0YK";
  return { dataBase64: pdfBase64, size: Buffer.from(pdfBase64, "base64").length };
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function request(method, pathname, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(`${BASE_URL}${pathname}`, {
      method,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    }, (res) => {
      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { responseBody += chunk; });
      res.on("end", () => {
        let json = null;
        if (responseBody) { try { json = JSON.parse(responseBody); } catch { json = null; } }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: responseBody, json });
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${method} ${pathname}`)));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForServer(child) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited early with code ${child.exitCode}`);
    try {
      const response = await request("GET", "/healthz");
      if (response.statusCode === 200) return;
    } catch (error) { lastError = error; }
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${BASE_URL}/healthz: ${lastError?.message || "no response"}`);
}

function assertStatus(response, expected, label) {
  if (response.statusCode !== expected) throw new Error(`${label} expected ${expected}, received ${response.statusCode}: ${response.body}`);
  return response.json;
}

function sessionCookie(response) {
  const cookies = response.headers["set-cookie"] || [];
  const session = cookies.find((item) => item.startsWith("cde_session="));
  if (!session) throw new Error("Login response did not set cde_session cookie");
  return session.split(";")[0];
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  const timeout = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 2000);
  try { await once(child, "exit"); } finally { clearTimeout(timeout); }
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-signed-storage-"));
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
      ONLYOFFICE_SERVER_URL: `${BASE_URL}/onlyoffice-docs`,
      ONLYOFFICE_PUBLIC_BASE_URL: BASE_URL,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(child);
    const cookie = sessionCookie(await request("POST", "/api/session/login", { body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD } }));
    const fixture = pdfFixtureData();
    const document = assertStatus(await request("POST", "/api/documents", { cookie, body: { name: `signed-storage-${Date.now()}.pdf`, mimeType: "application/pdf", size: fixture.size, dataBase64: fixture.dataBase64, actor: "管理员", conflictMode: "rename" } }), 201, "create signed storage document").document;
    if (!/\/uploads\/[^?]+\?expires=\d+&signature=[a-f0-9]+/.test(document.fileUrl || "")) throw new Error(`Upload URL is not signed: ${document.fileUrl}`);
    assertStatus(await request("GET", document.fileUrl.split("?")[0], { cookie }), 403, "unsigned upload download");
    const signedUpload = await request("GET", document.fileUrl, { cookie });
    if (signedUpload.statusCode !== 200 || !signedUpload.body.startsWith("%PDF")) throw new Error(`Signed upload failed: ${signedUpload.statusCode}`);
    const signedUploadWithoutSession = await request("GET", document.fileUrl);
    if (signedUploadWithoutSession.statusCode === 200) throw new Error("Normal signed upload URLs must still require an authenticated CDE session");

    const officeContent = Buffer.from("name,value\npump,1\n", "utf8");
    const officeDocument = assertStatus(await request("POST", "/api/documents", {
      cookie,
      body: {
        name: `onlyoffice-source-${Date.now()}.csv`,
        mimeType: "text/csv",
        size: officeContent.length,
        dataBase64: officeContent.toString("base64"),
        actor: "管理员",
        conflictMode: "rename",
      },
    }), 201, "create onlyoffice source document").document;
    const onlyOfficeConfig = assertStatus(await request("GET", `/api/onlyoffice/documents/${encodeURIComponent(officeDocument.id)}/config?mode=view&actor=${encodeURIComponent("管理员")}`, { cookie }), 200, "onlyoffice config").config;
    const onlyOfficeDocumentUrl = new URL(onlyOfficeConfig.document?.url || "");
    if (onlyOfficeDocumentUrl.searchParams.get("onlyoffice") !== "1" || !onlyOfficeDocumentUrl.searchParams.get("signature")) {
      throw new Error(`OnlyOffice document URL is not using a dedicated signed source URL: ${onlyOfficeConfig.document?.url}`);
    }
    const onlyOfficeSource = await request("GET", `${onlyOfficeDocumentUrl.pathname}${onlyOfficeDocumentUrl.search}`);
    if (onlyOfficeSource.statusCode !== 200 || onlyOfficeSource.body !== officeContent.toString("utf8")) {
      throw new Error(`OnlyOffice document source URL must be fetchable without a browser session, received ${onlyOfficeSource.statusCode}: ${String(onlyOfficeSource.body).slice(0, 80)}`);
    }

    const annotation = assertStatus(await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations`, { cookie, body: { type: "mark", page: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.2, title: "附件签名", note: "验证附件签名", actor: "管理员" } }), 201, "create signed storage annotation").annotation;
    const reply = assertStatus(await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations/${encodeURIComponent(annotation.id)}/replies`, { cookie, body: { actor: "管理员", content: "附件", attachments: [{ kind: "image", name: "photo.png", mimeType: "image/png", dataBase64: Buffer.from("signed attachment fixture", "utf8").toString("base64") }] } }), 201, "create signed attachment reply").reply;
    const attachmentUrl = reply.attachments?.[0]?.url || "";
    if (!/\/attachments\/[^?]+\?expires=\d+&signature=[a-f0-9]+/.test(attachmentUrl)) throw new Error(`Attachment URL is not signed: ${attachmentUrl}`);
    assertStatus(await request("GET", attachmentUrl.split("?")[0], { cookie }), 403, "unsigned attachment download");
    const signedAttachment = await request("GET", attachmentUrl, { cookie });
    if (signedAttachment.statusCode !== 200 || !signedAttachment.body.includes("signed attachment fixture")) throw new Error(`Signed attachment failed: ${signedAttachment.statusCode}`);

    console.log(`signed storage smoke passed: uploads and attachments require signed URLs on ${BASE_URL}`);
  } catch (error) {
    if (output.trim()) console.error(output.trim());
    throw error;
  } finally {
    await stopServer(child);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
