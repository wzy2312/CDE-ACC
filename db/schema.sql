-- CDE document workflow demo database schema.
-- Target engine: SQLite for local/dev migration, intentionally compatible with a future PostgreSQL repository layer.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  folder_policy_key TEXT NOT NULL DEFAULT 'cde_standard',
  member_init_mode TEXT NOT NULL DEFAULT 'creator_only',
  member_source_project_id TEXT NOT NULL DEFAULT '',
  template_init_mode TEXT NOT NULL DEFAULT 'default_templates',
  template_source_project_id TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'system',
  guest_policy_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  platform_role TEXT NOT NULL DEFAULT 'user',
  password_salt TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  password_updated_at TEXT NOT NULL DEFAULT '',
  last_login_at TEXT NOT NULL DEFAULT '',
  invited_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'guest',
  invited_by TEXT NOT NULL DEFAULT '',
  invited_at TEXT NOT NULL DEFAULT '',
  invite_token TEXT NOT NULL DEFAULT '',
  invite_expires_at TEXT NOT NULL DEFAULT '',
  invite_accepted_at TEXT NOT NULL DEFAULT '',
  joined_at TEXT NOT NULL DEFAULT '',
  removed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id, removed_at)
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  policy_key TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT '项目组',
  access_level TEXT NOT NULL DEFAULT 'edit',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, parent_id, name)
);

