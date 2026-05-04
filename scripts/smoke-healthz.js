const http = require("node:http");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const HOST = "127.0.0.1";
const PORT = String(19080 + Math.floor(Math.random() * 1000));
const HEALTH_URL = `http://${HOST}:${PORT}/healthz`;
const START_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 2000;

function requestHealthz() {
  return new Promise((resolve, reject) => {
    const req = http.get(HEALTH_URL, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on("error", reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealthz(child) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await requestHealthz();
      return response;
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }

  throw new Error(`Timed out waiting for ${HEALTH_URL}: ${lastError?.message || "no response"}`);
}

function assertHealthPayload(response) {
  if (response.statusCode !== 200) {
    throw new Error(`Expected 200 from /healthz, received ${response.statusCode}: ${response.body}`);
  }

  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch (error) {
    throw new Error(`Health response is not JSON: ${error.message}`);
  }

  if (payload.service !== "cde-doc-workflow") {
    throw new Error(`Unexpected service value: ${payload.service}`);
  }

  if (!new Set(["ok", "degraded"]).has(payload.status)) {
    throw new Error(`Unexpected health status: ${payload.status}`);
  }

  if (!payload.checks || typeof payload.checks !== "object") {
    throw new Error("Health payload is missing checks object");
  }

  if (!payload.checks.data || typeof payload.checks.data !== "object") {
    throw new Error("Health payload is missing data checks");
  }

  if (!payload.checks.data.store || typeof payload.checks.data.store.exists !== "boolean") {
    throw new Error("Health payload is missing store check");
  }

  if (!payload.checks.data.dataDir || typeof payload.checks.data.dataDir.writable !== "boolean") {
    throw new Error("Health payload is missing data directory writability check");
  }

  return payload;
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
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
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
    const response = await waitForHealthz(child);
    const payload = assertHealthPayload(response);
    console.log(`healthz smoke passed: ${payload.status} on ${HEALTH_URL}`);
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
