const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(32080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const BOOTSTRAP_PASSWORD = "cde@123456";
const REQUEST_TIMEOUT_MS = 8000;

function assertDeploymentConfigDoesNotShipDefaultSecrets() {
  const composePath = path.join(process.cwd(), "docker-compose.yml");
  const compose = fs.existsSync(composePath) ? fs.readFileSync(composePath, "utf8") : "";
  const forbiddenSnippets = [
    "AWS_ACCESS_KEY_ID: minioadmin",
    "AWS_SECRET_ACCESS_KEY: minioadmin",
    "MINIO_ROOT_USER: minioadmin",
    "MINIO_ROOT_PASSWORD: minioadmin",
    "CDE_BOOTSTRAP_PASSWORD: cde@123456",
  ];
  const matched = forbiddenSnippets.filter((snippet) => compose.includes(snippet));
  if (matched.length) {
    throw new Error(`docker-compose.yml ships default secrets: ${matched.join(", ")}`);
  }
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
    req.on("timeout", () => req.destroy(new Error(`Request timed out: ${method} ${pathname}`)));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
async function waitForServer(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited early with code ${child.exitCode}`);
    try {
      const response = await request("GET", "/healthz");
      if (response.statusCode === 200) return response.json;
    } catch {}
    await delay(150);
  }
  throw new Error("Timed out waiting for server");
}
function assertStatus(response, expected, label) {
  if (response.statusCode !== expected) throw new Error(`${label} expected ${expected}, received ${response.statusCode}: ${response.body}`);
  return response.json;
}
function sessionCookie(response) {
  const cookies = response.headers["set-cookie"] || [];
  const session = cookies.find((item) => item.startsWith("cde_session="));
  if (!session) throw new Error("Login response did not set session cookie");
  return session.split(";")[0];
}
async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  const timeout = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 2000);
  try { await once(child, "exit"); } finally { clearTimeout(timeout); }
}
async function main() {
  assertDeploymentConfigDoesNotShipDefaultSecrets();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-prod-hardening-"));
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
    if (!health.checks?.data?.audit?.ok) throw new Error("Audit chain should be healthy");
    const cookie = sessionCookie(await request("POST", "/api/session/login", { body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD } }));
    const pdf = Buffer.from("%PDF prod", "utf8");
    const document = assertStatus(await request("POST", "/api/documents", { cookie, body: { name: "prod.pdf", mimeType: "application/pdf", size: pdf.length, dataBase64: pdf.toString("base64"), actor: "管理员", conflictMode: "rename" } }), 201, "create document").document;
    const annotation = assertStatus(await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations`, { cookie, body: { type: "mark", page: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.2, title: "prod", note: "prod", actor: "管理员" } }), 201, "create annotation").annotation;
    assertStatus(await request("POST", `/api/documents/${encodeURIComponent(document.id)}/annotations/${encodeURIComponent(annotation.id)}/replies`, { cookie, body: { actor: "管理员", content: "blocked", attachments: [{ kind: "document", name: "evil.exe", mimeType: "application/octet-stream", dataBase64: Buffer.from("bad").toString("base64") }] } }), 415, "blocked attachment");
    const backup = spawnSync(process.execPath, ["scripts/backup-store.js"], { cwd: process.cwd(), env: { ...process.env, CDE_DATA_DIR: dataDir }, encoding: "utf8" });
    if (backup.status !== 0) throw new Error(backup.stderr || backup.stdout);
    if (!/backup created:/.test(backup.stdout)) throw new Error(`Unexpected backup output: ${backup.stdout}`);
    console.log(`production hardening smoke passed: audit, attachment policy, backup on ${BASE_URL}`);
  } catch (error) {
    if (output.trim()) console.error(output.trim());
    throw error;
  } finally {
    await stopServer(child);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
