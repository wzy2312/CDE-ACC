import json
import os
import sys
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

from pdf_font_utils import register_pdf_font

FONT_NAME = "RedlineArialUnicode"
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 46
TOP_Y = PAGE_HEIGHT - 52
BOTTOM_Y = 48
LINE_HEIGHT = 17


def main():
    if len(sys.argv) != 4:
        raise SystemExit("usage: export_drawing_redline_report.py <store_json> <task_id> <output_pdf>")

    store_path, task_id, output_pdf = sys.argv[1:]
    register_font()

    with open(store_path, "r", encoding="utf-8") as handle:
        store = json.load(handle)

    task = find_by_id(store.get("drawingRedlineTasks", []), task_id)
    if not task:
        raise SystemExit("drawing redline task not found in store")

    document = find_by_id(store.get("documents", []), task.get("documentId") or task.get("fileId")) or {}
    records = [item for item in store.get("drawingRedlineRecords", []) if safe_text(item.get("taskId")) == safe_text(task_id)]
    title_changes = [item for item in store.get("drawingRedlineTitleBlockChanges", []) if safe_text(item.get("taskId")) == safe_text(task_id)]
    ai_result = next((item for item in store.get("drawingRedlineAiResults", []) if safe_text(item.get("taskId")) == safe_text(task_id)), {})

    os.makedirs(os.path.dirname(output_pdf), exist_ok=True)
    pdf = canvas.Canvas(output_pdf, pagesize=A4)
    pdf.setTitle(f"Drawing Redline Report - {safe_text(task.get('fileName'), 'Drawing')}")

    cursor_y = draw_title(pdf, task, document)
    cursor_y = draw_section(pdf, cursor_y, "基本信息", [
        f"图纸编号：{safe_text(task.get('drawingNo'), '—')}",
        f"图纸名称：{safe_text(task.get('drawingName'), safe_text(task.get('fileName'), '—'))}",
        f"专业：{safe_text(task.get('discipline'), '—')}",
        f"版本 A：{safe_text(task.get('versionALabel'), '—')}（{format_datetime(task.get('versionAUploadedAt')) or '—'}）",
        f"版本 B：{safe_text(task.get('versionBLabel'), '—')}（{format_datetime(task.get('versionBUploadedAt')) or '—'}）",
        f"对比完成时间：{format_datetime(task.get('completedAt') or task.get('updatedAt'))}",
    ])

    cursor_y = draw_section(pdf, cursor_y, "图框变更摘要", [
        f"{item.get('field', '字段')}：{safe_text(item.get('valueA'), '—')} → {safe_text(item.get('valueB'), '—')}"
        for item in title_changes
    ] or ["未发现需要单独列出的图框字段变化。"])

    cursor_y = draw_section(pdf, cursor_y, "AI 变更说明", [
        safe_text(ai_result.get("summary"), "AI 语义解读未生成。")
    ])

    summary = summarize_records(records)
    cursor_y = draw_section(pdf, cursor_y, "差异统计", [
        f"涉及页数：{summary['pages']}",
        f"新增内容：{summary['added']}",
        f"删除内容：{summary['deleted']}",
        f"修改内容：{summary['modified']}",
        f"移动内容：{summary['moved']}",
        f"已关联 Issue：{summary['linked']}",
    ])

    cursor_y = draw_table_header(pdf, cursor_y)
    for index, record in enumerate(sorted_records(records), start=1):
        row_lines = [
            f"{index}. P{record.get('page') or 1} · {diff_type_label(record.get('diffType'))} · {position_label(record)}",
            f"内容：{safe_text(record.get('contentSummary'), safe_text(record.get('textA'), '空') + ' → ' + safe_text(record.get('textB'), '空'))}",
            f"AI：{safe_text(record.get('aiInterpretation'), '—')}",
            f"Issue：{safe_text(record.get('issueId'), '未关联')}",
        ]
        cursor_y = draw_wrapped_lines(pdf, cursor_y, row_lines, indent=8, fill=diff_type_color(record.get("diffType")))

    pdf.showPage()
    pdf.save()


def register_font():
    return register_pdf_font(FONT_NAME)


def safe_text(value, fallback=""):
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def find_by_id(items, item_id):
    return next((item for item in items if safe_text(item.get("id")) == safe_text(item_id)), None)


def format_datetime(value):
    raw = safe_text(value)
    if not raw:
        return ""
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return raw


def diff_type_label(value):
    return {
        "added": "新增",
        "deleted": "删除",
        "modified": "修改",
        "moved": "移动",
    }.get(safe_text(value), safe_text(value, "修改"))


