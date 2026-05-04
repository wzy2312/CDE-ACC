const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = 19496;
const BOOTSTRAP_PASSWORD = "model-clash-api-pass";

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

async function createModelDocument(cookie, name, geometryIndex) {
  const fixture = Buffer.from(`model:${name}`, "utf8");
  const created = assertStatus(
    await request("POST", "/api/documents", {
      cookie,
      body: {
        name,
        mimeType: "application/octet-stream",
        size: fixture.length,
        dataBase64: fixture.toString("base64"),
        actor: "管理员",
      },
    }),
    201,
    `create ${name}`,
  ).json.document;

  return assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(created.id)}/aps`, {
      cookie,
      body: {
        aps: {
          urn: `urn:${created.id}`,
          translationStatus: "success",
          viewable3dGuid: `${created.id}-3d`,
          geometryIndex,
        },
      },
    }),
    200,
    `patch APS ${name}`,
  ).json.document;
}

async function createTranslatedModelDocument(cookie, name) {
  const fixture = Buffer.from(`model:${name}`, "utf8");
  const created = assertStatus(
    await request("POST", "/api/documents", {
      cookie,
      body: {
        name,
        mimeType: "application/octet-stream",
        size: fixture.length,
        dataBase64: fixture.toString("base64"),
        actor: "管理员",
      },
    }),
    201,
    `create ${name}`,
  ).json.document;

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
    `patch translated APS ${name}`,
  ).json.document;
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

  const structure = await createModelDocument(cookie, "structure-test.rvt", [
    {
      dbId: 101,
      name: "Wall S-101",
      discipline: "structure",
      boundingBox: { min: [0, 0, 0], max: [2, 2, 2] },
    },
  ]);
  const pipe = await createModelDocument(cookie, "pipe-test.ifc", [
    {
      dbId: 201,
      name: "Pipe P-201",
      discipline: "mep",
      boundingBox: { min: [1.5, 0.5, 0.5], max: [2.5, 1, 1] },
    },
  ]);

  const runResponse = assertStatus(
    await request("POST", "/api/model-apps/clash/run", {
      cookie,
      body: {
        documentIds: [structure.id, pipe.id],
        rule: {
          tolerance: 0,
          ignoreSameDiscipline: true,
          disciplinePairs: [["structure", "mep"]],
          responsibilityMap: { "structure:mep": "mep" },
        },
        heatmap: {
          gridSize: 0.5,
          topN: 5,
        },
      },
    }),
    201,
    "run clash detection",
  ).json;

  assert.equal(runResponse.run.status, "succeeded");
  assert.equal(runResponse.records.length, 1);
  const [record] = runResponse.records;
  assert.equal(record.modelUrnA, structure.aps.urn);
  assert.equal(record.dbIdA, 101);
  assert.equal(record.modelUrnB, pipe.aps.urn);
  assert.equal(record.dbIdB, 201);
  assert.equal(record.status, "open");
  assert.ok(record.issueId, "clash record should link a generated issue");
  assert.equal(runResponse.heatmap.task.clashTaskId, runResponse.run.id);
  assert.equal(runResponse.heatmap.task.gridSize, 0.5);
  assert.equal(runResponse.heatmap.cells.length, 1);
  assert.equal(runResponse.heatmap.cells[0].density, 1);
  assert.equal(runResponse.heatmap.hotspots.length, 1);
  assert.equal(runResponse.heatmap.hotspots[0].openIssueCount, 1);
  assert.equal(runResponse.heatmap.matrix.counts.mep.structure, 1);

  const records = assertStatus(await request("GET", "/api/model-apps/clash/records", { cookie }), 200, "list records").json.records;
  assert.ok(records.some((item) => item.id === record.id), "created record should be listed");
  const heatmaps = assertStatus(
    await request("GET", `/api/model-apps/clash/heatmaps?runId=${encodeURIComponent(runResponse.run.id)}`, { cookie }),
    200,
    "list heatmaps",
  ).json.heatmaps;
  assert.equal(heatmaps.length, 1);
  assert.equal(heatmaps[0].id, runResponse.heatmap.task.id);
  const heatmapDetail = assertStatus(
    await request("GET", `/api/model-apps/clash/heatmaps/${encodeURIComponent(runResponse.heatmap.task.id)}`, { cookie }),
    200,
    "heatmap detail",
  ).json;
  assert.equal(heatmapDetail.cells.length, 1);
  assert.equal(heatmapDetail.hotspots.length, 1);
  const matrixExport = assertStatus(
    await request("POST", `/api/model-apps/clash/heatmaps/${encodeURIComponent(runResponse.heatmap.task.id)}/export`, {
      cookie,
      body: { kind: "matrix" },
    }),
    200,
    "export heatmap matrix",
  ).json;
  assert.match(matrixExport.downloadUrl, /\.xlsx\?/);
  const packageExport = assertStatus(
    await request("POST", `/api/model-apps/clash/heatmaps/${encodeURIComponent(runResponse.heatmap.task.id)}/export`, {
      cookie,
      body: { kind: "package" },
    }),
    200,
    "export heatmap package",
  ).json;
  assert.match(packageExport.downloadUrl, /\.zip\?/);

  const docsAfterRun = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after run").json.documents;
  const structureAfterRun = docsAfterRun.find((doc) => doc.id === structure.id);
  const issue = structureAfterRun.annotations.find((annotation) => annotation.id === record.issueId);
  assert.ok(issue, "generated issue should be attached to the base model document");
  assert.equal(issue.status, "open");
  assert.deepEqual(issue.dbIds, [101, 201]);

  const resolved = assertStatus(
    await request("PATCH", `/api/model-apps/clash/records/${encodeURIComponent(record.id)}`, {
      cookie,
      body: { status: "resolved" },
    }),
    200,
    "resolve clash record",
  ).json.record;
  assert.equal(resolved.status, "resolved");

  const docsAfterResolve = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after resolve").json.documents;
  const resolvedIssue = docsAfterResolve
    .find((doc) => doc.id === structure.id)
    .annotations.find((annotation) => annotation.id === record.issueId);
  assert.equal(resolvedIssue.status, "resolved");

  const matrixBase = await createModelDocument(cookie, "matrix-base.rvt", [
    {
      dbId: 501,
      name: "Matrix Base",
      discipline: "structure",
      boundingBox: { min: [0, 0, 0], max: [1, 1, 1] },
    },
  ]);
  const matrixMoved = await createModelDocument(cookie, "matrix-moved.ifc", [
    {
      dbId: 601,
      name: "Matrix Moved",
      discipline: "mep",
      boundingBox: { min: [2, 0, 0], max: [3, 1, 1] },
    },
  ]);
  assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(matrixMoved.id)}/aps`, {
      cookie,
      body: {
        aps: {
          transform: {
            matrix: [
              1, 0, 0, -1.5,
              0, 1, 0, 0,
              0, 0, 1, 0,
              0, 0, 0, 1,
            ],
          },
        },
      },
    }),
    200,
    "patch matrix transform",
  );
  const matrixRun = assertStatus(
    await request("POST", "/api/model-apps/clash/run", {
      cookie,
      body: {
        documentIds: [matrixBase.id, matrixMoved.id],
        rule: {
          tolerance: 0,
          ignoreSameDiscipline: true,
          disciplinePairs: [["structure", "mep"]],
        },
      },
    }),
    201,
    "run clash detection with matrix transform",
  ).json;
  assert.equal(matrixRun.records.length, 1);
  assert.equal(matrixRun.records[0].dbIdA, 501);
  assert.equal(matrixRun.records[0].dbIdB, 601);

  const extractedStructure = await createTranslatedModelDocument(cookie, "extracted-structure.rvt");
  const extractedPipe = await createTranslatedModelDocument(cookie, "extracted-pipe.ifc");
  const extractionRun = assertStatus(
    await request("POST", "/api/model-apps/clash/run", {
      cookie,
      body: {
        documentIds: [extractedStructure.id, extractedPipe.id],
        geometryPayloads: {
          [extractedStructure.id]: {
            data: {
              collection: [
                {
                  objectid: 301,
                  name: "Extracted Wall",
                  properties: [
                    { displayName: "UniqueId", displayValue: "extract-wall-301" },
                    { displayName: "Category", displayValue: "Structural Walls" },
                    { displayName: "Bounding Box Min", displayValue: "0, 0, 0" },
                    { displayName: "Bounding Box Max", displayValue: "2, 2, 2" },
                  ],
                },
              ],
            },
          },
          [extractedPipe.id]: {
            data: {
              collection: [
                {
                  objectid: 401,
                  name: "Extracted Pipe",
                  properties: [
                    { displayName: "GUID", displayValue: "extract-pipe-401" },
                    { displayName: "System Classification", displayValue: "MEP" },
                    { displayName: "Bounding Box Min", displayValue: "1, 1, 1" },
                    { displayName: "Bounding Box Max", displayValue: "3, 1.4, 1.4" },
                  ],
                },
              ],
            },
          },
        },
        rule: {
          tolerance: 0,
          ignoreSameDiscipline: true,
          disciplinePairs: [["structure", "mep"]],
        },
      },
    }),
    201,
    "run clash detection with on-demand geometry extraction",
  ).json;
  assert.equal(extractionRun.records.length, 1);
  assert.ok(extractionRun.geometryExtractions?.every((item) => item.summary.indexedElements === 1));

  const docsAfterExtraction = assertStatus(await request("GET", "/api/documents", { cookie }), 200, "documents after geometry extraction").json.documents;
  const persistedStructure = docsAfterExtraction.find((doc) => doc.id === extractedStructure.id);
  assert.equal(persistedStructure.aps.geometryIndex.length, 1);
  assert.equal(persistedStructure.aps.elementIndex[0].elementUniqueId, "extract-wall-301");

  const fallbackModel = await createTranslatedModelDocument(cookie, "obj-fallback-pipe.ifc");
  const fallbackExtraction = assertStatus(
    await request("POST", `/api/documents/${encodeURIComponent(fallbackModel.id)}/aps/geometry/extract`, {
      cookie,
      body: {
        propertiesPayload: {
          data: {
            collection: [
              {
                objectid: 901,
                name: "Fallback Pipe",
                properties: [
                  { displayName: "GUID", displayValue: "fallback-pipe-901" },
                  { displayName: "System Classification", displayValue: "MEP" },
                ],
              },
            ],
          },
        },
        objPayloads: [
          {
            derivativeUrn: "urn:adsk.viewing:fs.file:fallback/901.obj",
            objectIds: [901],
            objText: [
              "v 0 0 0",
              "v 2 0 0",
              "v 0 2 0",
              "f 1 2 3",
            ].join("\n"),
          },
        ],
      },
    }),
    200,
    "extract geometry with OBJ fallback",
  ).json;
  assert.equal(fallbackExtraction.extraction.summary.indexedElements, 1);
  assert.equal(fallbackExtraction.extraction.summary.meshElementCount, 1);
  assert.match(fallbackExtraction.extraction.task.source, /obj/);
  assert.equal(fallbackExtraction.document.aps.geometryIndex[0].dbId, 901);
  assert.deepEqual(fallbackExtraction.document.aps.geometryIndex[0].boundingBox.max, [2, 2, 0]);
  assert.deepEqual(fallbackExtraction.document.aps.geometryIndex[0].mesh.triangles, [0, 1, 2]);

  const taskList = assertStatus(
    await request("GET", `/api/documents/${encodeURIComponent(fallbackModel.id)}/aps/geometry/extractions`, { cookie }),
    200,
    "list geometry extraction tasks",
  ).json.tasks;
  assert.ok(taskList.some((task) => task.id === fallbackExtraction.extraction.task.id && task.meshCount === 1 && task.status === "succeeded"));

  console.log("model clash API tests passed");
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-model-clash-api-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      CDE_ALLOW_MODEL_GEOMETRY_FIXTURE_PAYLOAD: "1",
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
