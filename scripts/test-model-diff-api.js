const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = Number(process.env.CDE_MODEL_DIFF_API_TEST_PORT || 20630 + Math.floor(Math.random() * 1000));
const BOOTSTRAP_PASSWORD = "model-diff-api-pass";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, route, { cookie = "", body = undefined } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        method,
        path: route,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            json: raw ? JSON.parse(raw) : {},
            raw,
          });
        });
      },
    );
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function assertStatus(response, expected, label) {
  assert.equal(response.statusCode, expected, `${label}: ${response.statusCode} ${response.raw}`);
  return response;
}

function sessionCookie(response) {
  const cookie = response.headers["set-cookie"]?.[0] || "";
  return cookie.split(";")[0];
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`server exited with ${child.exitCode}`);
    }
    try {
      const response = await request("GET", "/healthz");
      if (response.statusCode === 200) {
        return;
      }
    } catch {
      await delay(100);
    }
  }
  throw new Error("server did not start");
}

async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      return;
    }
    await delay(50);
  }
  child.kill("SIGKILL");
}

function startServerProcess(dataDir, envPatch = {}) {
  return spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      APS_CLIENT_ID: "",
      APS_CLIENT_SECRET: "",
      ...envPatch,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function createModelDocument(cookie) {
  const fixture = Buffer.from("model diff fixture", "utf8");
  const created = assertStatus(
    await request("POST", "/api/documents", {
      cookie,
      body: {
        name: "desalination-train.ifc",
        mimeType: "application/octet-stream",
        size: fixture.length,
        dataBase64: fixture.toString("base64"),
        actor: "管理员",
      },
    }),
    201,
    "create model",
  ).json.document;

  const revisionAWithAps = assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(created.id)}/aps`, {
      cookie,
      body: {
        aps: {
          urn: `urn:${created.id}:rev-a`,
          sourceVersionId: created.currentVersionId,
          translationStatus: "success",
          viewable3dGuid: `${created.id}-rev-a-3d`,
        },
      },
    }),
    200,
    "patch APS for revision A",
  ).json.document;

  const revisionB = Buffer.from("model diff fixture rev b", "utf8");
  const versioned = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(revisionAWithAps.id)}/version`, {
      cookie,
      body: {
        name: created.name,
        mimeType: "application/octet-stream",
        size: revisionB.length,
        dataBase64: revisionB.toString("base64"),
        note: "Rev.B",
        actor: "管理员",
      },
    }),
    200,
    "upload model revision B",
  ).json.document;

  const patched = assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(versioned.id)}/aps`, {
      cookie,
      body: {
        aps: {
          urn: `urn:${versioned.id}:rev-b`,
          sourceVersionId: versioned.currentVersionId,
          translationStatus: "success",
          viewable3dGuid: `${versioned.id}-3d`,
        },
      },
    }),
    200,
    "patch APS",
  ).json.document;
  return patched;
}

function prop(displayName, displayValue) {
  return { displayName, displayValue };
}

function diffPayload(revision) {
  const isB = revision === "B";
  return {
    data: {
      collection: [
        {
          objectid: isB ? 201 : 101,
          name: isB ? "SWRO Feed Pipe DN150" : "SWRO Feed Pipe DN100",
          bbox: { min: [0, 0, 0], max: [1, 0.2, 0.2] },
          properties: [
            prop("UniqueId", "pipe-001"),
            prop("Part Type", "Pipe"),
            prop("Process Unit", "RO 一段"),
            prop("Discipline", "管道"),
            prop("Nominal Diameter", isB ? "DN150" : "DN100"),
          ],
        },
        {
          objectid: isB ? 202 : 102,
          name: "High Pressure Pump P-101",
          bbox: { min: [isB ? 5.15 : 5, 0, 0], max: [isB ? 6.15 : 6, 1, 1] },
          properties: [
            prop("Handle", "pump-handle-101"),
            prop("Equipment Type", "High Pressure Pump"),
            prop("Process Unit", "RO 一段"),
            prop("Discipline", "设备"),
          ],
        },
        ...(!isB
          ? [{
              objectid: 103,
              name: "Removed Filter CF-01",
              bbox: { min: [8, 0, 0], max: [9, 1, 1] },
              properties: [
                prop("UniqueId", "filter-removed"),
                prop("Equipment Type", "Cartridge Filter"),
                prop("Process Unit", "预处理"),
                prop("Discipline", "设备"),
              ],
            }]
          : [{
              objectid: 203,
              name: "Energy Recovery Device ERD-01",
              bbox: { min: [10, 0, 0], max: [11, 1, 1] },
              properties: [
                prop("UniqueId", "erd-added"),
                prop("Equipment Type", "Energy Recovery Device"),
                prop("Process Unit", "能量回收"),
                prop("Discipline", "设备"),
              ],
            }]),
      ],
    },
  };
}

async function waitForDiffTask(cookie, taskId) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const detail = assertStatus(
      await request("GET", `/api/model-apps/diff/tasks/${encodeURIComponent(taskId)}`, { cookie }),
      200,
      "get diff task",
    ).json;
    if (detail.task?.status === "completed") {
      return detail;
    }
    if (detail.task?.status === "failed") {
      throw new Error(`model diff task failed: ${detail.task.error}`);
    }
    await delay(100);
  }
  throw new Error("model diff task did not complete");
}

async function runScenario() {
  const login = assertStatus(
    await request("POST", "/api/session/login", {
      body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
    }),
    200,
    "login",
  );
  const cookie = sessionCookie(login);
  const doc = await createModelDocument(cookie);
  const versionA = doc.versionHistory[0].id;
  const versionB = doc.currentVersionId;

  const home = assertStatus(await request("GET", "/api/model-apps/diff", { cookie }), 200, "diff home").json;
  assert.ok(home.documents.some((item) => item.id === doc.id), "diff home should expose model documents");

  const first = assertStatus(
    await request("POST", "/api/model-apps/diff/run", {
      cookie,
      body: {
        documentId: doc.id,
        versionAId: versionA,
        versionBId: versionB,
        toleranceMm: 10,
        coordinateUnit: "m",
        propertiesPayloads: {
          [versionA]: diffPayload("A"),
          [versionB]: diffPayload("B"),
        },
      },
    }),
    202,
    "enqueue model diff",
  ).json;
  assert.equal(first.reused, false);

  const duplicate = assertStatus(
    await request("POST", "/api/model-apps/diff/run", {
      cookie,
      body: {
        documentId: doc.id,
        versionAId: versionA,
        versionBId: versionB,
        toleranceMm: 10,
        coordinateUnit: "m",
        propertiesPayloads: {
          [versionA]: diffPayload("A"),
          [versionB]: diffPayload("B"),
        },
      },
    }),
    202,
    "reuse active model diff",
  ).json;
  assert.equal(duplicate.task.id, first.task.id, "same document/version pair should reuse active task");

  const detail = await waitForDiffTask(cookie, first.task.id);
  assert.equal(detail.task.status, "completed");
  assert.equal(detail.task.summary.added, 1);
  assert.equal(detail.task.summary.deleted, 1);
  assert.equal(detail.task.summary.modified, 1);
  assert.equal(detail.task.summary.moved, 1);
  assert.match(detail.aiSummary.summary, /Rev|V1/);
  assert.ok(detail.records.some((record) => record.diffType === "modified" && record.changedProps.length === 1));
  assert.ok(detail.records.some((record) => record.diffType === "moved" && record.bboxDelta.distanceMm > 100));

  assertStatus(
    await request("PATCH", "/api/system/aps-settings", {
      cookie,
      body: {
        enabled: true,
        clientId: "model-diff-viewer-client",
        clientSecret: "model-diff-viewer-secret",
        bucketPolicy: "persistent",
        bucketRegion: "US",
        viewerVersion: "7.*",
        viewerEnv: "AutodeskProduction2",
        viewerApi: "streamingV2",
      },
    }),
    200,
    "configure APS settings for viewer payload",
  );
  const viewerA = assertStatus(
    await request("GET", `/api/aps/documents/${encodeURIComponent(doc.id)}/config?versionId=${encodeURIComponent(versionA)}&modelDiffTaskId=${encodeURIComponent(first.task.id)}`, { cookie }),
    200,
    "viewer config version A",
  ).json;
  assert.equal(viewerA.file.versionId, versionA);
  assert.equal(viewerA.aps.urn, `urn:${doc.id}:rev-a`);
  const viewerB = assertStatus(
    await request("GET", `/api/aps/documents/${encodeURIComponent(doc.id)}/config?versionId=${encodeURIComponent(versionB)}&modelDiffTaskId=${encodeURIComponent(first.task.id)}`, { cookie }),
    200,
    "viewer config version B",
  ).json;
  assert.equal(viewerB.file.versionId, versionB);
  assert.equal(viewerB.aps.urn, `urn:${doc.id}:rev-b`);

  const completedDuplicate = assertStatus(
    await request("POST", "/api/model-apps/diff/run", {
      cookie,
      body: {
        documentId: doc.id,
        versionAId: versionA,
        versionBId: versionB,
        propertiesPayloads: {
          [versionA]: diffPayload("A"),
          [versionB]: diffPayload("B"),
        },
      },
    }),
    202,
    "reuse latest completed task",
  ).json;
  assert.equal(completedDuplicate.reused, true, "completed same-pair requests should reuse the latest result instead of recalculating");
  assert.equal(completedDuplicate.task.id, first.task.id);
  const secondDetail = await waitForDiffTask(cookie, completedDuplicate.task.id);
  assert.equal(secondDetail.history.filter((task) => task.documentId === doc.id && task.versionAId === versionA && task.versionBId === versionB).length, 1);

  const modifiedRecord = secondDetail.records.find((record) => record.diffType === "modified");
  const issueResult = assertStatus(
    await request("POST", `/api/model-apps/diff/records/${encodeURIComponent(modifiedRecord.id)}/issue`, {
      cookie,
      body: {
        title: "管线管径变更复核",
        responsible: "管道专业",
        dueDate: "2026-05-10",
      },
    }),
    201,
    "create issue from diff",
  ).json;
  assert.equal(issueResult.record.issueId, issueResult.issue.id);
  assert.equal(issueResult.issue.dbIds[0], modifiedRecord.dbIdAfter);
  assert.equal(issueResult.issue.elementUniqueId, "pipe-001");

  const trends = assertStatus(
    await request("GET", `/api/model-apps/diff/trends?documentId=${encodeURIComponent(doc.id)}`, { cookie }),
    200,
    "diff trends",
  ).json;
  assert.ok(trends.rows.length >= 1, "trend API should expose completed version pairs");

  console.log("model diff API tests passed");
}

async function runFixtureGateScenario() {
  const login = assertStatus(
    await request("POST", "/api/session/login", {
      body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
    }),
    200,
    "login for fixture gate",
  );
  const cookie = sessionCookie(login);
  const doc = await createModelDocument(cookie);
  const versionA = doc.versionHistory[0].id;
  const rejected = await request("POST", "/api/model-apps/diff/run", {
    cookie,
    body: {
      documentId: doc.id,
      versionAId: versionA,
      versionBId: doc.currentVersionId,
      propertiesPayloads: {
        [versionA]: diffPayload("A"),
        [doc.currentVersionId]: diffPayload("B"),
      },
    },
  });
  assert.equal(rejected.statusCode, 400, `fixture payload should be rejected without test flag: ${rejected.raw}`);
  assert.match(rejected.json.error || "", /测试属性载荷|fixture/i);
}

async function runWithServer(envPatch, scenario) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-model-diff-api-"));
  const child = startServerProcess(dataDir, envPatch);
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer(child);
    await scenario();
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

async function main() {
  await runWithServer({}, runFixtureGateScenario);
  await runWithServer({ CDE_ALLOW_MODEL_DIFF_FIXTURE_PAYLOAD: "1" }, runScenario);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
