const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = Number(process.env.CDE_QUANTITY_API_TEST_PORT || 19507 + Math.floor(Math.random() * 1000));
const BOOTSTRAP_PASSWORD = "quantity-takeoff-api-pass";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, route, { cookie = "", body = undefined, binary = false } = {}) {
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
        const chunks = [];
        let raw = "";
        if (!binary) {
          res.setEncoding("utf8");
        }
        res.on("data", (chunk) => {
          if (binary) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            return;
          }
          raw += chunk;
        });
        res.on("end", () => {
          const bodyBuffer = binary ? Buffer.concat(chunks) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            json: raw ? JSON.parse(raw) : {},
            raw: binary ? bodyBuffer : raw,
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

async function createUploadedModelDocument(cookie) {
  const fixture = Buffer.from("quantity model fixture", "utf8");
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

  return created;
}

async function createModelDocument(cookie) {
  const created = await createUploadedModelDocument(cookie);

  return assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(created.id)}/aps`, {
      cookie,
      body: {
        aps: {
          urn: `urn:${created.id}`,
          translationStatus: "success",
          viewable3dGuid: `${created.id}-3d`,
        },
      },
    }),
    200,
    "patch APS",
  ).json.document;
}

function quantityPayload(area, volume) {
  return {
    data: {
      collection: [
        {
          objectid: 101,
          name: "RO Vessel 8 inch A",
          properties: [
            { displayName: "Category", displayValue: "RO Membrane Vessel" },
            { displayName: "System", displayValue: "RO Unit 1" },
            { displayName: "Discipline", displayValue: "Process" },
            { displayName: "Material", displayValue: "FRP" },
            { displayName: "Area", displayValue: `${area} m²` },
            { displayName: "Length", displayValue: "6 m" },
            { displayName: "Volume", displayValue: `${volume} m³` },
          ],
        },
        {
          objectid: 102,
          name: "RO Vessel 8 inch B",
          properties: [
            { displayName: "Category", displayValue: "RO Membrane Vessel" },
            { displayName: "System", displayValue: "RO Unit 1" },
            { displayName: "Discipline", displayValue: "Process" },
            { displayName: "Material", displayValue: "FRP" },
            { displayName: "Area", displayValue: "17.5 m²" },
            { displayName: "Length", displayValue: "8 m" },
            { displayName: "Volume", displayValue: "5.25 m³" },
          ],
        },
      ],
    },
  };
}

function desalinationDictionaryPayload() {
  return {
    data: {
      collection: [
        {
          objectid: 301,
          name: "SWRO Pipe DN300",
          properties: [
            { displayName: "Part Type", displayValue: "Pipe" },
            { displayName: "Process Unit", displayValue: "RO 一段" },
            { displayName: "Discipline", displayValue: "管道" },
            { displayName: "Pipe Spec", displayValue: "2205 / DN300" },
            { displayName: "Line Length", displayValue: "6000 mm" },
            { displayName: "Weight", displayValue: "1.5 t" },
          ],
        },
        {
          objectid: 302,
          name: "Butterfly Valve DN300",
          properties: [
            { displayName: "Part Type", displayValue: "Valve" },
            { displayName: "Process Unit", displayValue: "RO 一段" },
            { displayName: "Discipline", displayValue: "管道" },
            { displayName: "Pipe Spec", displayValue: "2205 / DN300" },
            { displayName: "Weight", displayValue: "80 kg" },
          ],
        },
      ],
    },
  };
}

async function waitForQuantityTask(cookie, docId, taskId) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const payload = assertStatus(
      await request("GET", `/api/model-apps/quantity/documents/${encodeURIComponent(docId)}`, { cookie }),
      200,
      "get quantity payload",
    ).json;
    const task = payload.tasks.find((item) => item.id === taskId);
    if (task?.status === "succeeded") {
      return { task, payload };
    }
    if (task?.status === "failed") {
      throw new Error(`quantity task failed: ${task.error}`);
    }
    await delay(100);
  }
  throw new Error("quantity task did not complete");
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

  const templates = assertStatus(await request("GET", "/api/model-apps/quantity/templates", { cookie }), 200, "list templates").json.templates;
  assert.ok(templates.length > 0, "quantity module should provide a reusable default template");
  assert.equal(templates[0].name, "海水淡化工程量统计");
  assert.ok(templates[0].description.includes("系统/区域"), "default template should use desalination system/area dimensions");

  const config = {
    fields: ["Category", "System", "Discipline", "Material", "Area", "Length", "Volume"],
    groupBy: ["elementType", "floor", "discipline", "material"],
    filters: { floors: ["RO Unit 1"], disciplines: ["Process"] },
  };

  const firstJob = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(doc.id)}/extract`, {
      cookie,
      body: {
        config,
        propertiesPayload: quantityPayload(12.5, 3.75),
      },
    }),
    202,
    "enqueue first quantity extraction",
  ).json;
  const first = await waitForQuantityTask(cookie, doc.id, firstJob.task.id);
  assert.equal(first.task.snapshotCount, 2);
  assert.equal(first.payload.summaries.length, 1);
  assert.equal(first.payload.summaries[0].count, 2);
  assert.equal(first.payload.summaries[0].area, 30);
  assert.equal(first.payload.summaries[0].length, 14);
  assert.equal(first.payload.summaries[0].volume, 9);

  const secondJob = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(doc.id)}/extract`, {
      cookie,
      body: {
        config,
        propertiesPayload: quantityPayload(15, 4.5),
      },
    }),
    202,
    "enqueue second quantity extraction",
  ).json;
  const second = await waitForQuantityTask(cookie, doc.id, secondJob.task.id);

  const diff = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(doc.id)}/compare`, {
      cookie,
      body: { leftTaskId: first.task.id, rightTaskId: second.task.id },
    }),
    200,
    "compare quantity tasks",
  ).json.diff;
  assert.equal(diff.length, 1);
  assert.equal(diff[0].status, "changed");
  assert.equal(diff[0].areaDelta, 2.5);
  assert.equal(diff[0].volumeDelta, 0.75);

  const exported = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(doc.id)}/export`, {
      cookie,
      body: { taskId: second.task.id },
    }),
    200,
    "export quantity workbook",
  ).json;
  assert.ok(exported.downloadUrl.includes("/exports/"), "export should return a signed exports URL");
  const workbook = assertStatus(await request("GET", exported.downloadUrl, { cookie, binary: true }), 200, "download workbook").raw;
  assert.equal(workbook.slice(0, 2).toString("utf8"), "PK", "xlsx export should be a zip workbook");

  console.log("quantity takeoff API tests passed");
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
  const rawDoc = await createUploadedModelDocument(cookie);
  const notReady = await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(rawDoc.id)}/extract`, {
    cookie,
    body: {
      config: { groupBy: ["elementType"] },
    },
  });
  assert.equal(notReady.statusCode, 400, `not-ready model should be rejected: ${notReady.raw}`);
  assert.match(notReady.json.error || "", /转换|APS|ready/i);

  const doc = await createModelDocument(cookie);
  const rejected = await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(doc.id)}/extract`, {
    cookie,
    body: {
      config: { groupBy: ["elementType"] },
      propertiesPayload: quantityPayload(12.5, 3.75),
    },
  });
  assert.equal(rejected.statusCode, 400, `fixture payload should be rejected without test flag: ${rejected.raw}`);
  assert.match(rejected.json.error || "", /测试属性载荷|fixture/i);
}

async function runDuplicateQueueScenario() {
  const login = assertStatus(
    await request("POST", "/api/session/login", {
      body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
    }),
    200,
    "login for duplicate queue",
  );
  const cookie = sessionCookie(login);
  const doc = await createModelDocument(cookie);
  const config = {
    fields: ["Category", "System", "Discipline", "Material", "Area", "Length", "Volume"],
    groupBy: ["elementType", "floor", "discipline", "material"],
  };

  const firstJob = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(doc.id)}/extract`, {
      cookie,
      body: {
        config,
        propertiesPayload: quantityPayload(12.5, 3.75),
      },
    }),
    202,
    "enqueue duplicate guard first quantity extraction",
  ).json;

  const duplicateJob = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(doc.id)}/extract`, {
      cookie,
      body: {
        config,
        propertiesPayload: quantityPayload(15, 4.5),
      },
    }),
    202,
    "reuse active quantity extraction",
  ).json;

  assert.equal(duplicateJob.reused, true, "second extraction should reuse active task instead of creating another one");
  assert.equal(duplicateJob.task.id, firstJob.task.id, "duplicate request should return the active task");

  const completed = await waitForQuantityTask(cookie, doc.id, firstJob.task.id);
  assert.equal(completed.payload.tasks.filter((task) => task.documentId === doc.id).length, 1, "duplicate request should not create an extra task");
}

async function runProductionControlScenario() {
  const login = assertStatus(
    await request("POST", "/api/session/login", {
      body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
    }),
    200,
    "login for production controls",
  );
  const cookie = sessionCookie(login);
  const firstDoc = await createModelDocument(cookie);
  const secondDoc = await createModelDocument(cookie);
  const config = {
    fieldMappings: {
      elementType: ["Part Type"],
      floor: ["Process Unit"],
      discipline: ["Discipline"],
      material: ["Pipe Spec"],
      length: ["Line Length"],
      weight: ["Weight"],
    },
    fields: "*",
    groupBy: ["elementType", "floor", "discipline", "material"],
    metrics: {
      pipeLength: { label: "管线米数", kind: "sum", source: "length", unit: "m", appliesTo: { elementTypes: ["Pipe"] } },
      valveCount: { label: "阀门台数", kind: "count", unit: "台", appliesTo: { elementTypes: ["Valve"] } },
      equipmentWeight: { label: "设备重量", kind: "sum", source: "weight", unit: "kg" },
    },
  };

  const dictionary = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(firstDoc.id)}/property-dictionary`, {
      cookie,
      body: {
        config,
        propertiesPayload: desalinationDictionaryPayload(),
      },
    }),
    200,
    "scan property dictionary",
  ).json;
  assert.ok(dictionary.dictionary.fields.some((field) => field.name === "Process Unit" && field.count === 2));
  assert.equal(dictionary.dictionary.coverage.elementType.matched, 2);
  assert.equal(dictionary.dictionary.coverage.length.matched, 1);

  const queued = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(firstDoc.id)}/extract`, {
      cookie,
      body: {
        config,
        propertiesPayload: desalinationDictionaryPayload(),
      },
    }),
    202,
    "enqueue cancelable quantity extraction",
  ).json;

  const canceled = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(firstDoc.id)}/tasks/${encodeURIComponent(queued.task.id)}/cancel`, {
      cookie,
      body: { reason: "用户重新选择字段" },
    }),
    200,
    "cancel quantity extraction",
  ).json;
  assert.equal(canceled.task.status, "canceled");

  const retry = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(firstDoc.id)}/tasks/${encodeURIComponent(queued.task.id)}/retry`, {
      cookie,
      body: {
        propertiesPayload: desalinationDictionaryPayload(),
      },
    }),
    202,
    "retry canceled quantity extraction",
  ).json;
  const firstCompleted = await waitForQuantityTask(cookie, firstDoc.id, retry.task.id);
  assert.equal(firstCompleted.payload.summaries[0].metrics.pipeLength.value, 6);

  const secondJob = assertStatus(
    await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(secondDoc.id)}/extract`, {
      cookie,
      body: {
        config,
        propertiesPayload: quantityPayload(18, 5),
      },
    }),
    202,
    "enqueue second model quantity extraction",
  ).json;
  const secondCompleted = await waitForQuantityTask(cookie, secondDoc.id, secondJob.task.id);

  const crossDocumentDiff = assertStatus(
    await request("POST", "/api/model-apps/quantity/compare", {
      cookie,
      body: {
        leftTaskId: firstCompleted.task.id,
        rightTaskId: secondCompleted.task.id,
      },
    }),
    200,
    "cross-document quantity compare",
  ).json;
  assert.equal(crossDocumentDiff.leftTask.documentId, firstDoc.id);
  assert.equal(crossDocumentDiff.rightTask.documentId, secondDoc.id);
  assert.ok(crossDocumentDiff.diff.some((item) => item.status !== "unchanged"));
}

