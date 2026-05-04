const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(21480 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
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
        timeout: 8000,
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
    req.on("timeout", () => req.destroy(new Error(`Request timed out: ${method} ${pathname}`)));
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
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

async function waitForServer(child) {
  const deadline = Date.now() + 8000;
  let lastError = null;
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
  throw new Error(`Timed out waiting for server: ${lastError?.message || "no response"}`);
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

async function loginAdmin() {
  const response = await request("POST", "/api/session/login", {
    body: {
      email: "admin@cde.local",
      password: BOOTSTRAP_PASSWORD,
    },
  });
  assertStatus(response, 200, "login admin");
  return sessionCookie(response);
}

function assertInitialSettingsComeOnlyFromSystem(access) {
  const aps = access.apsConfiguration?.system || {};
  if (aps.enabled || aps.status !== "disabled" || aps.clientId || aps.hasClientSecret || aps.source !== "system_settings") {
    throw new Error(`APS should start from empty system settings, not environment values: ${JSON.stringify(aps)}`);
  }
  if (aps.viewerVersion !== "7.*" || aps.viewerEnv !== "AutodeskProduction2" || aps.viewerApi !== "streamingV2") {
    throw new Error(`APS viewer defaults should come from system defaults, not env: ${JSON.stringify(aps)}`);
  }

  const ai = access.aiConfiguration?.system || {};
  if (ai.enabled || ai.endpoint || ai.model || ai.hasApiKey || ai.timeoutMs !== 20000 || ai.batchSize !== 100) {
    throw new Error(`AI should start from empty system settings, not environment values: ${JSON.stringify(ai)}`);
  }
}

async function runScenario() {
  const cookie = await loginAdmin();
  const access = assertStatus(await request("GET", "/api/access", { cookie }), 200, "access");
  assertInitialSettingsComeOnlyFromSystem(access);

  const disabledAps = assertStatus(
    await request("PATCH", "/api/system/aps-settings", {
      cookie,
      body: {
        enabled: false,
        clientId: "",
        clientSecret: "",
        bucketKey: "",
        viewerVersion: "",
        viewerEnv: "",
        viewerApi: "",
      },
    }),
    200,
    "save disabled APS settings",
  );
  assertInitialSettingsComeOnlyFromSystem(disabledAps.access);

  const savedAps = assertStatus(
    await request("PATCH", "/api/system/aps-settings", {
      cookie,
      body: {
        enabled: true,
        clientId: "system-aps-client",
        clientSecret: "system-aps-secret",
        bucketKey: "system-aps-bucket",
        bucketPolicy: "temporary",
        bucketRegion: "EMEA",
        viewerVersion: "7.99",
        viewerEnv: "AutodeskStaging",
        viewerApi: "streamingV2",
      },
    }),
    200,
    "save explicit system APS settings",
  );
  const aps = savedAps.access?.apsConfiguration?.system || {};
  if (!aps.enabled || aps.clientId !== "system-aps-client" || aps.bucketKey !== "system-aps-bucket" || aps.viewerVersion !== "7.99" || aps.source !== "system_settings") {
    throw new Error(`APS did not persist explicit system settings: ${JSON.stringify(aps)}`);
  }

  const savedAi = assertStatus(
    await request("PATCH", "/api/system/ai-settings", {
      cookie,
      body: {
        enabled: false,
        endpoint: "http://127.0.0.1:9/system-ai",
        model: "system-ai-model",
        apiKey: "system-ai-secret",
        timeoutMs: 31000,
        batchSize: 44,
      },
    }),
    200,
    "save explicit system AI settings",
  );
  const ai = savedAi.access?.aiConfiguration?.system || {};
  if (ai.enabled || ai.endpoint !== "http://127.0.0.1:9/system-ai" || ai.model !== "system-ai-model" || !ai.hasApiKey || ai.timeoutMs !== 31000 || ai.batchSize !== 44) {
    throw new Error(`AI did not persist explicit system settings: ${JSON.stringify(ai)}`);
  }

  console.log("system settings source smoke passed: global APS and AI are read from System Settings only");
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-settings-source-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      APS_CLIENT_ID: "env-aps-client",
      APS_CLIENT_SECRET: "env-aps-secret",
      APS_BUCKET_KEY: "env-aps-bucket",
      APS_VIEWER_VERSION: "8.8",
      APS_VIEWER_ENV: "EnvViewer",
      APS_VIEWER_API: "envApi",
      CDE_CRS_AI_ENDPOINT: "http://127.0.0.1:9/env-ai",
      CDE_CRS_AI_API_KEY: "env-ai-secret",
      CDE_CRS_AI_MODEL: "env-ai-model",
      CDE_CRS_AI_TIMEOUT_MS: "45000",
      CDE_CRS_AI_BATCH_SIZE: "33",
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
    await runScenario();
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
