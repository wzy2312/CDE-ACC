const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = 19496;
const BOOTSTRAP_PASSWORD = "model-health-api-pass";

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

async function createTranslatedModel(cookie) {
  const fixture = Buffer.from("model-health-test", "utf8");
  const created = assertStatus(
    await request("POST", "/api/documents", {
      cookie,
      body: {
        name: `health-structure-${Date.now()}.rvt`,
        mimeType: "application/octet-stream",
        size: fixture.length,
        dataBase64: fixture.toString("base64"),
        actor: "管理员",
      },
    }),
    201,
    "create model document",
  ).json.document;

  return assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(created.id)}/aps`, {
      cookie,
      body: {
        aps: {
          urn: `urn:${created.id}`,
          translationStatus: "success",
          viewable3dGuid: `${created.id}-3d`,
          geometryIndex: [
            { dbId: 101, name: "Beam A", discipline: "structure", boundingBox: { min: [0, 0, 0.2], max: [6, 0.3, 0.65] } },
            { dbId: 102, name: "Beam Bad", discipline: "structure", boundingBox: { min: [0, 1, 0.2], max: [0, 1, 0.2] } },
            { dbId: 201, name: "Pump A", discipline: "mep", boundingBox: { min: [10, 0, 0.2], max: [11, 1, 1.8] } },
            { dbId: 202, name: "Pump B", discipline: "mep", boundingBox: { min: [10, 0, 0.2], max: [11, 1, 1.8] } },
          ],
        },
      },
    }),
    200,
    "patch model APS",
  ).json.document;
}

async function waitForHealthTask(cookie, documentId, taskId) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const payload = assertStatus(
      await request("GET", `/api/model-apps/health/documents/${encodeURIComponent(documentId)}`, { cookie }),
      200,
      "model health document",
    ).json;
    const task = payload.tasks.find((item) => item.id === taskId);
    if (task && ["completed", "failed"].includes(task.status)) {
      return payload;
    }
    await delay(100);
  }
  throw new Error("model health task did not finish");
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
  const model = await createTranslatedModel(cookie);

  const healthHome = assertStatus(await request("GET", "/api/model-apps/health", { cookie }), 200, "model health home").json;
  assert.ok(healthHome.rulesets.length >= 4, "built-in rulesets should be available");
  ["Plant 3D 工艺模型健康度模板", "Revit 建筑模型健康度模板", "Revit 结构模型健康度模板"].forEach((legacyName) => {
    assert.ok(!healthHome.rulesets.some((item) => item.name === legacyName), `${legacyName} should not be exposed`);
  });
  assert.ok(
    !healthHome.rulesets.some((item) => item.builtIn && ["architecture", "structure", "plant3d"].includes(item.discipline)),
    "legacy generic built-in health templates should be removed",
  );
  const desalinationRuleset = healthHome.rulesets.find((item) => item.rules?.templateProfile?.id === "DESAL-EPC-EN-v1.0");
  assert.ok(desalinationRuleset, "desalination project health template should be available");
  assert.equal(desalinationRuleset.discipline, "desalination");
  assert.equal(desalinationRuleset.name, "Desalination Plant EPC Model Health Check Ruleset");
  assert.equal(desalinationRuleset.rules.templateProfile.projectType, "Seawater Desalination Plant");
  assert.equal(desalinationRuleset.gateConfig.minScoreToSubmit, 60);
  assert.equal(desalinationRuleset.gateConfig.requireWarningDisposition, false);
  assert.ok(desalinationRuleset.rules.requiredFields.Pipe.includes("Line Number"), "desalination pipe checks should require line number");
  assert.ok(desalinationRuleset.rules.requiredFields.ElectricalEquipment.includes("Voltage Level"), "electrical equipment checks should require voltage level");
  assert.match(desalinationRuleset.rules.namingRules.lineNumber, /^\^\[A-Z\]/, "desalination line number naming pattern should be retained");
  assert.ok(desalinationRuleset.rules.allowedSystems.includes("RO Permeate"), "fluid service allowlist should include RO Permeate");
  assert.equal(desalinationRuleset.rules.templateDisciplines.length, 4, "desalination template should expose four discipline summaries");
  assert.equal(desalinationRuleset.rules.crossDisciplineChecks.length, 5, "cross-discipline checks should be exposed");
  assert.equal(desalinationRuleset.rules.aiChecks.checks.length, 7, "AI checks should match EPC template");
  assert.ok(desalinationRuleset.rules.projectSpecificNotes.some((note) => note.includes("Duplex SS")), "project-specific material notes should be exposed");
  const disciplineTemplates = [
    ["DESAL-CIVIL-EN-v1.0", "civil", "Civil & Structural Model Health Check"],
    ["DESAL-PROCESS-EN-v1.0", "process", "Process & Piping Model Health Check"],
    ["DESAL-ELEC-EN-v1.0", "electrical", "Electrical Model Health Check"],
    ["DESAL-HVAC-EN-v1.0", "hvac", "HVAC Model Health Check"],
  ].map(([templateId, discipline, name]) => {
    const ruleset = healthHome.rulesets.find((item) => item.rules?.templateProfile?.id === templateId);
    assert.ok(ruleset, `${templateId} professional template should be available`);
    assert.equal(ruleset.discipline, discipline);
    assert.equal(ruleset.name, name);
    assert.equal(ruleset.gateConfig.minScoreToSubmit, 60);
    assert.equal(ruleset.gateConfig.requireWarningDisposition, false);
    assert.equal(ruleset.rules.templateDisciplines.length, 1, `${templateId} should expose one discipline summary`);
    assert.ok(Object.keys(ruleset.rules.requiredFields).length >= 2, `${templateId} should include element type rules`);
    return ruleset;
  });
  const civilRuleset = disciplineTemplates[0];
  assert.ok(civilRuleset.rules.requiredFields.StructuralTruss.includes("Span"), "civil template should include StructuralTruss span checks");
  assert.ok(civilRuleset.rules.requiredFields.Door.includes("Door Type"), "civil template should include door checks");
  assert.equal(civilRuleset.rules.aiChecks.checks.length, 5, "civil AI checks should match discipline template");
  assert.ok(civilRuleset.rules.allowedWorksets.includes("Structural - Trusses"), "civil workset allowlist should be retained");
  const processRuleset = disciplineTemplates[1];
  assert.ok(processRuleset.rules.requiredFields.Pipe.includes("Stress Analysis Required"), "process pipe checks should include stress analysis flag");
  assert.ok(processRuleset.rules.allowedSystems.includes("RO High Pressure"), "process fluid service allowlist should include RO High Pressure");
  assert.equal(processRuleset.rules.aiChecks.checks.length, 8, "process AI checks should match discipline template");
  const electricalRuleset = disciplineTemplates[2];
  assert.ok(electricalRuleset.rules.requiredFields.ElectricalEquipment.includes("Fault Level (kA)"), "electrical equipment checks should include fault level");
  assert.ok(electricalRuleset.rules.requiredFields.Conduit.includes("Conduit Type"), "electrical template should include conduit checks");
  assert.equal(electricalRuleset.rules.aiChecks.checks.length, 5, "electrical AI checks should match discipline template");
  const hvacRuleset = disciplineTemplates[3];
  assert.ok(hvacRuleset.rules.requiredFields.DuctSystem.includes("System Name"), "HVAC template should include ductwork checks");
  assert.ok(hvacRuleset.rules.requiredFields.MechanicalEquipment.includes("Corrosion Protection"), "HVAC template should include corrosion protection checks");
  assert.ok(healthHome.documents.some((item) => item.id === model.id), "translated model should be health-check candidate");

  const customRuleset = assertStatus(
    await request("POST", "/api/model-apps/health/rulesets", {
      cookie,
      body: {
        name: "健康度 API 测试规则集",
        discipline: "structure",
        rules: {
          requiredFields: {
            "结构梁": ["Material", "Level", "Height"],
            "设备": ["Tag Number", "Equipment Type", "Level"],
          },
          namingRules: {
            name: "^(B|P)-[A-Z0-9-]+$",
            tag: "^P-\\d{3}-\\d{3}$",
          },
          allowedSystems: ["给排水"],
          allowedWorksets: ["结构", "设备"],
          levels: [{ name: "L01", min: 0, max: 4 }],
          geometryLimits: {
            "结构梁": {
              Height: { min: 300, max: 1200 },
              Length: { min: 1, max: 20000 },
              Volume: { min: 0.001, max: 1000 },
            },
          },
        },
        gateConfig: {
          mode: "standard",
          aiEnabled: true,
          requireWarningDisposition: true,
          requireAiDisposition: true,
        },
      },
    }),
    201,
    "create health ruleset",
  ).json.ruleset;

  const propertiesPayload = {
    data: {
      collection: [
        {
          objectid: 101,
          name: "B-L01-001",
          properties: [
            { displayName: "Category", displayValue: "结构梁" },
            { displayName: "Level", displayValue: "L01" },
            { displayName: "Material", displayValue: "C30" },
            { displayName: "Height", displayValue: "450mm" },
            { displayName: "Length", displayValue: "6000mm" },
            { displayName: "Volume", displayValue: "1.5" },
            { displayName: "Workset", displayValue: "结构" },
          ],
        },
        {
          objectid: 102,
          name: "bad beam temp",
          properties: [
            { displayName: "Category", displayValue: "结构梁" },
            { displayName: "Level", displayValue: "L01" },
            { displayName: "Height", displayValue: "200mm" },
            { displayName: "Length", displayValue: "0mm" },
            { displayName: "Volume", displayValue: "0" },
            { displayName: "Workset", displayValue: "临时" },
            { displayName: "Comments", displayValue: "TEST 临时，勿删" },
          ],
        },
        {
          objectid: 201,
          name: "P-100-001",
          properties: [
            { displayName: "Category", displayValue: "设备" },
            { displayName: "Equipment Type", displayValue: "泵" },
            { displayName: "Tag Number", displayValue: "P-100-001" },
            { displayName: "Level", displayValue: "L01" },
            { displayName: "System Name", displayValue: "给排水" },
            { displayName: "Workset", displayValue: "设备" },
          ],
        },
        {
          objectid: 202,
          name: "P-100-002",
          properties: [
            { displayName: "Category", displayValue: "设备" },
            { displayName: "Equipment Type", displayValue: "泵" },
            { displayName: "Tag Number", displayValue: "P-100-001" },
            { displayName: "Level", displayValue: "L01" },
            { displayName: "System Name", displayValue: "结构" },
            { displayName: "Workset", displayValue: "设备" },
          ],
        },
      ],
    },
  };

  const run = assertStatus(
    await request("POST", "/api/model-apps/health/run", {
      cookie,
      body: {
        documentIds: [model.id],
        rulesetId: customRuleset.id,
        propertiesPayloads: {
          [model.id]: propertiesPayload,
        },
      },
    }),
    202,
    "run model health check",
  ).json;
  assert.equal(run.tasks.length, 1);
  assert.ok(["queued", "checking", "ai_analyzing"].includes(run.tasks[0].status));

  const detail = await waitForHealthTask(cookie, model.id, run.tasks[0].id);
  const task = detail.tasks.find((item) => item.id === run.tasks[0].id);
  assert.equal(task.status, "completed");
  assert.ok(task.score < 100);
  assert.ok(detail.ruleResults.some((item) => item.category === "required" && item.level === "error"));
  assert.ok(detail.ruleResults.some((item) => item.category === "duplicate"));
  assert.ok(detail.aiResults.some((item) => item.category === "semantic"));
  assert.equal(detail.gate.status, "blocked");
  assert.ok(detail.report.comparison === null);

  const templates = assertStatus(await request("GET", "/api/workflow-templates", { cookie }), 200, "workflow templates").json.workflowTemplates;
  const templateId = templates[0]?.id;
  assert.ok(templateId, "expected a workflow template");
  const blockedWorkflow = await request("POST", "/api/workflows", {
    cookie,
    body: {
      workflowName: `Blocked health workflow ${Date.now()}`,
      templateId,
      fileIds: [model.id],
      actor: "管理员",
    },
  });
  assert.equal(blockedWorkflow.statusCode, 409, `expected health gate to block workflow, received ${blockedWorkflow.statusCode}: ${blockedWorkflow.raw}`);
  assert.equal(blockedWorkflow.json.detail?.status, "blocked");

  const aiResult = detail.aiResults.find((item) => item.category === "semantic");
  const feedback = assertStatus(
    await request("PATCH", `/api/model-apps/health/ai-results/${encodeURIComponent(aiResult.id)}/feedback`, {
      cookie,
      body: {
        feedbackStatus: "false_positive",
        reason: "该条为测试模型的已知占位，不影响本次流程。",
        actor: "管理员",
      },
    }),
    200,
    "mark AI false positive",
  ).json;
  assert.equal(feedback.aiResult.feedbackStatus, "false_positive");
  assert.ok(feedback.falsePositiveRecord.id);

  const forcedWorkflow = assertStatus(
    await request("POST", "/api/workflows", {
      cookie,
      body: {
        workflowName: `Forced health workflow ${Date.now()}`,
        templateId,
        fileIds: [model.id],
        actor: "管理员",
        healthGateOverride: {
          reason: "生产联调测试强制放行，问题已登记到模型健康度报告。",
          exemptResultIds: [...detail.ruleResults.slice(0, 3).map((item) => item.id), aiResult.id],
        },
      },
    }),
    201,
    "force health gate workflow",
  ).json.workflow;
  assert.equal(forcedWorkflow.status, "running");
  assert.ok(forcedWorkflow.healthGateOverrides?.length >= 1, "workflow should retain health gate override marker");

  console.log("model health API tests passed");
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-model-health-api-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      CDE_ALLOW_MODEL_HEALTH_FIXTURE_PAYLOAD: "1",
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
  console.error(error.message || error);
  process.exit(1);
});