def diff_type_color(value):
    return {
        "added": colors.HexColor("#E9F7F0"),
        "deleted": colors.HexColor("#FCE8E8"),
        "modified": colors.HexColor("#FFF5D8"),
        "moved": colors.HexColor("#FFEEDC"),
    }.get(safe_text(value), colors.HexColor("#F3F6FA"))


def position_label(record):
    bbox = record.get("bbox") if isinstance(record.get("bbox"), dict) else {}
    return "x={:.1f}%, y={:.1f}%, w={:.1f}%, h={:.1f}%".format(
        float(bbox.get("x", 0) or 0) * 100,
        float(bbox.get("y", 0) or 0) * 100,
        float(bbox.get("width", 0) or 0) * 100,
        float(bbox.get("height", 0) or 0) * 100,
    )


def summarize_records(records):
    pages = {int(item.get("page") or 1) for item in records}
    return {
        "pages": len(pages),
        "added": sum(1 for item in records if safe_text(item.get("diffType")) == "added"),
        "deleted": sum(1 for item in records if safe_text(item.get("diffType")) == "deleted"),
        "modified": sum(1 for item in records if safe_text(item.get("diffType")) == "modified"),
        "moved": sum(1 for item in records if safe_text(item.get("diffType")) == "moved"),
        "linked": sum(1 for item in records if safe_text(item.get("issueId"))),
    }


def sorted_records(records):
    order = {"deleted": 0, "added": 1, "modified": 2, "moved": 3}
    return sorted(records, key=lambda item: (int(item.get("page") or 1), order.get(safe_text(item.get("diffType")), 9)))


def use_font(pdf, size=10, bold=False):
    pdf.setFont(register_font(), size)


def draw_title(pdf, task, document):
    use_font(pdf, 18)
    pdf.setFillColor(colors.HexColor("#102033"))
    pdf.drawString(MARGIN_X, TOP_Y, "图纸版本红线对比报告")
    use_font(pdf, 10)
    pdf.setFillColor(colors.HexColor("#6B7C91"))
    pdf.drawString(MARGIN_X, TOP_Y - 22, f"{safe_text(task.get('fileName'), safe_text(document.get('name'), '未命名图纸'))}")
    pdf.setStrokeColor(colors.HexColor("#D9E3F0"))
    pdf.line(MARGIN_X, TOP_Y - 34, PAGE_WIDTH - MARGIN_X, TOP_Y - 34)
    return TOP_Y - 54


def draw_section(pdf, cursor_y, title, lines):
    cursor_y = ensure_space(pdf, cursor_y, 52)
    use_font(pdf, 12)
    pdf.setFillColor(colors.HexColor("#172033"))
    pdf.drawString(MARGIN_X, cursor_y, title)
    cursor_y -= LINE_HEIGHT
    return draw_wrapped_lines(pdf, cursor_y, lines or ["—"], indent=0)


def draw_table_header(pdf, cursor_y):
    cursor_y = ensure_space(pdf, cursor_y, 44)
    use_font(pdf, 12)
    pdf.setFillColor(colors.HexColor("#172033"))
    pdf.drawString(MARGIN_X, cursor_y, "差异明细列表")
    return cursor_y - LINE_HEIGHT


def draw_wrapped_lines(pdf, cursor_y, lines, indent=0, fill=None):
    for line in lines:
        wrapped = wrap_text(safe_text(line, "—"), 86 if indent else 92)
        block_height = LINE_HEIGHT * len(wrapped) + 8
        cursor_y = ensure_space(pdf, cursor_y, block_height)
        if fill:
            pdf.setFillColor(fill)
            pdf.roundRect(MARGIN_X + indent - 4, cursor_y - block_height + 12, PAGE_WIDTH - 2 * MARGIN_X - indent + 8, block_height, 6, fill=1, stroke=0)
        use_font(pdf, 9)
        pdf.setFillColor(colors.HexColor("#26364D"))
        for text in wrapped:
            pdf.drawString(MARGIN_X + indent, cursor_y, text)
            cursor_y -= LINE_HEIGHT
        cursor_y -= 4
    return cursor_y


def wrap_text(value, width):
    text = safe_text(value)
    if len(text) <= width:
        return [text]
    return [text[index:index + width] for index in range(0, len(text), width)]


def ensure_space(pdf, cursor_y, required):
    if cursor_y - required >= BOTTOM_Y:
        return cursor_y
    pdf.showPage()
    return TOP_Y


if __name__ == "__main__":
    main()
