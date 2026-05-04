import json
import sys

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
FONT_NAME = "WorkflowArialUnicode"
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 46
TOP_Y = PAGE_HEIGHT - 54
BOTTOM_Y = 48
LINE_HEIGHT = 18


def main():
    if len(sys.argv) != 4:
        raise SystemExit("usage: export_workflow_report.py <store_json> <workflow_id> <output_pdf>")

    store_path, workflow_id, output_pdf = sys.argv[1:]
    register_font()

    with open(store_path, "r", encoding="utf-8") as handle:
        store = json.load(handle)

    workflows = store.get("workflows", []) if isinstance(store, dict) else []
    documents = store.get("documents", []) if isinstance(store, dict) else []
    users = store.get("users", []) if isinstance(store, dict) else []

    workflow = next((item for item in workflows if str(item.get("id")) == workflow_id), None)
    if not workflow:
        raise SystemExit("workflow not found in store")

    pdf = canvas.Canvas(output_pdf, pagesize=A4)
    pdf.setTitle(f"Workflow Report - {workflow.get('workflowName', 'Workflow')}")

    cursor_y = TOP_Y
    cursor_y = draw_title(pdf, cursor_y, workflow)
    cursor_y = draw_section(pdf, cursor_y, "流程概览", [
        f"流程名称：{workflow.get('workflowName', '未命名流程')}",
        f"模板：{workflow.get('templateName', '临时流程')}",
        f"分类：{workflow.get('templateCategory', '项目级流程')}",
        f"状态：{workflow_status_label(workflow.get('status'))}",
        f"发起人：{workflow.get('initiator', '系统')}",
        f"发起时间：{format_datetime(workflow.get('createdAt'))}",
        f"截止时间：{workflow.get('dueDate') or '—'}",
        f"说明：{workflow.get('description') or '未填写'}",
    ])

    file_lookup = {str(item.get("id")): item for item in documents}
    related_files = []
    for file_ref in workflow.get("fileRefs", []) or []:
        doc = file_lookup.get(str(file_ref.get("docId")))
        if doc:
            related_files.append(
                f"{doc.get('name', '未命名文件')} · {doc.get('version', 'V1')} · {doc.get('status', 'uploaded')}"
            )
        else:
            related_files.append(file_ref.get("name", "未命名文件"))
    cursor_y = draw_section(pdf, cursor_y, "关联文件", related_files or ["当前流程未关联文件"])

    step_lines = []
    for index, step in enumerate(workflow.get("steps", []) or [], start=1):
        reviewers = []
        for reviewer in step.get("reviewers", []) or []:
            reviewers.append(
                f"{reviewer.get('name', '未命名审批人')}（{reviewer_status_label(reviewer.get('status'))}）"
            )
        step_lines.append(
            f"{index}. {step.get('name', f'Step {index}')} · {step_mode_label(step.get('mode'))} · {reviewer_join(reviewers)}"
        )
        comment_lines = []
        for reviewer in step.get("reviewers", []) or []:
            comment = str(reviewer.get("comment") or "").strip()
            if comment:
                comment_lines.append(f"   - {reviewer.get('name', '审批人')}：{comment}")
        step_lines.extend(comment_lines)
    cursor_y = draw_section(pdf, cursor_y, "审批步骤", step_lines or ["当前流程未配置审批步骤"])

    export_files = []
    auto_export = workflow.get("autoExport") or {}
    export_target = auto_export.get("targetPath") or "未配置"
    export_files.append(f"自动导出：{'已启用' if auto_export.get('enabled') else '未启用'}")
    export_files.append(f"目标路径：{export_target}")
    export_files.append(f"命名规则：{auto_export.get('namingRule') or '未配置'}")
    if auto_export.get("files"):
        export_files.extend([f"导出文件：{item.get('name', '导出文件')} · {item.get('url', '')}" for item in auto_export.get("files", [])])
    cursor_y = draw_section(pdf, cursor_y, "导出结果", export_files)

    crs_draft = workflow.get("crsDraft") or {}
    crs_report = crs_draft.get("report") or {}
    crs_items = crs_report.get("items") or []
    if crs_items or crs_report.get("executiveSummary"):
        crs_lines = [
            f"生成状态：{crs_draft.get('status') or 'idle'}",
            f"确认状态：{'已确认' if crs_draft.get('confirmedAt') else '待确认'}",
            f"文件名：{crs_report.get('fileName') or '—'}",
            f"版本号：{crs_report.get('versionLabel') or '—'}",
            f"审批周期：{crs_report.get('approvalCycle') or '—'}",
            f"执行摘要：{crs_report.get('executiveSummary') or '—'}",
            f"未解决意见汇总：{crs_report.get('unresolvedSummary') or '—'}",
        ]
        manual_items = crs_report.get("manualCheckItems") or []
        if manual_items:
            crs_lines.append("需人工确认项：")
            crs_lines.extend([f" - {item}" for item in manual_items])
        if crs_items:
            crs_lines.append("结构化 CRS 草稿：")
            for item in crs_items[:16]:
                crs_lines.append(
                    " - "
                    + f"{item.get('index', '')}. "
                    + f"{item.get('source', '系统')} / {item.get('discipline', '综合')} / "
                    + f"{item.get('issueType', '其他')} / 状态：{item.get('status', 'open')} / "
                    + f"意见：{item.get('issueContent', '—')} / 回复：{item.get('replyContent', '—')} / "
                    + f"结论：{item.get('conclusion', '—')}"
                )
        cursor_y = draw_section(pdf, cursor_y, "AI CRS 草稿", crs_lines)

    activity_lines = []
    user_lookup = {str(item.get("id")): item.get("name", "") for item in users}
    for item in workflow.get("activity", []) or []:
        actor = item.get("actor") or user_lookup.get(str(item.get("userId") or ""), "") or "系统"
        activity_lines.append(
            f"{format_datetime(item.get('timestamp'))} · {actor} · {item.get('label', '流程动作')} · {item.get('note') or '—'}"
        )
    draw_section(pdf, cursor_y, "流程活动", activity_lines or ["当前还没有流程活动记录"])

    pdf.save()


