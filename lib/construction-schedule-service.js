const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_COLORS = {
  future: "#d1d5db",
  not_started: "#9ca3af",
  in_progress: "#2563eb",
  completed: "#16a34a",
  early: "#15803d",
  delayed: "#dc2626",
  unmapped: "#f8fafc",
};

const STATUS_LABELS = {
  future: "未来计划",
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  early: "提前完成",
  delayed: "滞后",
  unmapped: "无映射",
};

const STATUS_WEIGHT = {
  delayed: 100,
  in_progress: 70,
  not_started: 50,
  future: 30,
  completed: 10,
  early: 5,
  unmapped: 0,
};

const PROPERTY_ALIASES = {
  tag: ["Tag Number", "Tag", "Equipment Tag", "Mark", "Asset Tag", "设备位号", "位号"],
  line: ["Line Number", "Line No", "Pipeline Number", "Pipe Tag", "管线号"],
  room: ["Room Number", "Room", "Room No", "Space Number", "房间号"],
  floor: ["Level", "Floor", "Process Unit", "Plant Area", "Zone", "System", "Location", "楼层", "工艺单元", "区域", "系统"],
  zone: ["Zone", "Process Unit", "Plant Area", "Area Code", "System", "Location", "区域", "装置区", "系统"],
  elementType: ["Category", "Type", "Type Name", "Family", "Equipment Type", "Part Type", "Object Type", "构件类型", "设备类型", "类别"],
  discipline: ["Discipline", "Trade", "System Classification", "专业", "设计专业"],
};

const ELEMENT_TYPE_KEYWORDS = [
  { canonical: "Pipe", keywords: ["pipe", "piping", "spool", "管道", "管线", "管段", "管廊"] },
  { canonical: "Valve", keywords: ["valve", "阀", "阀门"] },
  { canonical: "Pump", keywords: ["pump", "泵", "高压泵", "取水泵"] },
  { canonical: "Beam", keywords: ["beam", "steel beam", "梁", "钢梁"] },
  { canonical: "Column", keywords: ["column", "柱"] },
  { canonical: "Slab", keywords: ["slab", "floor slab", "楼板", "板"] },
  { canonical: "Equipment", keywords: ["equipment", "skid", "vessel", "设备", "撬", "容器", "膜壳"] },
  { canonical: "Cable Tray", keywords: ["cable tray", "桥架"] },
  { canonical: "Instrument", keywords: ["instrument", "仪表"] },
];

function safeText(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }
  const text = String(value).trim();
  return text || fallback;
}

function uniqueTexts(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => safeText(value, ""))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function numberOr(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, numberOr(value, 0)));
}

