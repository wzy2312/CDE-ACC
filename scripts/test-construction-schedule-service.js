const assert = require("node:assert/strict");
const {
  parseXerSchedule,
  buildXerImportPreview,
  autoMapScheduleActivities,
  buildScheduleTimeline,
  calculateElementScheduleStatus,
  generateScheduleAlerts,
  buildWeeklyProgressReport,
  buildSCurve,
  buildDisciplineProgressMatrix,
} = require("../lib/construction-schedule-service");

function prop(displayName, displayValue) {
  return { displayName, displayValue };
}

const xerText = [
  "ERMHDR\t8.4\t2024-03-01",
  "%T\tPROJECT",
  "%F\tproj_id\tproj_short_name\tproj_name\tlast_recalc_date\tplan_start_date\tscd_end_date",
  "%R\tP1\tDESAL-MAIN\t里海海水淡化项目\t2024-03-15 00:00\t2023-06-01 00:00\t2026-06-30 00:00",
  "%T\tPROJWBS",
  "%F\twbs_id\tparent_wbs_id\twbs_short_name\twbs_name\tseq_num",
  "%R\tWBS-001\t\tCIV\t土建结构\t1",
  "%R\tWBS-001-01\tWBS-001\tPMP-CIV\t取水泵房结构\t2",
  "%R\tWBS-002\t\tRO\tRO 系统安装\t3",
  "%T\tCALENDAR",
  "%F\tclndr_id\tclndr_name\tdefault_flag",
  "%R\tCAL-001\t六天工作制\tY",
  "%T\tTASK",
  "%F\ttask_id\ttask_code\ttask_name\twbs_id\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tphys_complete_pct\ttotal_float_hr_cnt\tclndr_id",
  "%R\tT1000\tA1000\t取水泵房基础开挖\tWBS-001-01\tTT_Task\tTK_Complete\t2024-03-01 00:00\t2024-03-10 00:00\t2024-03-01 00:00\t2024-03-09 00:00\t100\t16\tCAL-001",
  "%R\tT1001\tA1001\t安装高压泵 P-101\tWBS-002\tTT_Task\tTK_Active\t2024-03-11 00:00\t2024-03-20 00:00\t2024-03-12 00:00\t\t65\t0\tCAL-001",
  "%R\tT1002\tA1002\tRO 一段 管道安装 DN150\tWBS-002\tTT_Task\tTK_NotStart\t2024-03-16 00:00\t2024-03-24 00:00\t\t\t0\t24\tCAL-001",
  "%R\tT1003\tA1003\t二层 钢梁安装\tWBS-001-01\tTT_Task\tTK_NotStart\t2024-03-01 00:00\t2024-03-18 00:00\t\t\t0\t-8\tCAL-001",
  "%R\tT1004\tA1004\t主体结构完成里程碑\tWBS-001-01\tTT_Mile\tTK_NotStart\t2024-03-15 00:00\t2024-03-15 00:00\t\t\t0\t-16\tCAL-001",
  "%R\tT9999\tA9999\t错误日期任务\tWBS-002\tTT_Task\tTK_NotStart\t2024-04-10 00:00\t2024-04-01 00:00\t\t\t0\t10\tCAL-001",
  "%T\tTASKPRED",
  "%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt",
  "%R\tPRED-001\tT1001\tT1000\tPR_FS\t0",
  "%R\tPRED-002\tT1004\tT1003\tPR_FS\t0",
  "%T\tTASKRSRC",
  "%F\ttask_id\trsrc_id\ttarget_qty",
  "%R\tT1001\tCREW-MECH\t80",
  "%E",
].join("\n");

const parsed = parseXerSchedule(xerText);
assert.equal(parsed.project.id, "DESAL-MAIN");
assert.equal(parsed.project.name, "里海海水淡化项目");
assert.equal(parsed.project.dataDate, "2024-03-15");
assert.equal(parsed.project.plannedStart, "2023-06-01");
assert.equal(parsed.project.plannedFinish, "2026-06-30");
assert.equal(parsed.wbs.length, 3);
assert.equal(parsed.activities.length, 6);
assert.equal(parsed.activities[1].id, "A1001");
assert.equal(parsed.activities[1].internalId, "T1001");
assert.equal(parsed.activities[1].type, "Task");
assert.equal(parsed.activities[1].status, "In Progress");
assert.equal(parsed.activities[1].percentComplete, 65);
assert.equal(parsed.activities[1].totalFloatHours, 0);
assert.equal(parsed.activities[1].predecessors[0].activityId, "A1000");
assert.equal(parsed.calendars[0].name, "六天工作制");
assert.equal(parsed.resources.length, 1);

