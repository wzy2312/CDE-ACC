const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(29180 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 8000;
const BOOTSTRAP_PASSWORD = "cde@123456";

function pdfFixtureData() {
  const pdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwgL0xlbmd0aCAzID4+CnN0cmVhbQpCBQplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAzIDAgUiAvUmVzb3VyY2VzIDw8ID4+IC9Db250ZW50cyAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXQo+PgplbmRvYmoKMyAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzQgMCBSIF0gL0NvdW50IDEgPj4KZW5kb2JqCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDMgMCBSID4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyMzMgMDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMTc0IDAwMDAwIG4gCjAwMDAwMDAwNjcgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgoyODIKJSVFT0YK";
  return { dataBase64: pdfBase64, size: Buffer.from(pdfBase64, "base64").length };
}

function textFixtureData(text = "share browse contract") {
  const dataBase64 = Buffer.from(text, "utf8").toString("base64");
  return { dataBase64, size: Buffer.from(dataBase64, "base64").length };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, pathname, { body, cookie, binary = false } = {}) {
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
    });
    req.on("timeout", () => req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${method} ${pathname}`)));
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function redirectLocation(response, expectedPrefix, label) {
  if (![301, 302, 303, 307, 308].includes(Number(response.statusCode))) {
    throw new Error(`${label} expected redirect, received ${response.statusCode}: ${String(response.body).slice(0, 160)}`);
  }
  const location = String(response.headers.location || "");
  if (!location.startsWith(expectedPrefix)) {
    throw new Error(`${label} expected redirect to ${expectedPrefix}, received: ${location}`);
  }
  return location;
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
    const body = Buffer.isBuffer(response.body) ? response.body.toString("utf8", 0, 160) : String(response.body).slice(0, 160);
    throw new Error(`${label} expected ${expected}, received ${response.statusCode}: ${body}`);
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

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-share-browse-"));
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
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(child);
    const cookie = sessionCookie(await request("POST", "/api/session/login", {
      body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
    }));
    const fixture = pdfFixtureData();
    const created = assertStatus(await request("POST", "/api/documents", {
      cookie,
      body: {
        name: `share-browse-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        size: fixture.size,
        dataBase64: fixture.dataBase64,
        actor: "管理员",
        conflictMode: "rename",
      },
    }), 201, "create shared document").document;
    const shared = assertStatus(await request("PATCH", `/api/documents/${encodeURIComponent(created.id)}`, {
      cookie,
      body: {
        actor: "管理员",
        share: { enabled: true, permission: "view", token: "sharebrowsecontract" },
      },
    }), 200, "enable share").document;

    if (!/^\/share\/[^/?#]+$/.test(shared.shareUrl || "")) {
      throw new Error(`Share URL should point to the public browse page, received: ${shared.shareUrl}`);
    }
    const sharePath = new URL(shared.shareUrl, BASE_URL).pathname;
    const sharePage = await request("GET", sharePath);
    const pdfShareLocation = redirectLocation(sharePage, "/pdf.html?", "PDF share page");
    if (!pdfShareLocation.includes("share=sharebrowsecontract") || pdfShareLocation.includes("docId=")) {
      throw new Error(`PDF share redirect should carry only the public share token, received: ${pdfShareLocation}`);
    }
    const publicPayload = assertStatus(await request("GET", `/api/share/${encodeURIComponent(shared.share.token)}`), 200, "public share payload");
    if (publicPayload.document?.id !== shared.id || !publicPayload.document?.fileUrl?.includes("share=sharebrowsecontract")) {
      throw new Error(`Public share payload did not resolve the shared document: ${JSON.stringify(publicPayload)}`);
    }
    if (publicPayload.viewerUrl !== pdfShareLocation) {
      throw new Error(`Public share payload viewerUrl should match the share redirect. payload=${publicPayload.viewerUrl} redirect=${pdfShareLocation}`);
    }
    if (publicPayload.document?.permissions?.preview !== true || publicPayload.document?.permissions?.download !== false) {
      throw new Error(`Public share permissions should be view-only: ${JSON.stringify(publicPayload.document?.permissions)}`);
    }
    const publicPdf = assertStatus(await request("GET", `/api/share/${encodeURIComponent(shared.share.token)}/document`), 200, "public PDF share document").document;
    if (publicPdf.id !== shared.id || publicPdf.permissions?.download !== false) {
      throw new Error(`Public PDF document endpoint did not return the shared document: ${JSON.stringify(publicPdf)}`);
    }
    assertStatus(await request("GET", publicPayload.document.fileUrl, { binary: true }), 200, "public share file preview");
    assertStatus(await request("GET", `/api/documents/${encodeURIComponent(shared.id)}`), 401, "normal document API without session");
    assertStatus(await request("GET", "/api/share/bad-token"), 404, "invalid share token");

    const officeFixture = textFixtureData("a,b\n1,2\n");
    const officeDoc = assertStatus(await request("POST", "/api/documents", {
      cookie,
      body: {
        name: `share-office-${Date.now()}.csv`,
        mimeType: "text/csv",
        size: officeFixture.size,
        dataBase64: officeFixture.dataBase64,
        actor: "管理员",
        conflictMode: "rename",
      },
    }), 201, "create Office share document").document;
    const officeShared = assertStatus(await request("PATCH", `/api/documents/${encodeURIComponent(officeDoc.id)}`, {
      cookie,
      body: {
        actor: "管理员",
        share: { enabled: true, permission: "view", token: "shareofficecontract" },
      },
    }), 200, "enable Office share").document;
    const officeLocation = redirectLocation(await request("GET", new URL(officeShared.shareUrl, BASE_URL).pathname), "/onlyoffice.html?", "Office share page");
    if (!officeLocation.includes("share=shareofficecontract") || !officeLocation.includes("mode=view")) {
      throw new Error(`Office share redirect should open read-only OnlyOffice with share token, received: ${officeLocation}`);
    }
    const officeConfig = assertStatus(await request("GET", `/api/onlyoffice/share/${encodeURIComponent(officeShared.share.token)}/config`), 200, "public Office config");
    if (officeConfig.enabled && officeConfig.mode !== "view") {
      throw new Error(`Public Office config must be read-only, received: ${JSON.stringify(officeConfig)}`);
    }

    const apsFixture = textFixtureData("dummy nwd content");
    const apsDoc = assertStatus(await request("POST", "/api/documents", {
      cookie,
      body: {
        name: `share-model-${Date.now()}.nwd`,
        mimeType: "application/octet-stream",
        size: apsFixture.size,
        dataBase64: apsFixture.dataBase64,
        actor: "管理员",
        conflictMode: "rename",
      },
    }), 201, "create APS share document").document;
    const apsShared = assertStatus(await request("PATCH", `/api/documents/${encodeURIComponent(apsDoc.id)}`, {
      cookie,
      body: {
        actor: "管理员",
        share: { enabled: true, permission: "view", token: "shareapscontract" },
      },
    }), 200, "enable APS share").document;
    const apsLocation = redirectLocation(await request("GET", new URL(apsShared.shareUrl, BASE_URL).pathname), "/apsviewer.html?", "APS share page");
    if (!apsLocation.includes("share=shareapscontract") || !apsLocation.includes("workspace=model")) {
      throw new Error(`APS share redirect should open model workspace with share token, received: ${apsLocation}`);
    }
    assertStatus(await request("GET", `/api/aps/share/${encodeURIComponent(apsShared.share.token)}/config`), 200, "public APS config without CDE session");

    console.log(`share browse smoke passed: share links route by file type and public token APIs work without CDE session on ${BASE_URL}`);
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
