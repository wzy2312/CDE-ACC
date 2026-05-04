const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = Number(process.env.CDE_CONSTRUCTION_SCHEDULE_API_TEST_PORT || 20730 + Math.floor(Math.random() * 1000));
const BOOTSTRAP_PASSWORD = "schedule-api-pass";

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
        if (!binary) res.setEncoding("utf8");
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          const raw = binary ? Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))) : chunks.join("");
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            json: !binary && raw ? JSON.parse(raw) : {},
            raw,
          });
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
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
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

function startServerProcess(dataDir) {
  return spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT,
      CDE_DATA_DIR: dataDir,
      CDE_BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
      CDE_ALLOW_CONSTRUCTION_SCHEDULE_FIXTURE_PAYLOAD: "1",
      APS_CLIENT_ID: "",
      APS_CLIENT_SECRET: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function createModelDocument(cookie) {
  const fixture = Buffer.from("construction schedule fixture", "utf8");
  const created = assertStatus(
    await request("POST", "/api/documents", {
      cookie,
      body: {
        name: "desalination-4d.ifc",
        mimeType: "application/octet-stream",
        size: fixture.length,
        dataBase64: fixture.toString("base64"),
        actor: "计划工程师",
      },
    }),
    201,
    "create model",
  ).json.document;
  return assertStatus(
    await request("PATCH", `/api/documents/${encodeURIComponent(created.id)}/aps`, {
      cookie,
      body: {
        aps: {
          urn: `urn:${created.id}:rev-current`,
          sourceVersionId: created.currentVersionId,
          translationStatus: "success",
          viewable3dGuid: `${created.id}-3d`,
        },
      },
    }),
    200,
    "patch APS",
  ).json.document;
}

const xerText = [
  "%T\tPROJECT",
  "%F\tproj_id\tproj_short_name\tproj_name\tlast_recalc_date\tplan_start_date\tscd_end_date",
  "%R\tP1\tDESAL-MAIN\t里海海水淡化项目\t2024-03-15 00:00\t2023-06-01 00:00\t2026-06-30 00:00",
  "%T\tPROJWBS",
  "%F\twbs_id\tparent_wbs_id\twbs_short_name\twbs_name\tseq_num",
  "%R\tWBS-RO\t\tRO\tRO 系统安装\t1",
  "%R\tWBS-CIV\t\tCIV\t取水泵房土建\t2",
  "%T\tTASK",
  "%F\ttask_id\ttask_code\ttask_name\twbs_id\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tphys_complete_pct\ttotal_float_hr_cnt\tclndr_id",
  "%R\tT1001\tA1001\t安装高压泵 P-101\tWBS-RO\tTT_Task\tTK_Active\t2024-03-11 00:00\t2024-03-20 00:00\t2024-03-12 00:00\t\t65\t0\tCAL-001",
  "%R\tT1002\tA1002\tRO 一段 管道安装 DN150\tWBS-RO\tTT_Task\tTK_NotStart\t2024-03-16 00:00\t2024-03-24 00:00\t\t\t0\t24\tCAL-001",
  "%R\tT1003\tA1003\t二层 钢梁安装\tWBS-CIV\tTT_Task\tTK_NotStart\t2024-03-01 00:00\t2024-03-18 00:00\t\t\t0\t-8\tCAL-001",
  "%R\tT1004\tA1004\t主体结构完成里程碑\tWBS-CIV\tTT_Mile\tTK_NotStart\t2024-03-15 00:00\t2024-03-15 00:00\t\t\t0\t-16\tCAL-001",
  "%T\tTASKPRED",
  "%F\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt",
  "%R\tT1004\tT1003\tPR_FS\t0",
  "%E",
].join("\n");

const modelElements = [
  {
    dbId: 501,
    uniqueId: "pump-p101",
    name: "High Pressure Pump P-101",
    elementType: "High Pressure Pump",
    floor: "RO 一段",
    discipline: "设备",
    properties: {
      "Tag Number": "P-101",
      "Process Unit": "RO 一段",
      "Equipment Type": "High Pressure Pump",
      "Discipline": "设备",
    },
  },
  {
    dbId: 601,
    uniqueId: "pipe-dn150-a",
    name: "SWRO Pipe DN150 A",
    elementType: "Pipe",
    floor: "RO 一段",
    discipline: "管道",
    properties: {
      "Process Unit": "RO 一段",
      "Part Type": "Pipe",
      "Nominal Diameter": "DN150",
      "Discipline": "管道",
    },
  },
  {
    dbId: 701,
    uniqueId: "beam-f2-001",
    name: "F2 Steel Beam B-001",
    elementType: "Steel Beam",
    floor: "F2",
    discipline: "土建结构",
    properties: {
      "Level": "F2",
      "Category": "Steel Beam",
      "Zone": "取水泵房",
      "Discipline": "土建结构",
    },
  },
];

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

  const home = assertStatus(await request("GET", "/api/model-apps/schedule", { cookie }), 200, "schedule home").json;
  assert.ok(home.documents.some((item) => item.id === doc.id), "schedule home should expose APS model documents");
  assert.equal(home.apsReady, false);
  assert.match(home.apsMessage, /系统设置 \/ APS 配置/);

  const preview = assertStatus(
    await request("POST", "/api/model-apps/schedule/preview", {
      cookie,
      body: {
        documentId: doc.id,
        xerText,
        versionName: "Rev.4 当前计划",
        isBaseline: false,
      },
    }),
    200,
    "preview XER",
  ).json;
  assert.equal(preview.preview.project.name, "里海海水淡化项目");
  assert.equal(preview.preview.stats.activityCount, 4);

  const imported = assertStatus(
    await request("POST", "/api/model-apps/schedule/import", {
      cookie,
      body: {
        documentId: doc.id,
        xerText,
        versionName: "Rev.4 当前计划",
        isBaseline: false,
      },
    }),
    201,
    "import XER",
  ).json;
  assert.equal(imported.schedule.documentId, doc.id);
  assert.equal(imported.schedule.dataDate, "2024-03-15");
  assert.equal(imported.activities.length, 4);

  const documentPayload = assertStatus(
    await request("GET", `/api/model-apps/schedule/documents/${encodeURIComponent(doc.id)}`, { cookie }),
    200,
    "schedule document payload",
  ).json;
  assert.ok(documentPayload.schedules.some((item) => item.id === imported.schedule.id));

  const mapped = assertStatus(
    await request("POST", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/auto-map`, {
      cookie,
      body: { modelElements },
    }),
    200,
    "auto-map schedule",
  ).json;
  assert.ok(mapped.mappings.some((item) => item.activityId === "A1001" && item.uniqueId === "pump-p101"));
  assert.ok(mapped.completeness.mappedActivities >= 3);
  assert.ok(mapped.completeness.byConfidence.High >= 1);

  const manualMapped = assertStatus(
    await request("POST", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/manual-map`, {
      cookie,
      body: {
        activityRowId: imported.activities.find((item) => item.activityId === "A1002").id,
        dbIds: [888],
        uniqueIds: ["manual-pipe-888"],
      },
    }),
    200,
    "manual map schedule",
  ).json;
  assert.ok(manualMapped.mappings.some((item) => item.activityId === "A1002" && item.dbId === 888 && item.confidence === "Manual"));
  assert.ok(manualMapped.completeness.byConfidence.Manual >= 1);

  const bulkMapped = assertStatus(
    await request("POST", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/bulk-map`, {
      cookie,
      body: {
        activityRowId: imported.activities.find((item) => item.activityId === "A1002").id,
        mode: "floor_type",
        floor: "RO 一段",
        elementType: "Pipe",
        discipline: "管道",
        modelElements,
      },
    }),
    200,
    "bulk map schedule",
  ).json;
  assert.ok(bulkMapped.createdMappings.some((item) => item.activityId === "A1002" && item.uniqueId === "pipe-dn150-a"));

  const csvMapped = assertStatus(
    await request("POST", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/import-mappings`, {
      cookie,
      body: {
        csvText: "activityId,uniqueId,dbId,elementName,elementType,floor,discipline\nA1003,beam-manual-777,777,Manual Beam,Steel Beam,F2,土建结构",
      },
    }),
    200,
    "import CSV mappings",
  ).json;
  assert.ok(csvMapped.createdMappings.some((item) => item.activityId === "A1003" && item.dbId === 777));
  assert.equal(csvMapped.skippedRows.length, 0);

  const report = assertStatus(
    await request("POST", `/api/model-apps/schedule/activities/${encodeURIComponent(imported.activities.find((item) => item.activityId === "A1001").id)}/report`, {
      cookie,
      body: {
        actualStart: "2024-03-12",
        percentComplete: 65,
        note: "泵体就位，待接管。",
      },
    }),
    201,
    "submit progress report",
  ).json;
  assert.equal(report.report.percentComplete, 65);
  assert.equal(report.activity.percentComplete, 65);

  const timeline = assertStatus(
    await request("GET", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/timeline?date=2024-03-25`, { cookie }),
    200,
    "timeline",
  ).json;
  assert.equal(timeline.timeline.date, "2024-03-25");
  assert.ok(timeline.timeline.elements.some((item) => item.uniqueId === "beam-f2-001" && item.status === "delayed"));

  const alerts = assertStatus(
    await request("GET", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/alerts?date=2024-03-25`, { cookie }),
    200,
    "alerts",
  ).json;
  const delayedAlert = alerts.alerts.find((item) => item.type === "delayed" && item.activityCode === "A1001");
  assert.ok(delayedAlert, "delayed pump activity should produce an alert");
  assert.deepEqual(delayedAlert.dbIds, [501]);

  const issue = assertStatus(
    await request("POST", `/api/model-apps/schedule/alerts/${encodeURIComponent(delayedAlert.id)}/issue`, {
      cookie,
      body: {
        title: "A1001 高压泵安装滞后",
        responsible: "设备安装",
        dueDate: "2026-05-20",
      },
    }),
    201,
    "create issue from schedule alert",
  ).json;
  assert.equal(issue.alert.issueId, issue.issue.id);
  assert.deepEqual(issue.issue.dbIds, [501]);
  assert.equal(issue.issue.source, "construction_schedule");

  const weekly = assertStatus(
    await request("GET", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/weekly-report?weekStart=2024-03-18&weekEnd=2024-03-24`, { cookie }),
    200,
    "weekly report",
  ).json;
  assert.ok(weekly.report.projectProgress.planPercent >= weekly.report.projectProgress.actualPercent);
  assert.ok(weekly.sCurve.length);
  assert.ok(weekly.disciplineMatrix.length);

  const workbookExport = assertStatus(
    await request("POST", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/export`, {
      cookie,
      body: { kind: "workbook", weekStart: "2024-03-18", weekEnd: "2024-03-24" },
    }),
    200,
    "export schedule workbook",
  ).json;
  assert.ok(workbookExport.downloadUrl.includes("/exports/"));
  const workbookDownload = assertStatus(await request("GET", workbookExport.downloadUrl, { cookie, binary: true }), 200, "download schedule workbook").raw;
  assert.equal(workbookDownload.slice(0, 2).toString("utf8"), "PK");

  const weeklyExport = assertStatus(
    await request("POST", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/export`, {
      cookie,
      body: { kind: "weekly_pdf", weekStart: "2024-03-18", weekEnd: "2024-03-24" },
    }),
    200,
    "export schedule weekly PDF",
  ).json;
  const weeklyDownload = assertStatus(await request("GET", weeklyExport.downloadUrl, { cookie, binary: true }), 200, "download schedule weekly PDF").raw;
  assert.equal(weeklyDownload.slice(0, 4).toString("utf8"), "%PDF");

  const ganttExport = assertStatus(
    await request("POST", `/api/model-apps/schedule/${encodeURIComponent(imported.schedule.id)}/export`, {
      cookie,
      body: { kind: "gantt_pdf" },
    }),
    200,
    "export schedule gantt PDF",
  ).json;
  const ganttDownload = assertStatus(await request("GET", ganttExport.downloadUrl, { cookie, binary: true }), 200, "download schedule gantt PDF").raw;
  assert.equal(ganttDownload.slice(0, 4).toString("utf8"), "%PDF");

  const xerTextRev5 = xerText
    .replace("2024-03-20 00:00", "2024-03-26 00:00")
    .replace(
      "%T\tTASKPRED",
      "%R\tT2001\tA2001\t能量回收撬 ERD-001 安装\tWBS-RO\tTT_Task\tTK_NotStart\t2024-03-26 00:00\t2024-04-05 00:00\t\t\t0\t32\tCAL-001\n%T\tTASKPRED",
    );
  const importedRev5 = assertStatus(
    await request("POST", "/api/model-apps/schedule/import", {
      cookie,
      body: {
        documentId: doc.id,
        xerText: xerTextRev5,
        versionName: "Rev.5 当前计划",
        isBaseline: false,
      },
    }),
    201,
    "import changed XER",
  ).json;
  assert.equal(importedRev5.schedule.importSummary.added, 1);
  assert.ok(importedRev5.schedule.importSummary.dateChanged >= 1);

  assertStatus(
    await request("PATCH", "/api/system/aps-settings", {
      cookie,
      body: {
        enabled: true,
        clientId: "schedule-viewer-client",
        clientSecret: "schedule-viewer-secret",
        bucketPolicy: "persistent",
        bucketRegion: "US",
        viewerVersion: "7.*",
        viewerEnv: "AutodeskProduction2",
        viewerApi: "streamingV2",
      },
    }),
    200,
    "configure APS settings",
  );
  const viewerConfig = assertStatus(
    await request("GET", `/api/aps/documents/${encodeURIComponent(doc.id)}/config?scheduleId=${encodeURIComponent(imported.schedule.id)}&scheduleDate=2024-03-25`, { cookie }),
    200,
    "viewer schedule config",
  ).json;
  assert.equal(viewerConfig.schedule.scheduleId, imported.schedule.id);
  assert.equal(viewerConfig.schedule.date, "2024-03-25");
  assert.ok(viewerConfig.schedule.timeline.elements.length >= 3);

  console.log("construction schedule API tests passed");
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-construction-schedule-api-"));
  const child = startServerProcess(dataDir);
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
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