const preview = buildXerImportPreview(parsed);
assert.equal(preview.project.name, "里海海水淡化项目");
assert.equal(preview.stats.wbsLevels, 2);
assert.equal(preview.stats.activityCount, 6);
assert.equal(preview.stats.taskCount, 5);
assert.equal(preview.stats.milestoneCount, 1);
assert.equal(preview.statusDistribution.completed, 1);
assert.equal(preview.statusDistribution.inProgress, 1);
assert.equal(preview.statusDistribution.notStarted, 4);
assert.ok(preview.warnings.some((warning) => warning.includes("A9999") && warning.includes("计划完成日期早于计划开始日期")));

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
      "Discipline": "设备",
      "Equipment Type": "High Pressure Pump",
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
      "Line Number": "SW-0001",
      "Process Unit": "RO 一段",
      "Nominal Diameter": "DN150",
      "Part Type": "Pipe",
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
      "Discipline": "土建结构",
      "Zone": "取水泵房",
    },
  },
  {
    dbId: 801,
    uniqueId: "room-pmp",
    name: "Room PMP-001",
    elementType: "Room",
    floor: "取水泵房",
    discipline: "土建结构",
    properties: {
      "Room Number": "PMP-001",
      "Zone": "取水泵房",
    },
  },
];

const mappings = autoMapScheduleActivities(parsed.activities, modelElements, { wbs: parsed.wbs });
const pumpMapping = mappings.find((item) => item.activityId === "A1001" && item.uniqueId === "pump-p101");
assert.ok(pumpMapping, "Tag Number should map pump installation to P-101");
assert.equal(pumpMapping.confidence, "High");
assert.equal(pumpMapping.matchMethod, "tag");
assert.ok(mappings.some((item) => item.activityId === "A1002" && item.uniqueId === "pipe-dn150-a" && item.confidence === "Medium"), "floor/type rule should map RO DN150 pipe activity");
assert.ok(mappings.some((item) => item.activityId === "A1003" && item.uniqueId === "beam-f2-001" && item.confidence === "Medium"), "floor/type rule should map F2 beam activity");

const pumpStatus = calculateElementScheduleStatus(modelElements[0], parsed.activities, mappings, "2024-03-18");
assert.equal(pumpStatus.status, "in_progress");
assert.equal(pumpStatus.viewerColor, "#2563eb");
assert.equal(pumpStatus.activities[0].activityId, "A1001");

const beamStatus = calculateElementScheduleStatus(modelElements[2], parsed.activities, mappings, "2024-03-20");
assert.equal(beamStatus.status, "delayed");
assert.ok(beamStatus.activities.some((item) => item.activityId === "A1003"));

const unmappedStatus = calculateElementScheduleStatus({ dbId: 999, uniqueId: "no-map" }, parsed.activities, mappings, "2024-03-18");
assert.equal(unmappedStatus.status, "unmapped");

const timeline = buildScheduleTimeline(parsed.activities, mappings, modelElements, "2024-03-18");
assert.equal(timeline.date, "2024-03-18");
assert.equal(timeline.stats.inProgress, 1);
assert.equal(timeline.stats.delayed, 2);
assert.equal(timeline.elements.find((item) => item.uniqueId === "beam-f2-001").status, "delayed");
assert.ok(timeline.milestones.some((item) => item.activityId === "A1004"));

const reports = [
  {
    activityId: "A1001",
    reportedAt: "2024-03-18T08:00:00.000Z",
    actualStart: "2024-03-12",
    percentComplete: 65,
  },
  {
    activityId: "A1001",
    reportedAt: "2024-03-19T08:00:00.000Z",
    actualStart: "2024-03-12",
    percentComplete: 60,
  },
  {
    activityId: "A1002",
    reportedAt: "2024-03-01T08:00:00.000Z",
    percentComplete: 20,
  },
];
const alerts = generateScheduleAlerts(parsed.activities, mappings, {
  asOfDate: "2024-03-25",
  reports,
  staleDays: 7,
});
assert.ok(alerts.some((item) => item.type === "delayed" && item.activityId === "A1001"));
assert.ok(alerts.some((item) => item.type === "progress_regression" && item.activityId === "A1001"));
assert.ok(alerts.some((item) => item.type === "milestone_risk" && item.activityId === "A1004" && item.severity === "critical"));
assert.ok(alerts.some((item) => item.type === "stale_report" && item.activityId === "A1002"));

const weekly = buildWeeklyProgressReport(parsed.activities, {
  weekStart: "2024-03-18",
  weekEnd: "2024-03-24",
  dataDate: parsed.project.dataDate,
});
assert.equal(weekly.projectProgress.planPercent > weekly.projectProgress.actualPercent, true);
assert.ok(weekly.thisWeekPlannedUnfinished.some((item) => item.activityId === "A1001"));
assert.ok(weekly.nextWeekPlan.some((item) => item.activityId === "A9999"));

const sCurve = buildSCurve(parsed.activities, { start: "2024-03-01", end: "2024-03-31", intervalDays: 7 });
assert.ok(sCurve.length >= 4);
assert.ok(sCurve.every((point) => point.date && Number.isFinite(point.plannedPercent) && Number.isFinite(point.actualPercent)));

const matrix = buildDisciplineProgressMatrix(parsed.activities, mappings, modelElements, "2024-03-25");
assert.ok(matrix.some((row) => row.discipline === "设备" && row.status === "滞后"));
assert.ok(matrix.some((row) => row.discipline === "管道"));

console.log("construction schedule service tests passed");
