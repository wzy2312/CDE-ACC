const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(27080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 2500;
const BOOTSTRAP_PASSWORD = "cde@123456";

function pdfFixtureData() {
  const pdfBase64 =
    "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwgL0xlbmd0aCAzID4+CnN0cmVhbQpCBQplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAzIDAgUiAvUmVzb3VyY2VzIDw8ID4+IC9Db250ZW50cyAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXQo+PgplbmRvYmoKMyAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzQgMCBSIF0gL0NvdW50IDEgPj4KZW5kb2JqCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDMgMCBSID4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyMzMgMDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMTc0IDAwMDAwIG4gCjAwMDAwMDAwNjcgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgoyODIKJSVFT0YK";
  return { dataBase64: pdfBase64, size: Buffer.from(pdfBase64, "base64").length };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        let json = null;
        if (buffer.length) {
          try { json = JSON.parse(buffer.toString("utf8")); } catch { json = null; }
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: buffer.toString("utf8"), buffer, json });
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
      if (response.statusCode === 200) return response.json;
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-storage-smoke-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, HOST, PORT, CDE_DATA_DIR: dataDir, CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD, APS_CLIENT_ID: "", APS_CLIENT_SECRET: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    const health = await waitForServer(child);
    if (health.checks?.data?.storage?.adapter !== "local") throw new Error("Health payload is missing local storage adapter");
    if (!health.checks?.data?.storage?.uploads?.writable || !health.checks?.data?.storage?.exports?.writable || !health.checks?.data?.storage?.attachments?.writable) {
      throw new Error("Storage buckets should be writable in health payload");
    }

    const cookie = sessionCookie(await request("POST", "/api/session/login", { body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD } }));
    const fixture = pdfFixtureData();
    const created = assertStatus(await request("POST", "/api/documents", {
      cookie,
      body: { name: `storage-${Date.now()}.pdf`, mimeType: "application/pdf", size: fixture.size, dataBase64: fixture.dataBase64, actor: "管理员", conflictMode: "rename" },
    }), 201, "create storage document").document;

    const fileResponse = await request("GET", created.fileUrl, { cookie });
    if (fileResponse.statusCode !== 200 || fileResponse.buffer.length !== fixture.size || fileResponse.headers["content-type"] !== "application/pdf") {
      throw new Error(`Stored upload download failed: ${fileResponse.statusCode}/${fileResponse.buffer.length}/${fileResponse.headers["content-type"]}`);
    }

    console.log(`storage smoke passed: health and protected upload download on ${BASE_URL}`);
  } catch (error) {
    if (output.trim()) console.error(output.trim());
    throw error;
  } finally {
    await stopServer(child);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