function normalizeDate(value) {
  const text = safeText(value, "");
  if (!text || /^null$/i.test(text)) return "";
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }
  const monthNames = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const p6 = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
  if (p6) {
    const year = p6[3].length === 2 ? `20${p6[3]}` : p6[3];
    return `${year}-${monthNames[p6[2].toLowerCase()] || "01"}-${p6[1].padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function dateValue(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date, days) {
  const base = dateValue(date);
  if (!base) return "";
  return new Date(base.getTime() + Number(days || 0) * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(left, right) {
  const a = dateValue(left);
  const b = dateValue(right);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function compareDate(left, right) {
  const a = dateValue(left);
  const b = dateValue(right);
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.getTime() === b.getTime() ? 0 : a.getTime() < b.getTime() ? -1 : 1;
}

function dateInRange(value, start, end) {
  return compareDate(value, start) >= 0 && compareDate(value, end) <= 0;
}

function normalizeActivityType(value) {
  const text = safeText(value, "").toLowerCase();
  if (text.includes("mile") || text.includes("milestone")) return "Milestone";
  if (text.includes("loe") || text.includes("level")) return "Level of Effort";
  if (text.includes("wbs")) return "WBS Summary";
  return "Task";
}

function normalizeActivityStatus(value, percent = 0, actualFinish = "") {
  const text = safeText(value, "").toLowerCase();
  if (actualFinish || percent >= 100 || text.includes("complete") || text.includes("completed") || text.includes("tk_complete")) {
    return "Completed";
  }
  if (text.includes("active") || text.includes("progress") || text.includes("started") || text.includes("tk_active")) {
    return "In Progress";
  }
  if (text.includes("not") || text.includes("notstart") || text.includes("tk_notstart")) {
    return "Not Started";
  }
  return percent > 0 ? "In Progress" : "Not Started";
}

function parseXerTables(xerText) {
  const tables = {};
  let currentTable = "";
  let currentFields = [];
  String(xerText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trimEnd();
      if (!trimmed) return;
      const parts = trimmed.split("\t");
      const marker = parts[0];
      if (marker === "%T") {
        currentTable = safeText(parts[1], "").toUpperCase();
        currentFields = [];
        if (currentTable && !tables[currentTable]) tables[currentTable] = [];
        return;
      }
      if (marker === "%F") {
        currentFields = parts.slice(1).map((field) => safeText(field, ""));
        return;
      }
      if (marker === "%R" && currentTable && currentFields.length) {
        const row = {};
        currentFields.forEach((field, index) => {
          row[field] = parts[index + 1] ?? "";
        });
        tables[currentTable].push(row);
      }
    });
  return tables;
}

function field(row, names, fallback = "") {
  for (const name of names) {
    if (row && row[name] !== undefined && safeText(row[name], "")) {
      return safeText(row[name], "");
    }
  }
  return fallback;
}

function buildWbsLevels(wbsRows) {
  const byId = new Map(wbsRows.map((item) => [item.id, item]));
  function levelFor(item, seen = new Set()) {
    if (!item || !item.parentId || seen.has(item.id)) return 1;
    const parent = byId.get(item.parentId);
    if (!parent) return 1;
    seen.add(item.id);
    return levelFor(parent, seen) + 1;
  }
  wbsRows.forEach((item) => {
    item.level = levelFor(item);
  });
}

function parseXerSchedule(xerText) {
  const tables = parseXerTables(xerText);
  const projectRow = (tables.PROJECT || [])[0] || {};
  const project = {
    id: field(projectRow, ["proj_short_name", "proj_id"], "P6-PROJECT"),
    internalId: field(projectRow, ["proj_id"], ""),
    name: field(projectRow, ["proj_name", "proj_short_name"], "P6 进度计划"),
    dataDate: normalizeDate(field(projectRow, ["last_recalc_date", "data_date", "update_date"], "")),
    plannedStart: normalizeDate(field(projectRow, ["plan_start_date", "planned_start_date", "start_date"], "")),
    plannedFinish: normalizeDate(field(projectRow, ["scd_end_date", "plan_end_date", "planned_finish_date", "finish_date"], "")),
  };
  const wbs = (tables.PROJWBS || []).map((row) => ({
    id: field(row, ["wbs_id"], ""),
    code: field(row, ["wbs_short_name"], ""),
    name: field(row, ["wbs_name", "wbs_short_name"], ""),
    parentId: field(row, ["parent_wbs_id"], ""),
    level: 1,
    sequence: numberOr(field(row, ["seq_num"], ""), 0),
  })).filter((item) => item.id);
  buildWbsLevels(wbs);

  const taskRows = tables.TASK || [];
  const rawActivities = taskRows.map((row) => {
    const percent = clampPercent(field(row, ["phys_complete_pct", "complete_pct", "remain_drtn_pct"], "0"));
    const actualFinish = normalizeDate(field(row, ["act_end_date", "actual_finish_date"], ""));
    return {
      internalId: field(row, ["task_id"], ""),
      id: field(row, ["task_code", "task_id"], ""),
      activityId: field(row, ["task_code", "task_id"], ""),
      name: field(row, ["task_name", "task_code"], ""),
      wbsId: field(row, ["wbs_id"], ""),
      type: normalizeActivityType(field(row, ["task_type", "activity_type"], "")),
      plannedStart: normalizeDate(field(row, ["target_start_date", "early_start_date", "restart_date", "planned_start"], "")),
      plannedFinish: normalizeDate(field(row, ["target_end_date", "early_end_date", "reend_date", "planned_finish"], "")),
      actualStart: normalizeDate(field(row, ["act_start_date", "actual_start_date"], "")),
      actualFinish,
      status: normalizeActivityStatus(field(row, ["status_code", "task_status"], ""), percent, actualFinish),
      percentComplete: percent,
      totalFloatHours: numberOr(field(row, ["total_float_hr_cnt", "total_float"], ""), 0),
      calendarId: field(row, ["clndr_id", "calendar_id"], ""),
      predecessors: [],
    };
  }).filter((activity) => activity.id);
  const byInternalId = new Map(rawActivities.map((activity) => [activity.internalId || activity.id, activity]));
  const predecessors = (tables.TASKPRED || []).map((row) => {
    const successorInternalId = field(row, ["task_id", "successor_id"], "");
    const predecessorInternalId = field(row, ["pred_task_id", "predecessor_id"], "");
    const successor = byInternalId.get(successorInternalId);
    const predecessor = byInternalId.get(predecessorInternalId);
    const relation = {
      id: field(row, ["task_pred_id", "pred_id"], ""),
      successorInternalId,
      predecessorInternalId,
      successorId: successor?.id || successorInternalId,
      predecessorId: predecessor?.id || predecessorInternalId,
      activityId: predecessor?.id || predecessorInternalId,
      type: normalizePredecessorType(field(row, ["pred_type", "type"], "FS")),
      lag: numberOr(field(row, ["lag_hr_cnt", "lag"], "0"), 0),
    };
    if (successor) {
      successor.predecessors.push({
        activityId: relation.predecessorId,
        type: relation.type,
        lag: relation.lag,
      });
    }
    return relation;
  });
  const calendars = (tables.CALENDAR || []).map((row) => ({
    id: field(row, ["clndr_id", "calendar_id"], ""),
    name: field(row, ["clndr_name", "calendar_name"], ""),
    default: /^y|true|1$/i.test(field(row, ["default_flag"], "")),
  })).filter((item) => item.id || item.name);
  const resources = (tables.TASKRSRC || []).map((row) => ({
    activityInternalId: field(row, ["task_id"], ""),
    resourceId: field(row, ["rsrc_id", "resource_id"], ""),
    targetQty: numberOr(field(row, ["target_qty", "qty"], ""), 0),
  }));
  return {
    project,
    wbs,
    activities: rawActivities,
    predecessors,
    calendars,
    resources,
    tables,
  };
}

function normalizePredecessorType(value) {
  const text = safeText(value, "FS").toUpperCase();
  if (text.includes("SS")) return "SS";
  if (text.includes("FF")) return "FF";
  if (text.includes("SF")) return "SF";
  return "FS";
}

function buildXerImportPreview(parsed) {
  const activities = Array.isArray(parsed?.activities) ? parsed.activities : [];
  const wbs = Array.isArray(parsed?.wbs) ? parsed.wbs : [];
  const statusDistribution = {
    notStarted: activities.filter((item) => item.status === "Not Started").length,
    inProgress: activities.filter((item) => item.status === "In Progress").length,
    completed: activities.filter((item) => item.status === "Completed").length,
  };
  const warnings = [];
  activities.forEach((activity) => {
    if (activity.plannedStart && activity.plannedFinish && compareDate(activity.plannedFinish, activity.plannedStart) < 0) {
      warnings.push(`${activity.id} ${activity.name} 的计划完成日期早于计划开始日期，请核查 P6 数据。`);
    }
    if (!activity.plannedStart || !activity.plannedFinish) {
      warnings.push(`${activity.id} ${activity.name} 缺少计划开始或完成日期。`);
    }
  });
  return {
    project: parsed.project,
    stats: {
      wbsLevels: Math.max(0, ...wbs.map((item) => Number(item.level || 1))),
      wbsCount: wbs.length,
      activityCount: activities.length,
      taskCount: activities.filter((item) => item.type === "Task").length,
      milestoneCount: activities.filter((item) => item.type === "Milestone").length,
      levelOfEffortCount: activities.filter((item) => item.type === "Level of Effort").length,
      calendarCount: Array.isArray(parsed.calendars) ? parsed.calendars.length : 0,
      predecessorCount: Array.isArray(parsed.predecessors) ? parsed.predecessors.length : 0,
      resourceAssignmentCount: Array.isArray(parsed.resources) ? parsed.resources.length : 0,
    },
    statusDistribution,
    warnings,
  };
}

function normalizePropertyMap(properties) {
  if (!properties) return {};
  if (!Array.isArray(properties)) return { ...properties };
  return properties.reduce((result, item) => {
    const name = safeText(item.displayName || item.name || item.attributeName, "");
    if (name) result[name] = item.displayValue ?? item.value ?? "";
    return result;
  }, {});
}

function propertyLookup(properties, aliases, fallback = "") {
  const normalized = new Map(
    Object.entries(properties || {}).map(([key, value]) => [safeText(key, "").toLowerCase(), value]),
  );
  for (const alias of aliases) {
    const value = normalized.get(safeText(alias, "").toLowerCase());
    if (safeText(value, "")) return safeText(value, "");
  }
  return fallback;
}

function normalizeModelElement(element = {}) {
  const properties = normalizePropertyMap(element.properties || element.props);
  return {
    dbId: element.dbId ?? element.dbid ?? element.objectid ?? element.objectId ?? null,
    uniqueId: safeText(element.uniqueId || element.unique_id || element.elementUniqueId || propertyLookup(properties, ["UniqueId", "GlobalId", "Handle"]), ""),
    name: safeText(element.name || element.displayName, ""),
    elementType: safeText(element.elementType || element.type || propertyLookup(properties, PROPERTY_ALIASES.elementType), ""),
    floor: safeText(element.floor || propertyLookup(properties, PROPERTY_ALIASES.floor), ""),
    discipline: safeText(element.discipline || propertyLookup(properties, PROPERTY_ALIASES.discipline), ""),
    properties,
  };
}

function containsToken(haystack, token) {
  const left = safeText(haystack, "").toLowerCase();
  const right = safeText(token, "").toLowerCase();
  return Boolean(left && right && left.includes(right));
}

function floorKeywords(value) {
  const text = safeText(value, "");
  const keywords = [text];
  const fMatch = text.match(/^F?(\d+)$/i) || text.match(/^Level\s*(\d+)$/i);
  if (fMatch) {
    const level = Number(fMatch[1]);
    keywords.push(`F${level}`, `${level}F`, `Level ${level}`, `L${level}`);
    const cn = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][level];
    if (cn) keywords.push(`${cn}层`, `第${cn}层`);
  }
  if (/二层|第二层/.test(text)) keywords.push("F2", "Level 2", "2F");
  if (/一层|第一层/.test(text)) keywords.push("F1", "Level 1", "1F");
  return uniqueTexts(keywords);
}

function elementTypeKeywords(value) {
  const text = safeText(value, "");
  const lower = text.toLowerCase();
  const matched = ELEMENT_TYPE_KEYWORDS.filter((group) =>
    containsToken(lower, group.canonical) || group.keywords.some((keyword) => containsToken(lower, keyword)),
  ).flatMap((group) => group.keywords.concat(group.canonical));
  return uniqueTexts([text, ...matched]);
}

function addMapping(result, seen, activity, element, matchMethod, confidence, reason) {
  const key = `${activity.id}:${element.uniqueId || element.dbId}`;
  if (seen.has(key)) return;
  seen.add(key);
  result.push({
    activityId: activity.id,
    activityInternalId: activity.internalId,
    dbId: element.dbId,
    uniqueId: element.uniqueId,
    modelUrn: "",
    matchMethod,
    confidence,
    reason,
  });
}

function autoMapScheduleActivities(activities, modelElements, options = {}) {
  const elements = (Array.isArray(modelElements) ? modelElements : []).map(normalizeModelElement);
  const wbsById = new Map((Array.isArray(options.wbs) ? options.wbs : []).map((item) => [item.id, item]));
  const result = [];
  const seen = new Set();
  (Array.isArray(activities) ? activities : []).forEach((activity) => {
    const haystack = `${activity.id} ${activity.name}`.toLowerCase();
    elements.forEach((element) => {
      const tagValues = uniqueTexts([
        propertyLookup(element.properties, PROPERTY_ALIASES.tag),
        propertyLookup(element.properties, PROPERTY_ALIASES.line),
      ]);
      if (tagValues.some((tag) => containsToken(haystack, tag))) {
        addMapping(result, seen, activity, element, "tag", "High", "Activity 名称命中构件 Tag/Line Number");
      }
    });
    elements.forEach((element) => {
      const room = propertyLookup(element.properties, PROPERTY_ALIASES.room);
      if (room && containsToken(haystack, room)) {
        addMapping(result, seen, activity, element, "room", "High", "Activity 名称命中房间编号");
      }
    });
    elements.forEach((element) => {
      const floorMatched = floorKeywords(element.floor).some((keyword) => containsToken(haystack, keyword));
      const typeMatched = elementTypeKeywords(element.elementType).some((keyword) => containsToken(haystack, keyword));
      if (floorMatched && typeMatched) {
        addMapping(result, seen, activity, element, "floor_type", "Medium", "Activity 名称命中楼层/装置区与构件类型");
      }
    });
    const hasSpecificMapping = result.some((mapping) => mapping.activityId === activity.id && mapping.confidence !== "Low");
    if (activity.type === "Milestone") {
      return;
    }
    const wbs = hasSpecificMapping ? null : wbsById.get(activity.wbsId);
    const wbsText = `${wbs?.code || ""} ${wbs?.name || ""}`.toLowerCase();
    if (wbsText) {
      elements.forEach((element) => {
        const zone = safeText(propertyLookup(element.properties, PROPERTY_ALIASES.zone) || element.floor, "");
        if (zone && (containsToken(wbsText, zone) || containsToken(zone, wbs?.code) || containsToken(zone, wbs?.name))) {
          addMapping(result, seen, activity, element, "wbs_zone", "Low", "WBS 节点与模型区域/系统近似匹配");
        }
      });
    }
  });
  return result.sort((left, right) =>
    safeText(left.activityId, "").localeCompare(safeText(right.activityId, ""), "zh-CN") ||
    String(left.dbId ?? "").localeCompare(String(right.dbId ?? "")),
  );
}

function calculateActivityScheduleStatus(activity, date) {
  const viewDate = normalizeDate(date) || new Date().toISOString().slice(0, 10);
  const plannedStart = normalizeDate(activity.plannedStart);
  const plannedFinish = normalizeDate(activity.plannedFinish);
  const actualStart = normalizeDate(activity.actualStart);
  const actualFinish = normalizeDate(activity.actualFinish);
  const percent = clampPercent(activity.percentComplete);
  if (activity.status === "Completed" || percent >= 100 || actualFinish) {
    if (actualFinish && plannedFinish && compareDate(actualFinish, plannedFinish) < 0) {
      return "early";
    }
    return "completed";
  }
  if (!plannedStart || !plannedFinish) {
    return percent > 0 || actualStart ? "in_progress" : "not_started";
  }
  if (compareDate(viewDate, plannedStart) < 0) {
    return "future";
  }
  if (compareDate(viewDate, plannedFinish) <= 0) {
    return actualStart || percent > 0 || activity.status === "In Progress" ? "in_progress" : "delayed";
  }
  return "delayed";
}

function activityStatusDetail(activity, date) {
  const status = calculateActivityScheduleStatus(activity, date);
  const delayDays = status === "delayed" && activity.plannedFinish ? Math.max(0, daysBetween(activity.plannedFinish, date)) : 0;
  return {
    activityId: activity.id,
    internalId: activity.internalId,
    name: activity.name,
    wbsId: activity.wbsId,
    status,
    label: STATUS_LABELS[status] || status,
    plannedStart: activity.plannedStart,
    plannedFinish: activity.plannedFinish,
    actualStart: activity.actualStart,
    actualFinish: activity.actualFinish,
    percentComplete: clampPercent(activity.percentComplete),
    totalFloatHours: Number(activity.totalFloatHours || 0),
    delayDays,
  };
}

function calculateElementScheduleStatus(element, activities, mappings, date) {
  const normalized = normalizeModelElement(element);
  const relatedIds = new Set(
    (Array.isArray(mappings) ? mappings : [])
      .filter((mapping) =>
        (normalized.uniqueId && mapping.uniqueId === normalized.uniqueId) ||
        (normalized.dbId !== null && normalized.dbId !== undefined && String(mapping.dbId) === String(normalized.dbId)),
      )
      .map((mapping) => mapping.activityId),
  );
  if (!relatedIds.size) {
    return {
      dbId: normalized.dbId,
      uniqueId: normalized.uniqueId,
      name: normalized.name,
      elementType: normalized.elementType,
      floor: normalized.floor,
      discipline: normalized.discipline,
      status: "unmapped",
      label: STATUS_LABELS.unmapped,
      viewerColor: STATUS_COLORS.unmapped,
      activities: [],
    };
  }
  const byId = new Map((Array.isArray(activities) ? activities : []).map((activity) => [activity.id, activity]));
  const details = Array.from(relatedIds)
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((activity) => activityStatusDetail(activity, date));
  const status = details
    .map((detail) => detail.status)
    .sort((left, right) => (STATUS_WEIGHT[right] || 0) - (STATUS_WEIGHT[left] || 0))[0] || "unmapped";
  return {
    dbId: normalized.dbId,
    uniqueId: normalized.uniqueId,
    name: normalized.name,
    elementType: normalized.elementType,
    floor: normalized.floor,
    discipline: normalized.discipline,
    status,
    label: STATUS_LABELS[status] || status,
    viewerColor: STATUS_COLORS[status] || STATUS_COLORS.unmapped,
    activities: details,
  };
}

function buildScheduleTimeline(activities, mappings, modelElements, date, options = {}) {
  const elements = (Array.isArray(modelElements) ? modelElements : []).map((element) =>
    calculateElementScheduleStatus(element, activities, mappings, date),
  );
  const filteredElements = elements.filter((element) => {
    const statusFilters = Array.isArray(options.statuses) ? options.statuses : [];
    const disciplineFilters = Array.isArray(options.disciplines) ? options.disciplines : [];
    return (!statusFilters.length || statusFilters.includes(element.status)) &&
      (!disciplineFilters.length || disciplineFilters.includes(element.discipline));
  });
  const stats = Object.fromEntries(Object.keys(STATUS_LABELS).map((status) => [status === "not_started" ? "notStarted" : status === "in_progress" ? "inProgress" : status, 0]));
  filteredElements.forEach((element) => {
    if (element.status === "not_started") stats.notStarted += 1;
    else if (element.status === "in_progress") stats.inProgress += 1;
    else stats[element.status] = Number(stats[element.status] || 0) + 1;
  });
  const milestones = (Array.isArray(activities) ? activities : [])
    .filter((activity) => activity.type === "Milestone")
    .map((activity) => ({
      activityId: activity.id,
      name: activity.name,
      plannedFinish: activity.plannedFinish,
      status: calculateActivityScheduleStatus(activity, date),
    }));
  return {
    date: normalizeDate(date) || new Date().toISOString().slice(0, 10),
    stats,
    elements: filteredElements,
    milestones,
  };
}

function mappingsForActivity(activityId, mappings) {
  const id = safeText(activityId, "");
  return (Array.isArray(mappings) ? mappings : []).filter((mapping) => mapping.activityId === id);
}

function generateScheduleAlerts(activities, mappings, options = {}) {
  const asOfDate = normalizeDate(options.asOfDate || options.date) || new Date().toISOString().slice(0, 10);
  const dueSoonDays = Math.max(1, Number(options.dueSoonDays || 7) || 7);
  const staleDays = Math.max(1, Number(options.staleDays || 7) || 7);
  const reports = Array.isArray(options.reports) ? options.reports : [];
  const reportsByActivity = new Map();
  reports.forEach((report) => {
    const id = safeText(report.activityId || report.activityCode, "");
    if (!id) return;
    const list = reportsByActivity.get(id) || [];
    list.push(report);
    reportsByActivity.set(id, list);
  });
  reportsByActivity.forEach((list) => {
    list.sort((left, right) => safeText(left.reportedAt, "").localeCompare(safeText(right.reportedAt, "")));
  });
  const alerts = [];
  const addAlert = (activity, type, severity, message, extra = {}) => {
    const related = mappingsForActivity(activity.id, mappings);
    alerts.push({
      id: `alert:${activity.id}:${type}`,
      activityId: activity.id,
      activityCode: activity.id,
      activityName: activity.name,
      type,
      severity,
      message,
      plannedFinish: activity.plannedFinish,
      percentComplete: clampPercent(activity.percentComplete),
      dbIds: related.map((mapping) => mapping.dbId).filter((value) => value !== null && value !== undefined),
      uniqueIds: related.map((mapping) => mapping.uniqueId).filter(Boolean),
      status: "open",
      triggeredAt: `${asOfDate}T00:00:00.000Z`,
      ...extra,
    });
  };
  (Array.isArray(activities) ? activities : []).forEach((activity) => {
    const status = calculateActivityScheduleStatus(activity, asOfDate);
    if (status === "delayed" && activity.type !== "Milestone") {
      addAlert(activity, "delayed", "high", `${activity.id} ${activity.name} 已超过计划完成日期仍未完成。`, {
        delayDays: Math.max(0, daysBetween(activity.plannedFinish, asOfDate)),
      });
    }
    if (
      activity.plannedFinish &&
      compareDate(activity.plannedFinish, asOfDate) >= 0 &&
      compareDate(activity.plannedFinish, addDays(asOfDate, dueSoonDays)) <= 0 &&
      clampPercent(activity.percentComplete) < 80 &&
      !activity.actualFinish
    ) {
      addAlert(activity, "due_soon", "medium", `${activity.id} ${activity.name} 临近计划完成日期，当前完成率低于 80%。`);
    }
    const reportsForActivity = reportsByActivity.get(activity.id) || [];
    if (reportsForActivity.length >= 2) {
      const previous = reportsForActivity[reportsForActivity.length - 2];
      const latest = reportsForActivity[reportsForActivity.length - 1];
      if (clampPercent(latest.percentComplete) < clampPercent(previous.percentComplete)) {
        addAlert(activity, "progress_regression", "high", `${activity.id} ${activity.name} 本次上报完成率低于上次记录。`);
      }
    }
    const latest = reportsForActivity[reportsForActivity.length - 1];
    if (latest && !activity.actualFinish && (clampPercent(latest.percentComplete) > 0 || status === "in_progress")) {
      const ageDays = Math.max(0, daysBetween(normalizeDate(latest.reportedAt), asOfDate));
      if (ageDays > staleDays) {
        addAlert(activity, "stale_report", "medium", `${activity.id} ${activity.name} 已超过 ${staleDays} 天未更新现场进度。`, { staleDays: ageDays });
      }
    }
    if (activity.type === "Milestone" && (status === "delayed" || Number(activity.totalFloatHours || 0) < 0)) {
      addAlert(activity, "milestone_risk", "critical", `${activity.id} ${activity.name} 所在关键路径存在里程碑风险。`, {
        totalFloatHours: Number(activity.totalFloatHours || 0),
      });
    }
  });
  const seen = new Set();
  return alerts.filter((alert) => {
    if (seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });
}

function activityPlannedWeight(activity) {
  if (activity.type === "Milestone") return 0;
  return 1;
}

function buildWeeklyProgressReport(activities, options = {}) {
  const list = Array.isArray(activities) ? activities : [];
  const weekStart = normalizeDate(options.weekStart) || new Date().toISOString().slice(0, 10);
  const weekEnd = normalizeDate(options.weekEnd) || addDays(weekStart, 6);
  const dataDate = normalizeDate(options.dataDate || weekEnd) || weekEnd;
  const weighted = list.filter((activity) => activityPlannedWeight(activity) > 0);
  const totalWeight = weighted.reduce((sum, activity) => sum + activityPlannedWeight(activity), 0) || 1;
  const plannedDoneWeight = weighted
    .filter((activity) => activity.plannedFinish && compareDate(activity.plannedFinish, weekEnd) <= 0)
    .reduce((sum, activity) => sum + activityPlannedWeight(activity), 0);
  const actualWeightedPercent = weighted
    .reduce((sum, activity) => sum + activityPlannedWeight(activity) * clampPercent(activity.percentComplete), 0);
  const projectProgress = {
    planPercent: roundPercent((plannedDoneWeight / totalWeight) * 100),
    actualPercent: roundPercent(actualWeightedPercent / totalWeight),
    variance: roundPercent((actualWeightedPercent / totalWeight) - (plannedDoneWeight / totalWeight) * 100),
  };
  const thisWeekCompleted = list.filter((activity) => activity.actualFinish && dateInRange(activity.actualFinish, weekStart, weekEnd));
  const thisWeekPlannedUnfinished = list.filter((activity) =>
    activity.plannedFinish &&
    dateInRange(activity.plannedFinish, weekStart, weekEnd) &&
    calculateActivityScheduleStatus(activity, weekEnd) !== "completed" &&
    calculateActivityScheduleStatus(activity, weekEnd) !== "early",
  );
  const nextWindowEnd = addDays(weekEnd, Number(options.lookAheadDays || 30) || 30);
  const nextWeekPlan = list.filter((activity) =>
    activity.plannedStart &&
    compareDate(activity.plannedStart, weekEnd) > 0 &&
    compareDate(activity.plannedStart, nextWindowEnd) <= 0,
  );
  const milestones = list
    .filter((activity) => activity.type === "Milestone")
    .map((activity) => ({
      activityId: activity.id,
      name: activity.name,
      plannedFinish: activity.plannedFinish,
      status: calculateActivityScheduleStatus(activity, dataDate),
      risk: Number(activity.totalFloatHours || 0) < 0 ? "存在风险" : "待评估",
    }));
  const compact = (activity) => ({
    activityId: activity.id,
    name: activity.name,
    plannedStart: activity.plannedStart,
    plannedFinish: activity.plannedFinish,
    actualStart: activity.actualStart,
    actualFinish: activity.actualFinish,
    percentComplete: clampPercent(activity.percentComplete),
    status: calculateActivityScheduleStatus(activity, dataDate),
  });
  return {
    weekStart,
    weekEnd,
    dataDate,
    projectProgress,
    thisWeekCompleted: thisWeekCompleted.map(compact),
    thisWeekPlannedUnfinished: thisWeekPlannedUnfinished.map(compact),
    nextWeekPlan: nextWeekPlan.map(compact),
    milestones,
  };
}

function roundPercent(value) {
  const number = Number(value || 0);
  return Math.round(number * 10) / 10;
}

function buildSCurve(activities, options = {}) {
  const list = (Array.isArray(activities) ? activities : []).filter((activity) => activityPlannedWeight(activity) > 0);
  if (!list.length) return [];
  const start = normalizeDate(options.start) || list.map((item) => item.plannedStart).filter(Boolean).sort()[0] || new Date().toISOString().slice(0, 10);
  const end = normalizeDate(options.end) || list.map((item) => item.plannedFinish).filter(Boolean).sort().slice(-1)[0] || start;
  const intervalDays = Math.max(1, Number(options.intervalDays || 7) || 7);
  const total = list.length || 1;
  const points = [];
  for (let cursor = start; compareDate(cursor, end) <= 0; cursor = addDays(cursor, intervalDays)) {
    const planned = list.filter((activity) => activity.plannedFinish && compareDate(activity.plannedFinish, cursor) <= 0).length;
    const actual = list.reduce((sum, activity) => {
      if (activity.actualFinish && compareDate(activity.actualFinish, cursor) <= 0) return sum + 1;
      if (activity.actualStart && compareDate(activity.actualStart, cursor) <= 0) return sum + clampPercent(activity.percentComplete) / 100;
      return sum;
    }, 0);
    points.push({
      date: cursor,
      plannedPercent: roundPercent((planned / total) * 100),
      actualPercent: roundPercent((actual / total) * 100),
    });
    if (cursor === end) break;
  }
  if (points[points.length - 1]?.date !== end) {
    const planned = list.filter((activity) => activity.plannedFinish && compareDate(activity.plannedFinish, end) <= 0).length;
    const actual = list.reduce((sum, activity) => {
      if (activity.actualFinish && compareDate(activity.actualFinish, end) <= 0) return sum + 1;
      if (activity.actualStart && compareDate(activity.actualStart, end) <= 0) return sum + clampPercent(activity.percentComplete) / 100;
      return sum;
    }, 0);
    points.push({ date: end, plannedPercent: roundPercent((planned / total) * 100), actualPercent: roundPercent((actual / total) * 100) });
  }
  return points;
}

function buildDisciplineProgressMatrix(activities, mappings, modelElements, date) {
  const elements = (Array.isArray(modelElements) ? modelElements : []).map(normalizeModelElement);
  const elementByKey = new Map();
  elements.forEach((element) => {
    if (element.uniqueId) elementByKey.set(`u:${element.uniqueId}`, element);
    if (element.dbId !== null && element.dbId !== undefined) elementByKey.set(`d:${element.dbId}`, element);
  });
  const disciplineActivityIds = new Map();
  (Array.isArray(mappings) ? mappings : []).forEach((mapping) => {
    const element = (mapping.uniqueId && elementByKey.get(`u:${mapping.uniqueId}`)) || elementByKey.get(`d:${mapping.dbId}`);
    const discipline = safeText(element?.discipline, "未分类");
    const set = disciplineActivityIds.get(discipline) || new Set();
    set.add(mapping.activityId);
    disciplineActivityIds.set(discipline, set);
  });
  const byId = new Map((Array.isArray(activities) ? activities : []).map((activity) => [activity.id, activity]));
  return Array.from(disciplineActivityIds.entries()).map(([discipline, ids]) => {
    const related = Array.from(ids).map((id) => byId.get(id)).filter(Boolean).filter((activity) => activityPlannedWeight(activity) > 0);
    const total = related.length || 1;
    const planned = related.filter((activity) => activity.plannedFinish && compareDate(activity.plannedFinish, date) <= 0).length;
    const actual = related.reduce((sum, activity) => sum + clampPercent(activity.percentComplete) / 100, 0);
    const delayed = related.some((activity) => calculateActivityScheduleStatus(activity, date) === "delayed");
    const variance = roundPercent((actual / total) * 100 - (planned / total) * 100);
    return {
      discipline,
      planPercent: roundPercent((planned / total) * 100),
      actualPercent: roundPercent((actual / total) * 100),
      variance,
      status: delayed ? "滞后" : variance >= 0 ? "正常" : "轻微滞后",
      activityCount: related.length,
    };
  }).sort((left, right) => safeText(left.discipline, "").localeCompare(safeText(right.discipline, ""), "zh-CN"));
}

module.exports = {
  STATUS_COLORS,
  STATUS_LABELS,
  parseXerSchedule,
  buildXerImportPreview,
  autoMapScheduleActivities,
  calculateActivityScheduleStatus,
  calculateElementScheduleStatus,
  buildScheduleTimeline,
  generateScheduleAlerts,
  buildWeeklyProgressReport,
  buildSCurve,
  buildDisciplineProgressMatrix,
  normalizeDate,
  normalizeModelElement,
};
