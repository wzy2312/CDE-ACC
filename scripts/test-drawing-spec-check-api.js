const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = Number(process.env.CDE_DRAWING_SPEC_CHECK_API_TEST_PORT || 19680 + Math.floor(Math.random() * 1000));
const BOOTSTRAP_PASSWORD = "drawing-spec-check-api-pass";

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
          resolve({ statusCode: res.statusCode, headers: res.headers, json: raw ? JSON.parse(raw) : {}, raw });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assertStatus(response, expected, label) {
  assert.equal(response.statusCode, expected, `${label}: ${response.statusCode} ${response.raw}`);
  return response;
}

function sessionCookie(response) {
  return (response.headers["set-cookie"]?.[0] || "").split(";")[0];
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`server exited with ${child.exitCode}`);
    }
    try {
      const response = await request("GET", "/healthz");
      if (response.statusCode === 200) return;
    } catch {
      await delay(100);
    }
  }
  throw new Error("server did not start");
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) return;
    await delay(50);
  }
  child.kill("SIGKILL");
}

async function createPdf(cookie, name, drawingMetadata = null) {
  const fixture = Buffer.from(`fixture:${name}`, "utf8");
  const body = {
    name,
    mimeType: "application/pdf",
    size: fixture.length,
    dataBase64: fixture.toString("base64"),
    actor: "Admin",
  };
  if (drawingMetadata) {
    body.drawingMetadata = drawingMetadata;
  }
  return assertStatus(
    await request("POST", "/api/documents", { cookie, body }),
    201,
    `create ${name}`,
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

  const specDoc = await createPdf(cookie, "P-001A_Centrifugal_Pump_Datasheet_RevC.pdf");
  const drawingDoc = await createPdf(cookie, "PID-1001_RO_Feed_Pumps_RevB.pdf", {
    markedAsDrawing: true,
    drawingNumber: "PID-1001",
    drawingName: "RO Feed Pumps P&ID",
    discipline: "Process",
    revision: "Rev.B",
  });

  const registered = assertStatus(
    await request("POST", "/api/drawing-apps/spec-check/specs", {
      cookie,
      body: {
        fileId: specDoc.id,
        documentType: "Equipment Datasheet",
        tagNumber: "P-001A",
        equipmentType: "Centrifugal Pump",
        discipline: "Process",
        version: "Rev.C",
        status: "current",
        linkedDrawingIds: [drawingDoc.id],
        parameters: [
          { name: "Design Pressure", value: "10", unit: "barg", page: 3, position: { x: 0.18, y: 0.24, width: 0.18, height: 0.05 }, confidence: "high", source: "text_layer" },
          { name: "Flow Rate", value: "150", unit: "m3/h", page: 4, position: { x: 0.2, y: 0.36, width: 0.16, height: 0.05 }, confidence: "high", source: "text_layer" },
          { name: "Shell Material", value: "Duplex SS 2205", page: 5, position: { x: 0.22, y: 0.44, width: 0.2, height: 0.05 }, confidence: "high", source: "text_layer" },
          { name: "Nozzle N1 Size", value: "DN150", page: 6, position: { x: 0.24, y: 0.5, width: 0.16, height: 0.05 }, confidence: "high", source: "text_layer" },
          { name: "Design Standard", value: "ASME VIII-2019", page: 7, position: { x: 0.24, y: 0.58, width: 0.2, height: 0.05 }, confidence: "high", source: "text_layer" },
        ],
      },
    }),
    201,
    "register spec",
  ).json;
  assert.equal(registered.specEntry.tagNumber, "P-001A");
  assert.equal(registered.specVersion.isCurrent, true);
  assert.equal(registered.parameters.length, 5);
  assert.equal(registered.links.length, 1);

  const inferredSpecDoc = await createPdf(cookie, "E-101_Heat_Exchanger_Datasheet_RevB.pdf");
  const inferredSpec = assertStatus(
    await request("POST", "/api/drawing-apps/spec-check/specs", {
      cookie,
      body: {
        fileId: inferredSpecDoc.id,
        documentType: "Equipment Datasheet",
        discipline: "Process",
        version: "Rev.B",
        status: "current",
      },
    }),
    201,
    "register spec with inferred metadata",
  ).json;
  assert.equal(inferredSpec.specEntry.tagNumber, "E-101");
  assert.equal(inferredSpec.specEntry.equipmentType, "Heat Exchanger");

  const extracted = assertStatus(
    await request("POST", `/api/drawing-apps/spec-check/drawings/${encodeURIComponent(drawingDoc.id)}/extract`, {
      cookie,
      body: {
        drawingVersionId: drawingDoc.currentVersionId,
        parameters: [
          { tagNumber: "P-001A", name: "Design Pressure", value: "0.95", unit: "MPag", page: 1, position: { x: 0.42, y: 0.34, width: 0.1, height: 0.04 }, confidence: "high", source: "line_annotation" },
          { tagNumber: "P-001A", name: "Flow Rate", value: "120", unit: "m3/h", page: 1, position: { x: 0.48, y: 0.4, width: 0.1, height: 0.04 }, confidence: "high", source: "equipment_note" },
          { tagNumber: "P-001A", name: "Shell Material", value: "UNS S31803", page: 1, position: { x: 0.52, y: 0.44, width: 0.12, height: 0.04 }, confidence: "high", source: "equipment_table" },
          { tagNumber: "P-001A", name: "Nozzle N1 Size", value: "DN100", page: 1, position: { x: 0.58, y: 0.48, width: 0.1, height: 0.04 }, confidence: "high", source: "nozzle_callout" },
          { tagNumber: "P-001A", name: "Design Standard", value: "ASME VIII-2021", page: 1, position: { x: 0.6, y: 0.52, width: 0.12, height: 0.04 }, confidence: "medium", source: "general_note" },
          { tagNumber: "P-001A", name: "Operating Temperature", value: "95", unit: "°C", page: 1, position: { x: 0.62, y: 0.56, width: 0.12, height: 0.04 }, confidence: "low", source: "ambiguous_note" },
        ],
      },
    }),
    201,
    "extract drawing parameters",
  ).json;
  assert.equal(extracted.parameters.length, 6);

  const compared = assertStatus(
    await request("POST", "/api/drawing-apps/spec-check/compare", {
      cookie,
      body: {
        tagNumber: "P-001A",
        specVersionId: registered.specVersion.id,
        drawingVersionIds: [drawingDoc.currentVersionId],
      },
    }),
    201,
    "compare spec and drawing",
  ).json;
  assert.equal(compared.task.tagNumber, "P-001A");
  assert.equal(compared.task.status, "completed");
  assert.equal(compared.results.length, 6);
  assert.equal(compared.report.summary.errorCount, 1);
  assert.equal(compared.report.summary.warningCount, 2);
  assert.equal(compared.report.summary.pendingCount, 1);
  assert.equal(compared.report.summary.passCount, 2);

  const byName = new Map(compared.results.map((item) => [item.paramName, item]));
  assert.equal(byName.get("Design Pressure").status, "passed", "0.95 MPag should pass against 10 barg within pressure tolerance");
  assert.equal(byName.get("Design Pressure").diffPct, 5);
  assert.equal(byName.get("Shell Material").status, "passed", "material synonym should pass");
  assert.equal(byName.get("Flow Rate").level, "warning");
  assert.equal(byName.get("Flow Rate").diffPct, -20);
  assert.equal(byName.get("Nozzle N1 Size").level, "error");
  assert.equal(byName.get("Design Standard").level, "warning");
  assert.equal(byName.get("Operating Temperature").level, "pending", "low confidence fields should require confirmation");

  const vendorSpecDoc = await createPdf(cookie, "P-001A_Centrifugal_Pump_Vendor_Datasheet_RevB.pdf");
  const registeredVendor = assertStatus(
    await request("POST", "/api/drawing-apps/spec-check/specs", {
      cookie,
      body: {
        fileId: vendorSpecDoc.id,
        documentType: "Material Requisition",
        tagNumber: "P-001A",
        equipmentType: "Centrifugal Pump",
        discipline: "Vendor",
        version: "Rev.B",
        status: "current",
        linkedDrawingIds: [drawingDoc.id],
        parameters: [
          { name: "Design Pressure", value: "0.95", unit: "MPag", page: 2, position: { x: 0.16, y: 0.24, width: 0.18, height: 0.05 }, confidence: "high", source: "vendor_table" },
          { name: "Flow Rate", value: "120", unit: "m3/h", page: 2, position: { x: 0.2, y: 0.36, width: 0.16, height: 0.05 }, confidence: "high", source: "vendor_table" },
          { name: "Shell Material", value: "UNS S31803", page: 2, position: { x: 0.22, y: 0.44, width: 0.2, height: 0.05 }, confidence: "high", source: "vendor_table" },
          { name: "Nozzle N1 Size", value: "DN100", page: 2, position: { x: 0.24, y: 0.5, width: 0.16, height: 0.05 }, confidence: "high", source: "vendor_table" },
          { name: "Design Standard", value: "ASME VIII-2021", page: 2, position: { x: 0.24, y: 0.58, width: 0.2, height: 0.05 }, confidence: "high", source: "vendor_table" },
        ],
      },
    }),
    201,
    "register vendor spec",
  ).json;
  assert.equal(registeredVendor.specEntry.tagNumber, "P-001A");
  assert.notEqual(registeredVendor.specEntry.id, registered.specEntry.id, "different spec document types should be maintained as separate specs");

  const batchCompared = assertStatus(
    await request("POST", "/api/drawing-apps/spec-check/compare", {
      cookie,
      body: {
        specVersionIds: [registered.specVersion.id, registeredVendor.specVersion.id],
        drawingVersionIds: [drawingDoc.currentVersionId],
      },
    }),
    201,
    "compare multiple specs and drawing",
  ).json;
  assert.equal(batchCompared.batch.taskCount, 2);
  assert.deepEqual(new Set(batchCompared.batch.specVersionIds), new Set([registered.specVersion.id, registeredVendor.specVersion.id]));
  assert.equal(batchCompared.results.length, 12);
  assert.deepEqual(new Set(batchCompared.results.map((item) => item.specVersionId)), new Set([registered.specVersion.id, registeredVendor.specVersion.id]));

  const issuePayload = assertStatus(
    await request("POST", `/api/drawing-apps/spec-check/results/${encodeURIComponent(byName.get("Nozzle N1 Size").id)}/issue`, {
      cookie,
      body: { actor: "Admin" },
    }),
    201,
    "create spec mismatch issue",
  ).json;
  assert.equal(issuePayload.created, true);
  assert.equal(issuePayload.result.issueLink.type, "pdf_annotation");
  assert.equal(issuePayload.result.issueLink.source, "drawing_spec_check");
  assert.ok(issuePayload.result.annotationId, "result should retain annotation id");
  assert.ok(issuePayload.document.annotations.some((item) => item.id === issuePayload.result.annotationId), "drawing should include created annotation");

  const home = assertStatus(await request("GET", "/api/drawing-apps/spec-check", { cookie }), 200, "spec check home").json;
  assert.equal(home.specEntries.length, 3);
  assert.equal(home.summary.totalSpecs, 3);
  assert.equal(home.summary.openIssueCount, 1);
  assert.ok(home.traceability.some((item) => item.tagNumber === "P-001A" && item.drawingCount === 1));
  assert.ok(home.dictionaries.materialSynonyms.some((group) => group.includes("UNS S31803")));

  console.log("drawing spec-check API tests passed");
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-drawing-spec-check-api-"));
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
    if (output.trim()) console.error(output.trim());
    throw error;
  } finally {
    await stopServer(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