def register_font():
    if FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH))


def draw_title(pdf, cursor_y, workflow):
    pdf.setFont(FONT_NAME, 18)
    pdf.drawString(MARGIN_X, cursor_y, "审批记录单")
    cursor_y -= 28
    pdf.setFont(FONT_NAME, 11)
    pdf.drawString(MARGIN_X, cursor_y, f"流程编号：{workflow.get('id', '—')}")
    return cursor_y - 22


def draw_section(pdf, cursor_y, title, lines):
    cursor_y = ensure_space(pdf, cursor_y, 44)
    pdf.setFont(FONT_NAME, 13)
    pdf.drawString(MARGIN_X, cursor_y, title)
    cursor_y -= 18
    pdf.setLineWidth(0.6)
    pdf.line(MARGIN_X, cursor_y, PAGE_WIDTH - MARGIN_X, cursor_y)
    cursor_y -= 14
    pdf.setFont(FONT_NAME, 10.5)
    for line in lines:
        wrapped = wrap_text(str(line or "—"), PAGE_WIDTH - MARGIN_X * 2, 10.5)
        for item in wrapped:
            cursor_y = ensure_space(pdf, cursor_y, LINE_HEIGHT)
            pdf.drawString(MARGIN_X, cursor_y, item)
            cursor_y -= LINE_HEIGHT
    return cursor_y - 8


def ensure_space(pdf, cursor_y, needed_height):
    if cursor_y - needed_height >= BOTTOM_Y:
        return cursor_y
    pdf.showPage()
    pdf.setFont(FONT_NAME, 10.5)
    return TOP_Y


def wrap_text(text, max_width, font_size):
    if not text:
        return [""]
    lines = []
    current = ""
    for char in text:
        candidate = f"{current}{char}"
        if pdfmetrics.stringWidth(candidate, FONT_NAME, font_size) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = char
    if current:
        lines.append(current)
    return lines or [text]


def workflow_status_label(status):
    return {
        "running": "流转中",
        "approved": "已完成",
        "rejected": "已退回",
        "withdrawn": "已撤回",
        "draft": "草稿",
    }.get(str(status or "").strip(), "流转中")


def reviewer_status_label(status):
    return {
        "pending": "待处理",
        "approved": "已通过",
        "rejected": "已驳回",
        "skipped": "已跳过",
    }.get(str(status or "").strip(), "待处理")


def step_mode_label(mode):
    return {
        "single": "串联单签",
        "parallel_all": "并联全签",
        "parallel_any": "并联任一通过",
    }.get(str(mode or "").strip(), "串联单签")


def reviewer_join(items):
    return " / ".join(items) if items else "未指定"


def format_datetime(value):
    raw = str(value or "").strip()
    if not raw:
        return "—"
    return raw.replace("T", " ").replace("Z", "")


if __name__ == "__main__":
    main()