CREATE TABLE IF NOT EXISTS folder_permissions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'viewer',
  set_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, folder_id, user_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  current_version_id TEXT NOT NULL DEFAULT '',
  stored_file_name TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  version_label TEXT NOT NULL DEFAULT 'V1',
  status TEXT NOT NULL DEFAULT 'uploaded',
  workflow_name TEXT NOT NULL DEFAULT '',
  initiator TEXT NOT NULL DEFAULT '',
  reviewer TEXT NOT NULL DEFAULT '',
  approver TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  uploaded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  uploader_id TEXT NOT NULL DEFAULT '',
  uploader TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  is_pdf INTEGER NOT NULL DEFAULT 0,
  access_level TEXT NOT NULL DEFAULT 'edit',
  download_scope TEXT NOT NULL DEFAULT 'team',
  watermark_enabled INTEGER NOT NULL DEFAULT 1,
  checked_out_by TEXT NOT NULL DEFAULT '',
  checked_out_at TEXT NOT NULL DEFAULT '',
  active_workflow_id TEXT NOT NULL DEFAULT '',
  last_export_file_name TEXT NOT NULL DEFAULT '',
  parse_status TEXT NOT NULL DEFAULT 'done',
  parse_ready_at TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  share_json TEXT NOT NULL DEFAULT '{}',
  drawing_metadata_json TEXT NOT NULL DEFAULT '{}',
  aps_json TEXT NOT NULL DEFAULT '{}',
  activity_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL DEFAULT 'V1',
  version_no INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  uploaded_at TEXT NOT NULL,
  uploaded_by_id TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  parse_status TEXT NOT NULL DEFAULT 'done',
  parse_ready_at TEXT NOT NULL DEFAULT '',
  is_current INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT NOT NULL DEFAULT '',
  deleted_by TEXT NOT NULL DEFAULT '',
  share_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS document_workflows (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  PRIMARY KEY(document_id, workflow_id)
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'note',
  variant TEXT NOT NULL DEFAULT '',
  page INTEGER NOT NULL DEFAULT 1,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  width REAL NOT NULL DEFAULT 0,
  height REAL NOT NULL DEFAULT 0,
  points_json TEXT NOT NULL DEFAULT '[]',
  title TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  viewer_state_json TEXT NOT NULL DEFAULT '{}',
  dbids_json TEXT NOT NULL DEFAULT '[]',
  model_urn TEXT NOT NULL DEFAULT '',
  sheet_guid TEXT NOT NULL DEFAULT '',
  element_unique_id TEXT NOT NULL DEFAULT '',
  element_id TEXT NOT NULL DEFAULT '',
  bound_model_version TEXT NOT NULL DEFAULT '',
  migration_status TEXT NOT NULL DEFAULT 'synced',
  precheck_task_id TEXT NOT NULL DEFAULT '',
  precheck_result_id TEXT NOT NULL DEFAULT '',
  precheck_level TEXT NOT NULL DEFAULT '',
  precheck_category TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS annotation_replies (
  id TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  actor TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  allowed_roles_json TEXT NOT NULL DEFAULT '[]',
  auto_export_json TEXT NOT NULL DEFAULT '{}',
  steps_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL DEFAULT '',
  workflow_name TEXT NOT NULL,
  template_id TEXT NOT NULL DEFAULT '',
  template_name TEXT NOT NULL DEFAULT '',
  template_category TEXT NOT NULL DEFAULT '',
  initiator TEXT NOT NULL DEFAULT '',
  initiator_user_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running',
  current_step_index INTEGER NOT NULL DEFAULT 0,
  steps_json TEXT NOT NULL DEFAULT '[]',
  file_refs_json TEXT NOT NULL DEFAULT '[]',
  activity_json TEXT NOT NULL DEFAULT '[]',
  auto_export_json TEXT NOT NULL DEFAULT '{}',
  health_gate_overrides_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT '',
  resource_id TEXT NOT NULL DEFAULT '',
  detail_json TEXT NOT NULL DEFAULT '{}',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  resource_type TEXT NOT NULL DEFAULT '',
  resource_id TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_geometry_extraction_tasks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL DEFAULT '',
  version_id TEXT NOT NULL DEFAULT '',
  model_urn TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'aps-properties',
  status TEXT NOT NULL DEFAULT 'queued',
  parser_version TEXT NOT NULL DEFAULT '',
  derivative_urn TEXT NOT NULL DEFAULT '',
  indexed_count INTEGER NOT NULL DEFAULT 0,
  mesh_count INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  summary_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_model_geometry_extraction_tasks_document ON model_geometry_extraction_tasks(document_id, status);

CREATE TABLE IF NOT EXISTS model_health_rulesets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT '',
  discipline TEXT NOT NULL DEFAULT 'general',
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  rules_json TEXT NOT NULL DEFAULT '{}',
  gate_config_json TEXT NOT NULL DEFAULT '{}',
  version TEXT NOT NULL DEFAULT '1.0.0',
  built_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_health_tasks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  version_id TEXT NOT NULL DEFAULT '',
  version_label TEXT NOT NULL DEFAULT '',
  ruleset_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  score REAL NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL DEFAULT '{}',
  report_json TEXT NOT NULL DEFAULT '{}',
  gate_json TEXT NOT NULL DEFAULT '{}',
  triggered_by TEXT NOT NULL DEFAULT '',
  triggered_by_name TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  override_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS model_health_rule_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES model_health_tasks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL DEFAULT '',
  file_id TEXT NOT NULL DEFAULT '',
  rule_id TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'error',
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  dbids_json TEXT NOT NULL DEFAULT '[]',
  actual_value TEXT NOT NULL DEFAULT '',
  expected_value TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_health_ai_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES model_health_tasks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL DEFAULT '',
  file_id TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  dbids_json TEXT NOT NULL DEFAULT '[]',
  reference_dbids_json TEXT NOT NULL DEFAULT '[]',
  confidence TEXT NOT NULL DEFAULT 'medium',
  action_required INTEGER NOT NULL DEFAULT 1,
  feedback_status TEXT NOT NULL DEFAULT 'open',
  status TEXT NOT NULL DEFAULT 'open',
  provider TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_health_false_positive_records (
  id TEXT PRIMARY KEY,
  ai_result_id TEXT NOT NULL REFERENCES model_health_ai_results(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL DEFAULT '',
  marked_by TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_health_tasks_file ON model_health_tasks(file_id, status);
CREATE INDEX IF NOT EXISTS idx_model_health_rule_results_task ON model_health_rule_results(task_id, status);
CREATE INDEX IF NOT EXISTS idx_model_health_ai_results_task ON model_health_ai_results(task_id, feedback_status);
CREATE INDEX IF NOT EXISTS idx_model_health_rulesets_project ON model_health_rulesets(project_id, discipline);

CREATE TABLE IF NOT EXISTS quantity_takeoff_tasks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL DEFAULT '',
  model_urn TEXT NOT NULL DEFAULT '',
  version_id TEXT NOT NULL DEFAULT '',
  version_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  snapshot_count INTEGER NOT NULL DEFAULT 0,
  summary_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quantity_property_snapshots (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES quantity_takeoff_tasks(id) ON DELETE CASCADE,
  dbid INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  element_type TEXT NOT NULL DEFAULT '',
  properties_json TEXT NOT NULL DEFAULT '{}',
  floor TEXT NOT NULL DEFAULT '',
  discipline TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  area REAL NOT NULL DEFAULT 0,
  length REAL NOT NULL DEFAULT 0,
  volume REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quantity_summaries (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES quantity_takeoff_tasks(id) ON DELETE CASCADE,
  element_type TEXT NOT NULL DEFAULT '',
  floor TEXT NOT NULL DEFAULT '',
  discipline TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  area REAL NOT NULL DEFAULT 0,
  length REAL NOT NULL DEFAULT 0,
  volume REAL NOT NULL DEFAULT 0,
  dbids_json TEXT NOT NULL DEFAULT '[]',
  dimensions_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS quantity_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_diff_tasks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  version_a_id TEXT NOT NULL DEFAULT '',
  version_a_label TEXT NOT NULL DEFAULT '',
  version_b_id TEXT NOT NULL DEFAULT '',
  version_b_label TEXT NOT NULL DEFAULT '',
  model_urn_a TEXT NOT NULL DEFAULT '',
  model_urn_b TEXT NOT NULL DEFAULT '',
  snapshot_a_id TEXT NOT NULL DEFAULT '',
  snapshot_b_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  tolerance_mm REAL NOT NULL DEFAULT 10,
  coordinate_unit TEXT NOT NULL DEFAULT 'm',
  summary_json TEXT NOT NULL DEFAULT '{}',
  record_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  notification_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS model_diff_snapshots (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL DEFAULT '',
  version_id TEXT NOT NULL DEFAULT '',
  version_label TEXT NOT NULL DEFAULT '',
  model_urn TEXT NOT NULL DEFAULT '',
  payload_hash TEXT NOT NULL DEFAULT '',
  extraction_source TEXT NOT NULL DEFAULT 'model-diff',
  object_count INTEGER NOT NULL DEFAULT 0,
  elements_json TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_diff_records (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES model_diff_tasks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL DEFAULT '',
  document_id TEXT NOT NULL DEFAULT '',
  unique_id TEXT NOT NULL DEFAULT '',
  stable_key TEXT NOT NULL DEFAULT '',
  element_id TEXT NOT NULL DEFAULT '',
  diff_type TEXT NOT NULL DEFAULT 'unchanged',
  diff_types_json TEXT NOT NULL DEFAULT '[]',
  element_type TEXT NOT NULL DEFAULT '',
  floor TEXT NOT NULL DEFAULT '',
  discipline TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  dbid_before INTEGER,
  dbid_after INTEGER,
  dbids_json TEXT NOT NULL DEFAULT '[]',
  props_before_json TEXT NOT NULL DEFAULT '{}',
  props_after_json TEXT NOT NULL DEFAULT '{}',
  changed_props_json TEXT NOT NULL DEFAULT '[]',
  changed_prop_count INTEGER NOT NULL DEFAULT 0,
  bbox_before_json TEXT NOT NULL DEFAULT '{}',
  bbox_after_json TEXT NOT NULL DEFAULT '{}',
  bbox_delta_json TEXT NOT NULL DEFAULT '{}',
  match_method TEXT NOT NULL DEFAULT 'stable',
  issue_id TEXT NOT NULL DEFAULT '',
  issue_status TEXT NOT NULL DEFAULT 'unlinked',
  color TEXT NOT NULL DEFAULT '',
  unmatched_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_diff_prop_changes (
  id TEXT PRIMARY KEY,
  diff_id TEXT NOT NULL REFERENCES model_diff_records(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL DEFAULT '',
  prop_name TEXT NOT NULL DEFAULT '',
  value_a TEXT NOT NULL DEFAULT '',
  value_b TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS model_diff_ai_summaries (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES model_diff_tasks(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  detail_by_discipline_json TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_diff_tasks_file_pair ON model_diff_tasks(document_id, version_a_id, version_b_id, status);
CREATE INDEX IF NOT EXISTS idx_model_diff_snapshots_version ON model_diff_snapshots(document_id, version_id, model_urn, expires_at);
CREATE INDEX IF NOT EXISTS idx_model_diff_records_task_type ON model_diff_records(task_id, diff_type, issue_id);
CREATE INDEX IF NOT EXISTS idx_model_diff_prop_changes_diff ON model_diff_prop_changes(diff_id);

CREATE TABLE IF NOT EXISTS model_clash_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'succeeded',
  rule_json TEXT NOT NULL DEFAULT '{}',
  summary_json TEXT NOT NULL DEFAULT '{}',
  record_ids_json TEXT NOT NULL DEFAULT '[]',
  issue_ids_json TEXT NOT NULL DEFAULT '[]',
  actor TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_clash_records (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id_a TEXT NOT NULL DEFAULT '',
  model_urn_a TEXT NOT NULL,
  dbid_a INTEGER NOT NULL,
  element_name_a TEXT NOT NULL DEFAULT '',
  discipline_a TEXT NOT NULL DEFAULT '',
  document_id_b TEXT NOT NULL DEFAULT '',
  model_urn_b TEXT NOT NULL,
  dbid_b INTEGER NOT NULL,
  element_name_b TEXT NOT NULL DEFAULT '',
  discipline_b TEXT NOT NULL DEFAULT '',
  clash_volume REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  issue_id TEXT NOT NULL DEFAULT '',
  responsibility_discipline TEXT NOT NULL DEFAULT '',
  center_json TEXT NOT NULL DEFAULT '[0,0,0]',
  intersection_box_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_clash_records_project_status ON model_clash_records(project_id, status);
CREATE INDEX IF NOT EXISTS idx_model_clash_records_issue_id ON model_clash_records(issue_id);

CREATE TABLE IF NOT EXISTS model_clash_heatmaps (
  id TEXT PRIMARY KEY,
  clash_task_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  grid_size REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'succeeded',
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_clash_heatmap_cells (
  id TEXT PRIMARY KEY,
  heatmap_id TEXT NOT NULL REFERENCES model_clash_heatmaps(id) ON DELETE CASCADE,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  z REAL NOT NULL DEFAULT 0,
  grid_size REAL NOT NULL DEFAULT 1,
  density INTEGER NOT NULL DEFAULT 0,
  discipline_pair TEXT NOT NULL DEFAULT '',
  record_ids_json TEXT NOT NULL DEFAULT '[]',
  bbox_json TEXT NOT NULL DEFAULT '{}',
  color TEXT NOT NULL DEFAULT '',
  intensity REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS model_clash_hotspots (
  id TEXT PRIMARY KEY,
  heatmap_id TEXT NOT NULL REFERENCES model_clash_heatmaps(id) ON DELETE CASCADE,
  bbox_json TEXT NOT NULL DEFAULT '{}',
  center_json TEXT NOT NULL DEFAULT '[0,0,0]',
  clash_count INTEGER NOT NULL DEFAULT 0,
  disciplines_json TEXT NOT NULL DEFAULT '[]',
  discipline_pairs_json TEXT NOT NULL DEFAULT '[]',
  open_issue_count INTEGER NOT NULL DEFAULT 0,
  record_ids_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_model_clash_heatmaps_task ON model_clash_heatmaps(clash_task_id, grid_size);
CREATE INDEX IF NOT EXISTS idx_model_clash_heatmap_cells_heatmap ON model_clash_heatmap_cells(heatmap_id, discipline_pair);
CREATE INDEX IF NOT EXISTS idx_model_clash_hotspots_heatmap ON model_clash_hotspots(heatmap_id, clash_count);

CREATE TABLE IF NOT EXISTS construction_schedule_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  model_urn TEXT NOT NULL DEFAULT '',
  version_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  p6_project_id TEXT NOT NULL DEFAULT '',
  data_date TEXT NOT NULL DEFAULT '',
  planned_start TEXT NOT NULL DEFAULT '',
  planned_finish TEXT NOT NULL DEFAULT '',
  is_baseline INTEGER NOT NULL DEFAULT 0,
  is_current INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'imported',
  activity_count INTEGER NOT NULL DEFAULT 0,
  mapped_activity_count INTEGER NOT NULL DEFAULT 0,
  import_summary_json TEXT NOT NULL DEFAULT '{}',
  xer_file_id TEXT NOT NULL DEFAULT '',
  imported_by TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS construction_schedule_wbs_nodes (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES construction_schedule_versions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wbs_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  parent_id TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  path TEXT NOT NULL DEFAULT '',
  sequence INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS construction_schedule_activities (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES construction_schedule_versions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL DEFAULT '',
  internal_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  wbs_id TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Task',
  planned_start TEXT NOT NULL DEFAULT '',
  planned_finish TEXT NOT NULL DEFAULT '',
  actual_start TEXT NOT NULL DEFAULT '',
  actual_finish TEXT NOT NULL DEFAULT '',
  percent_complete REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Not Started',
  total_float_hours REAL NOT NULL DEFAULT 0,
  calendar_id TEXT NOT NULL DEFAULT '',
  discipline TEXT NOT NULL DEFAULT '',
  deleted_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS construction_schedule_predecessors (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES construction_schedule_versions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  predecessor_id TEXT NOT NULL DEFAULT '',
  successor_id TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'FS',
  lag REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS construction_schedule_mappings (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES construction_schedule_versions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL DEFAULT '',
  activity_id TEXT NOT NULL DEFAULT '',
  activity_row_id TEXT NOT NULL DEFAULT '',
  model_urn TEXT NOT NULL DEFAULT '',
  dbid INTEGER NOT NULL DEFAULT 0,
  unique_id TEXT NOT NULL DEFAULT '',
  match_method TEXT NOT NULL DEFAULT 'manual',
  confidence TEXT NOT NULL DEFAULT 'Manual',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS construction_progress_reports (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES construction_schedule_versions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL DEFAULT '',
  activity_row_id TEXT NOT NULL DEFAULT '',
  reported_by TEXT NOT NULL DEFAULT '',
  reported_at TEXT NOT NULL,
  actual_start TEXT NOT NULL DEFAULT '',
  actual_finish TEXT NOT NULL DEFAULT '',
  percent_complete REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  attachments_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS construction_schedule_snapshots (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES construction_schedule_versions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  screenshot_url TEXT NOT NULL DEFAULT '',
  stats_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS construction_schedule_alerts (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES construction_schedule_versions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL DEFAULT '',
  activity_row_id TEXT NOT NULL DEFAULT '',
  activity_code TEXT NOT NULL DEFAULT '',
  activity_name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'medium',
  message TEXT NOT NULL DEFAULT '',
  planned_finish TEXT NOT NULL DEFAULT '',
  percent_complete REAL NOT NULL DEFAULT 0,
  delay_days INTEGER NOT NULL DEFAULT 0,
  dbids_json TEXT NOT NULL DEFAULT '[]',
  unique_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open',
  issue_id TEXT NOT NULL DEFAULT '',
  triggered_at TEXT NOT NULL DEFAULT '',
  resolved_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_construction_schedule_versions_document ON construction_schedule_versions(document_id, is_current, imported_at);
CREATE INDEX IF NOT EXISTS idx_construction_schedule_activities_schedule ON construction_schedule_activities(schedule_id, activity_id, status);
CREATE INDEX IF NOT EXISTS idx_construction_schedule_mappings_schedule ON construction_schedule_mappings(schedule_id, activity_id, unique_id);
CREATE INDEX IF NOT EXISTS idx_construction_schedule_alerts_schedule ON construction_schedule_alerts(schedule_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_construction_progress_reports_activity ON construction_progress_reports(schedule_id, activity_id, reported_at);

CREATE TABLE IF NOT EXISTS drawing_precheck_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  version_id TEXT NOT NULL DEFAULT '',
  version_label TEXT NOT NULL DEFAULT 'V1',
  status TEXT NOT NULL DEFAULT 'completed',
  checks_json TEXT NOT NULL DEFAULT '{}',
  gate_json TEXT NOT NULL DEFAULT '{}',
  summary_json TEXT NOT NULL DEFAULT '{}',
  report_json TEXT NOT NULL DEFAULT '{}',
  result_ids_json TEXT NOT NULL DEFAULT '[]',
  triggered_by TEXT NOT NULL DEFAULT '',
  triggered_by_name TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS drawing_precheck_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  version_id TEXT NOT NULL DEFAULT '',
  version_label TEXT NOT NULL DEFAULT 'V1',
  check_type TEXT NOT NULL DEFAULT 'rule',
  source TEXT NOT NULL DEFAULT 'rule',
  level TEXT NOT NULL DEFAULT 'info',
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  page INTEGER NOT NULL DEFAULT 1,
  position_json TEXT NOT NULL DEFAULT '{}',
  confidence TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  disposition TEXT NOT NULL DEFAULT '',
  annotation_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drawing_extraction_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  version_id TEXT NOT NULL DEFAULT '',
  version_label TEXT NOT NULL DEFAULT 'V1',
  text_content_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  diff_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drawing_rule_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  rules_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drawing_precheck_tasks_project_file ON drawing_precheck_tasks(project_id, file_id);
CREATE INDEX IF NOT EXISTS idx_drawing_precheck_results_task ON drawing_precheck_results(task_id, status);
CREATE INDEX IF NOT EXISTS idx_drawing_snapshots_file ON drawing_extraction_snapshots(file_id, version_id);

CREATE TABLE IF NOT EXISTS system_email_settings (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'smtp',
  host TEXT NOT NULL DEFAULT '',
  port INTEGER NOT NULL DEFAULT 587,
  encryption TEXT NOT NULL DEFAULT 'starttls',
  auth_required INTEGER NOT NULL DEFAULT 1,
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  sender_name TEXT NOT NULL DEFAULT '',
  sender_email TEXT NOT NULL DEFAULT '',
  reply_to TEXT NOT NULL DEFAULT '',
  subject_prefix TEXT NOT NULL DEFAULT '[CDE]',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_ai_settings (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'http',
  endpoint TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  timeout_ms INTEGER NOT NULL DEFAULT 20000,
  batch_size INTEGER NOT NULL DEFAULT 100,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_aps_settings (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'aps',
  client_id TEXT NOT NULL DEFAULT '',
  client_secret TEXT NOT NULL DEFAULT '',
  bucket_key TEXT NOT NULL DEFAULT '',
  bucket_policy TEXT NOT NULL DEFAULT 'persistent',
  bucket_region TEXT NOT NULL DEFAULT 'US',
  viewer_version TEXT NOT NULL DEFAULT '7.*',
  viewer_env TEXT NOT NULL DEFAULT 'AutodeskProduction2',
  viewer_api TEXT NOT NULL DEFAULT 'streamingV2',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_email_notifications (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0,
  include_guests INTEGER NOT NULL DEFAULT 0,
  digest_mode TEXT NOT NULL DEFAULT 'immediate',
  recipients_json TEXT NOT NULL DEFAULT '{}',
  events_json TEXT NOT NULL DEFAULT '{}',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_project_folder ON documents(project_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(project_id, status);
CREATE INDEX IF NOT EXISTS idx_versions_document ON document_versions(document_id, version_no);
CREATE INDEX IF NOT EXISTS idx_annotations_document ON annotations(document_id, version_id);
CREATE INDEX IF NOT EXISTS idx_replies_annotation ON annotation_replies(annotation_id);
CREATE INDEX IF NOT EXISTS idx_workflows_project_status ON workflows(project_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_time ON audit_logs(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON jobs(status, type);
CREATE INDEX IF NOT EXISTS idx_quantity_tasks_document ON quantity_takeoff_tasks(document_id, status);
CREATE INDEX IF NOT EXISTS idx_quantity_snapshots_task ON quantity_property_snapshots(task_id, element_type);
CREATE INDEX IF NOT EXISTS idx_quantity_summaries_task ON quantity_summaries(task_id, element_type);
CREATE INDEX IF NOT EXISTS idx_quantity_templates_project ON quantity_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_email_notifications_project ON project_email_notifications(project_id);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('001_initial_schema');
