const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(23080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 2500;
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
    throw new Error(`${label} expected ${expected}, received ${response.statusCode}: ${response.body.slice(0, 200)}`);
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-folder-smoke-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, HOST, PORT, CDE_DATA_DIR: dataDir, CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD, APS_CLIENT_ID: "", APS_CLIENT_SECRET: "" },
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
    const cookie = sessionCookie(await request("POST", "/api/session/login", {
      body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
    }));
    const defaultWorkspace = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "default project workspace");
    const defaultFolder = defaultWorkspace.folders.find((folder) => !folder.parentId && folder.name === "00 RECEIVED") || defaultWorkspace.folders[0];
    if (!defaultFolder?.id) {
      throw new Error("Default project did not expose a folder");
    }

    const alternateProject = defaultWorkspace.access.projects.find((project) => !project.isCurrent);
    if (!alternateProject?.id) {
      throw new Error("No alternate project available for folder switch smoke");
    }

    const switched = assertStatus(await request("POST", "/api/session/project", {
      cookie,
      body: { projectId: alternateProject.id },
    }), 200, "switch project");
    const expectedParent = folderByPathNames(switched.folders, folderPathNames(defaultWorkspace.folders, defaultFolder.id));
    if (!expectedParent?.id) {
      throw new Error("Switched project did not expose an equivalent folder path");
    }

    const created = assertStatus(await request("POST", "/api/folders", {
      cookie,
      body: {
        name: `stale-parent-folder-${Date.now()}`,
        parentId: defaultFolder.id,
      },
    }), 201, "create folder with stale parent id").folder;

    if (created.projectId !== alternateProject.id || created.parentId !== expectedParent.id) {
      throw new Error(`Folder was not created in the active project equivalent parent: ${JSON.stringify(created)}`);
    }

    console.log("project folder create smoke passed: stale parent ids recover after project switch");
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
