const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(33080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 8000;
const BOOTSTRAP_PASSWORD = "cde@123456";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, pathname, { body, buffer, cookie, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = buffer || (body === undefined ? null : Buffer.from(JSON.stringify(body)));
    const req = http.request(`${BASE_URL}${pathname}`, {
      method,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(payload ? { "Content-Length": payload.length } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const responseBuffer = Buffer.concat(chunks);
        let json = null;
        if (responseBuffer.length) {
          try {
            json = JSON.parse(responseBuffer.toString("utf8"));
          } catch {
            json = null;
          }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBuffer.toString("utf8"),
          buffer: responseBuffer,
          json,
        });
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
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await request("GET", "/healthz");
      if (response.statusCode === 200) return;
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
  if (!session) throw new Error("Login response did not set cde_session cookie");
  return session.split(";")[0];
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  const timeout = setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, 2000);
  try {
    await once(child, "exit");
  } finally {
    clearTimeout(timeout);
  }
}

async function pollDocument(cookie, documentId, predicate, label) {
  const deadline = Date.now() + 7000;
  let latest = null;
  while (Date.now() < deadline) {
    const payload = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "list documents");
    latest = (payload.documents || []).find((item) => item.id === documentId) || null;
    if (latest && predicate(latest)) {
      return latest;
    }
    await delay(250);
  }
  throw new Error(`${label} did not become true. Latest document state: ${JSON.stringify(latest)}`);
}

async function uploadInChunks(cookie, { name, mimeType, data, chunkSize }) {
  const fingerprint = `smoke:${name}:${data.length}:${chunkSize}`;
  const session = assertStatus(await request("POST", "/api/uploads/resumable", {
    cookie,
    body: {
      name,
      mimeType,
      size: data.length,
      chunkSize,
      fingerprint,
      conflictMode: "rename",
      actor: "管理员",
    },
  }), 201, "create resumable upload session").session;

  const reused = assertStatus(await request("POST", "/api/uploads/resumable", {
    cookie,
    body: {
      name,
      mimeType,
      size: data.length,
      chunkSize,
      fingerprint,
      conflictMode: "rename",
      actor: "管理员",
    },
  }), 200, "reuse active resumable upload session").session;
  if (reused.id !== session.id) {
    throw new Error(`Duplicate resumable upload should reuse active session ${session.id}, received ${reused.id}`);
  }

  const activeSessions = assertStatus(await request("GET", "/api/uploads/resumable?status=active", { cookie }), 200, "list active resumable uploads").sessions || [];
  if (!activeSessions.some((item) => item.id === session.id && item.fingerprint === fingerprint)) {
    throw new Error(`Active resumable upload list did not include session ${session.id}: ${JSON.stringify(activeSessions)}`);
  }

  const firstChunk = data.subarray(0, chunkSize);
  assertStatus(await request("PUT", `/api/uploads/resumable/${encodeURIComponent(session.id)}/chunks/0`, {
    cookie,
    buffer: firstChunk,
    headers: { "Content-Type": "application/octet-stream" },
  }), 200, "upload first chunk");

  const status = assertStatus(await request("GET", `/api/uploads/resumable/${encodeURIComponent(session.id)}`, { cookie }), 200, "get resumable upload status").session;
  if (!status.receivedChunks.includes(0) || status.receivedBytes !== firstChunk.length) {
    throw new Error(`Session did not report uploaded first chunk: ${JSON.stringify(status)}`);
  }

  assertStatus(await request("POST", `/api/uploads/resumable/${encodeURIComponent(session.id)}/complete`, { cookie, body: {} }), 409, "complete incomplete resumable upload");

  for (let index = 1; index < Math.ceil(data.length / chunkSize); index += 1) {
    assertStatus(await request("PUT", `/api/uploads/resumable/${encodeURIComponent(session.id)}/chunks/${index}`, {
      cookie,
      buffer: data.subarray(index * chunkSize, Math.min(data.length, (index + 1) * chunkSize)),
      headers: { "Content-Type": "application/octet-stream" },
    }), 200, `upload chunk ${index}`);
  }

  const completed = assertStatus(await request("POST", `/api/uploads/resumable/${encodeURIComponent(session.id)}/complete`, { cookie, body: {} }), 201, "complete resumable upload");
  const replayed = assertStatus(await request("POST", `/api/uploads/resumable/${encodeURIComponent(session.id)}/complete`, { cookie, body: {} }), 200, "replay complete resumable upload");
  if (!replayed.document || replayed.document.id !== completed.document.id) {
    throw new Error(`Replayed completion should return existing document ${completed.document.id}, received ${JSON.stringify(replayed)}`);
  }

  return completed.document;
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-resumable-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      CDE_RESUMABLE_CHUNK_BYTES: "5",
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

    const pdfData = Buffer.from("%PDF resumable upload fixture\n%%EOF\n", "utf8");
    const pdfDoc = await uploadInChunks(cookie, {
      name: `resumable-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      data: pdfData,
      chunkSize: 5,
    });
    const downloaded = await request("GET", pdfDoc.fileUrl, { cookie });
    if (downloaded.statusCode !== 200 || !downloaded.buffer.equals(pdfData)) {
      throw new Error(`Resumable upload download mismatch: ${downloaded.statusCode}/${downloaded.buffer.length}`);
    }

    const dwgData = Buffer.from("not a real dwg, intentionally forcing APS parse failure", "utf8");
    const dwgDoc = await uploadInChunks(cookie, {
      name: `broken-${Date.now()}.dwg`,
      mimeType: "application/acad",
      data: dwgData,
      chunkSize: 5,
    });
    const failedDoc = await pollDocument(cookie, dwgDoc.id, (doc) => doc.parseStatus === "failed", "APS parse failure status");
    if (failedDoc.parseStatus === "done") {
      throw new Error("Failed APS parsing must not be displayed as parsed.");
    }

    const retried = assertStatus(await request("POST", `/api/documents/${encodeURIComponent(dwgDoc.id)}/parse/retry`, {
      cookie,
      body: { actor: "管理员" },
    }), 202, "retry parse").document;
    if (retried.parseStatus !== "processing") {
      throw new Error(`Retry parse should reset status to processing, received ${retried.parseStatus}`);
    }

    console.log(`resumable upload and parse retry smoke passed on ${BASE_URL}`);
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
