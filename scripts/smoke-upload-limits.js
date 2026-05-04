const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(30080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 8000;
const BOOTSTRAP_PASSWORD = "cde@123456";

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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-upload-limits-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      CDE_MAX_UPLOAD_BYTES: "32",
      CDE_MAX_ATTACHMENT_BYTES: "16",
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
    const cookie = sessionCookie(await request("POST", "/api/session/login", { body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD } }));
    const tooLarge = Buffer.alloc(64, "x").toString("base64");
    assertStatus(await request("POST", "/api/documents", { cookie, body: { name: "too-large.pdf", mimeType: "application/pdf", size: 64, dataBase64: tooLarge, actor: "管理员", conflictMode: "rename" } }), 413, "oversized document upload");

    const small = Buffer.from("%PDF small", "utf8");
    const document = assertStatus(await request("POST", "/api/documents", { cookie, body: { name: "small.pdf", mimeType: "application/pdf", size: small.length, dataBase64: small.toString("base64"), actor: "管理员", conflictMode: "rename" } }), 201, "small document upload").document;
    const annotation = assertStatus(await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations`, { cookie, body: { type: "mark", page: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.2, title: "附件限制", note: "验证", actor: "管理员" } }), 201, "create annotation for attachment limit").annotation;
    assertStatus(await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations/${encodeURIComponent(annotation.id)}/replies`, { cookie, body: { actor: "管理员", content: "too large attachment", attachments: [{ kind: "document", name: "large.txt", mimeType: "text/plain", dataBase64: Buffer.alloc(32, "a").toString("base64") }] } }), 413, "oversized attachment upload");

    console.log(`upload limits smoke passed: oversized document and attachment blocked on ${BASE_URL}`);
  } catch (error) {
    if (output.trim()) console.error(output.trim());
    throw error;
  } finally {
    await stopServer(child);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
