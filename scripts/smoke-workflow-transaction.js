const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(25080 + Math.floor(Math.random() * 1000));
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

function request(method, pathname, { body, cookie, headers = {} } = {}) {
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
          ...headers,
        },
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          let json = null;
          if (responseBody) {
            try {
              json = JSON.parse(responseBody);
            } catch {
              json = null;
            }
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: responseBody, json });
        });
      },
    );

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

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-workflow-tx-smoke-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      CDE_FAIL_NEXT_PERSIST_AFTER_HEADER: "x-cde-fail-next-persist",
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
    const loginResponse = await request("POST", "/api/session/login", {
      body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
    });
    const cookie = sessionCookie(loginResponse);
    const before = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents before");
    const template = before.workflowTemplates.find((item) => item.autoExport?.enabled === false && Array.isArray(item.steps) && item.steps.length);
    if (!template) throw new Error("Missing non-auto-export workflow template");

    const fixture = pdfFixtureData();
    const createdDocument = assertStatus(await request("POST", "/api/documents", {
      cookie,
      body: {
        name: `tx-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        size: fixture.size,
        dataBase64: fixture.dataBase64,
        actor: "管理员",
        conflictMode: "rename",
      },
    }), 201, "create tx document").document;

    const workflow = assertStatus(await request("POST", "/api/workflows", {
      cookie,
      body: {
        workflowName: `TX Smoke ${Date.now()}`,
        templateId: template.id,
        fileIds: [createdDocument.id],
        actor: "管理员",
      },
    }), 201, "create tx workflow").workflow;

    const failedAction = await request("POST", `/api/workflows/${encodeURIComponent(workflow.id)}/actions`, {
      cookie,
      body: { action: "withdrawFlow", actor: "管理员", comment: "force persist failure" },
      headers: { "x-cde-fail-next-persist": "1" },
    });
    assertStatus(failedAction, 500, "failed workflow action");

    const after = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after failed action");
    const afterWorkflow = after.workflows.find((item) => item.id === workflow.id);
    const afterDocument = after.documents.find((item) => item.id === createdDocument.id);
    if (!afterWorkflow || afterWorkflow.status !== "running") {
      throw new Error(`Workflow should remain running after failed transaction, received ${afterWorkflow?.status}`);
    }
    if (!afterDocument || afterDocument.status !== "in_review" || afterDocument.activeWorkflowId !== workflow.id) {
      throw new Error(`Document should remain linked to running workflow after failed transaction, received ${afterDocument?.status}/${afterDocument?.activeWorkflowId}`);
    }

    console.log(`workflow transaction smoke passed: failed persist rolled back in-memory state on ${BASE_URL}`);
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
