const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(24080 + Math.floor(Math.random() * 1000));
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 2500;
const BOOTSTRAP_PASSWORD = "cde@123456";
const MAX_FAILED_ATTEMPTS = 5;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, pathname, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      `${BASE_URL}${pathname}`,
      {
        method,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
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

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${method} ${pathname}`));
    });
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-docs-login-limit-smoke-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      CDE_LOGIN_RATE_LIMIT_WINDOW_MS: "60000",
      CDE_LOGIN_RATE_LIMIT_LOCK_MS: "60000",
      APS_CLIENT_ID: "",
      APS_CLIENT_SECRET: "",
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

    for (let attempt = 1; attempt < MAX_FAILED_ATTEMPTS; attempt += 1) {
      const response = await request("POST", "/api/session/login", {
        body: { email: "pm@cde.local", password: `wrong-${attempt}` },
      });
      assertStatus(response, 401, `wrong password attempt ${attempt}`);
    }

    const lockTrigger = await request("POST", "/api/session/login", {
      body: { email: "pm@cde.local", password: `wrong-${MAX_FAILED_ATTEMPTS}` },
    });
    assertStatus(lockTrigger, 429, "lock-triggering wrong password login");

    const lockedWrongPassword = await request("POST", "/api/session/login", {
      body: { email: "pm@cde.local", password: "still-wrong" },
    });
    assertStatus(lockedWrongPassword, 429, "locked wrong password login");
    if (!lockedWrongPassword.headers["retry-after"]) {
      throw new Error("Locked response should include Retry-After header");
    }

    const lockedCorrectPassword = await request("POST", "/api/session/login", {
      body: { email: "pm@cde.local", password: BOOTSTRAP_PASSWORD },
    });
    assertStatus(lockedCorrectPassword, 429, "locked correct password login");

    const differentAccount = await request("POST", "/api/session/login", {
      body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
    });
    assertStatus(differentAccount, 200, "different account login should not be locked");

    console.log(`login rate limit smoke passed: repeated failures lock account on ${BASE_URL}`);
  } catch (error) {
    if (output.trim()) {
      console.error(output.trim());
    }
    throw error;
  } finally {
    await stopServer(child);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