async function runWithServer(envPatch, scenario) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-quantity-api-"));
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

async function runRecoveryScenario() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-quantity-recovery-"));
  let output = "";
  let child = startServerProcess(dataDir, {
    CDE_ALLOW_QUANTITY_FIXTURE_PAYLOAD: "1",
    CDE_QUANTITY_TAKEOFF_JOB_START_DELAY_MS: "3000",
  });
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    await waitForServer(child);
    const login = assertStatus(
      await request("POST", "/api/session/login", {
        body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
      }),
      200,
      "login for recovery",
    );
    const cookie = sessionCookie(login);
    const doc = await createModelDocument(cookie);
    const queued = assertStatus(
      await request("POST", `/api/model-apps/quantity/documents/${encodeURIComponent(doc.id)}/extract`, {
        cookie,
        body: {
          config: {
            fields: ["Category", "System", "Discipline", "Material", "Area", "Length", "Volume"],
            groupBy: ["elementType", "floor", "discipline", "material"],
          },
          propertiesPayload: quantityPayload(12.5, 3.75),
        },
      }),
      202,
      "enqueue recoverable quantity extraction",
    ).json;
    await stopServer(child);

    child = startServerProcess(dataDir, {
      CDE_ALLOW_QUANTITY_FIXTURE_PAYLOAD: "1",
      CDE_QUANTITY_TAKEOFF_JOB_START_DELAY_MS: "0",
    });
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    await waitForServer(child);
    const secondLogin = assertStatus(
      await request("POST", "/api/session/login", {
        body: { email: "admin@cde.local", password: BOOTSTRAP_PASSWORD },
      }),
      200,
      "login after recovery",
    );
    const recovered = await waitForQuantityTask(sessionCookie(secondLogin), doc.id, queued.task.id);
    assert.equal(recovered.task.status, "succeeded");
    assert.equal(recovered.task.snapshotCount, 2);
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
  await runWithServer({ CDE_ALLOW_QUANTITY_FIXTURE_PAYLOAD: "1", CDE_QUANTITY_TAKEOFF_JOB_START_DELAY_MS: "500" }, runDuplicateQueueScenario);
  await runWithServer({ CDE_ALLOW_QUANTITY_FIXTURE_PAYLOAD: "1", CDE_QUANTITY_TAKEOFF_JOB_START_DELAY_MS: "1500" }, runProductionControlScenario);
  await runRecoveryScenario();
  await runWithServer({ CDE_ALLOW_QUANTITY_FIXTURE_PAYLOAD: "1" }, runScenario);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
