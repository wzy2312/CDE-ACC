const fs = require("node:fs");
const crypto = require("node:crypto");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(31080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 20000;
const REQUEST_TIMEOUT_MS = 8000;
const BOOTSTRAP_PASSWORD = "cde@123456";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, pathname, { body, cookie } = {}) {
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
    if (payload) {
      req.write(payload);
    }
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

function workspaceDocuments(payload) {
  return Array.isArray(payload?.documents) ? payload.documents : [];
}

function accessProjects(payload) {
  if (Array.isArray(payload?.projects)) {
    return payload.projects;
  }
  if (Array.isArray(payload?.access?.projects)) {
    return payload.access.projects;
  }
  return [];
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-onlyoffice-grant-"));
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
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer(child);
    const loginResponse = await request("POST", "/api/session/login", {
      body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
    });
    const cookie = sessionCookie(loginResponse);
    const access = assertStatus(await request("GET", "/api/access", { cookie }), 200, "access");
    const alternateProject = accessProjects(access).find((item) => !item.isCurrent);
    if (!alternateProject?.id) {
      throw new Error("OnlyOffice callback grant smoke requires at least two seeded projects");
    }

    assertStatus(
      await request("POST", "/api/session/project", {
        cookie,
        body: { projectId: alternateProject.id },
      }),
      200,
      "switch project",
    );

    const initialContent = Buffer.from("name,value\ninitial,1\n", "utf8");
    const created = assertStatus(
      await request("POST", "/api/documents", {
        cookie,
        body: {
          name: `onlyoffice-grant-${Date.now()}.csv`,
          mimeType: "text/csv",
          size: initialContent.length,
          dataBase64: initialContent.toString("base64"),
          actor: "管理员",
          conflictMode: "rename",
        },
      }),
      201,
      "create office document",
    ).document;

    const config = assertStatus(
      await request("GET", `/api/onlyoffice/documents/${encodeURIComponent(created.id)}/config?mode=edit`, { cookie }),
      200,
      "onlyoffice config",
    ).config;
    const callbackUrl = config?.editorConfig?.callbackUrl || "";
    if (!callbackUrl) {
      throw new Error("Editable OnlyOffice config did not include callbackUrl");
    }
    const documentsBeforeCallback = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents before callback");
    const createdPublic = workspaceDocuments(documentsBeforeCallback).find((item) => item.id === created.id);
    if (!createdPublic) {
      throw new Error("Created document was not returned by document list");
    }
    const currentVersion =
      createdPublic.versionHistory?.find((entry) => entry.id === createdPublic.currentVersionId) ||
      createdPublic.versionHistory?.find((entry) => entry.isCurrent) ||
      createdPublic.versionHistory?.[0];
    if (!currentVersion?.id) {
      throw new Error("Created document did not expose current version metadata");
    }
    const legacyDocumentKey = crypto
      .createHash("sha1")
      .update([createdPublic.id, currentVersion.id, currentVersion.uploadedAt, currentVersion.size, "edit"].join(":"))
      .digest("hex");
    if (config?.document?.key === legacyDocumentKey) {
      throw new Error("OnlyOffice document key still uses the legacy namespace and can reopen stale failed sessions");
    }

    const callbackTarget = new URL(callbackUrl);
    const savedContent = Buffer.from("name,value\nsaved,2\n", "utf8");
    assertStatus(
      await request("POST", `${callbackTarget.pathname}${callbackTarget.search}`, {
        body: {
          status: 2,
          url: `data:text/csv;base64,${savedContent.toString("base64")}`,
        },
      }),
      200,
      "onlyoffice callback",
    );

    const docs = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after callback");
    const updated = workspaceDocuments(docs).find((item) => item.id === created.id);
    if (!updated || updated.version !== "V2") {
      throw new Error(`Expected callback to persist V2 in alternate project, received ${updated?.version || "missing"}`);
    }

    console.log("onlyoffice callback grant smoke passed: editable callback persists with original user/project context");
  } catch (error) {
    if (output.trim()) {
      console.error(output.trim());
    }
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    await stopServer(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
