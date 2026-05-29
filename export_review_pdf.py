import io
import json
import math
import os
import sys

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

from pdf_font_utils import register_pdf_font
from report_i18n import localize_text

FONT_NAME = "ReviewArialUnicode"


def main():
    if len(sys.argv) != 5:
        raise SystemExit("usage: export_review_pdf.py <store_json> <doc_id> <input_pdf> <output_pdf>")

    store_path, doc_id, input_pdf, output_pdf = sys.argv[1:]
    register_font()

    with open(store_path, "r", encoding="utf-8") as handle:
        store = json.load(handle)

    documents = store if isinstance(store, list) else store.get("documents", [])

    document = next((item for item in documents if item["id"] == doc_id), None)
    if not document:
        raise SystemExit("document not found in store")
    current_version_id = str(document.get("currentVersionId") or "").strip()

    reader = PdfReader(input_pdf)
    writer = PdfWriter()

    annotations_by_page = {}
    annotations = [
        annotation
        for annotation in document.get("annotations", [])
        if not current_version_id or str(annotation.get("versionId") or "").strip() == current_version_id
    ]
    for annotation in annotations:
        annotations_by_page.setdefault(int(annotation.get("page", 1)), []).append(annotation)

    for index, page in enumerate(reader.pages, start=1):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        page_annotations = annotations_by_page.get(index, [])
        overlay_buffer = build_page_overlay(page_annotations, width, height)
        if overlay_buffer is not None:
            overlay_page = PdfReader(overlay_buffer).pages[0]
            page.merge_page(overlay_page)
        writer.add_page(page)

    summary_pdf = build_summary_pdf(document, annotations)
    summary_reader = PdfReader(summary_pdf)
    for page in summary_reader.pages:
        writer.add_page(page)

    with open(output_pdf, "wb") as handle:
        writer.write(handle)


def register_font():
    return register_pdf_font(FONT_NAME)


def build_page_overlay(annotations, width, height):
    if not annotations:
        return None

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(width, height))
    pdf.setTitle("Review Overlay")
    pdf.setLineJoin(1)

    for number, annotation in enumerate(annotations, start=1):
        draw_annotation(pdf, annotation, number, width, height)

    pdf.save()
    buffer.seek(0)
    return buffer


def draw_annotation(pdf, annotation, number, page_width, page_height):
    kind = annotation.get("type", "mark")
    x = float(annotation.get("x", 0)) * page_width
    top = float(annotation.get("y", 0)) * page_height
    width = max(float(annotation.get("width", 0.12)) * page_width, 18)
    height = max(float(annotation.get("height", 0.08)) * page_height, 18)
    bottom = page_height - top - height
    note = str(annotation.get("note", ""))
    resolved = bool(annotation.get("resolved"))
    annotation_color = annotation.get("color", "red")
    stroke = status_color(annotation_color, resolved)
    fill = status_fill_color(annotation_color, resolved)
    points = annotation_points(annotation, page_width, page_height)

    if kind == "line":
        pdf.setStrokeColor(stroke)
        pdf.setLineWidth(2.6)
        path = pdf.beginPath()
        start_x, start_y = points[0]
        path.moveTo(start_x, start_y)
        for point_x, point_y in points[1:]:
            path.lineTo(point_x, point_y)
        pdf.drawPath(path, stroke=1, fill=0)
        arrow_start_x, arrow_start_y = points[-2] if len(points) >= 2 else points[0]
        end_x, end_y = points[-1]
        draw_arrow_head(pdf, arrow_start_x, arrow_start_y, end_x, end_y, stroke)
        draw_badge(pdf, x, bottom + height, number, stroke)
        default_label = "引线批注" if annotation.get("variant") == "leader" else "箭头批注"
        draw_label(pdf, x, bottom + height, note or default_label, stroke, fill)
        return

    if kind == "pen":
        pdf.setStrokeColor(stroke)
        pdf.setLineWidth(2.8)
        pdf.setLineCap(1)
        pdf.setLineJoin(1)
        path = pdf.beginPath()
        first_x, first_y = points[0]
        path.moveTo(first_x, first_y)
        for point_x, point_y in points[1:]:
            path.lineTo(point_x, point_y)
        pdf.drawPath(path, stroke=1, fill=0)
        draw_badge(pdf, x, bottom + height, number, stroke)
        draw_label(pdf, x, bottom + height, note or "手绘批注", stroke, fill)
        return

    if kind == "circle":
        pdf.setStrokeColor(stroke)
        pdf.setLineWidth(2.4)
        pdf.ellipse(x, bottom, x + width, bottom + height, stroke=1, fill=0)
    elif kind == "mark":
        pdf.setStrokeColor(colors.HexColor("#1788d8"))
        pdf.setFillColor(colors.HexColor("#dff1fb"))
        pdf.setLineWidth(2.4)
        pdf.rect(x, bottom, width, height, stroke=1, fill=1)
        pdf.setFillColor(colors.black)
    else:
        note_box_height = max(height, 52)
        pdf.setStrokeColor(colors.HexColor("#f0a12a"))
        pdf.setFillColor(colors.HexColor("#fff7df"))
        pdf.roundRect(x, bottom, max(width, 132), note_box_height, 8, stroke=1, fill=1)
        draw_badge(pdf, x + 14, bottom + note_box_height - 14, number, colors.HexColor("#f0a12a"))
        pdf.setFillColor(colors.black)
        draw_wrapped_text(
            pdf,
            note or "文字批注",
            x + 12,
            bottom + note_box_height - 30,
            max(width, 132) - 24,
            11,
            14,
        )
        return

    draw_badge(pdf, x, bottom + height, number, stroke)
    draw_label(pdf, x, bottom + height, note or f"{kind} 批注", stroke, fill)


def draw_label(pdf, x, anchor_y, note, stroke, fill):
    font_name = register_font()
    note = localize_text(note)
    label_y = min(pdf._pagesize[1] - 24, anchor_y + 18)
    label_width = min(max(pdfmetrics.stringWidth(note[:24], font_name, 10) + 18, 88), 210)
    pdf.setStrokeColor(stroke)
    pdf.setFillColor(fill)
    pdf.roundRect(x + 14, label_y - 12, label_width, 22, 6, stroke=1, fill=1)
    pdf.setFillColor(colors.HexColor("#17324d"))
    pdf.setFont(font_name, 10)
    pdf.drawString(x + 22, label_y - 4, truncate_text(note, 22))


def annotation_points(annotation, page_width, page_height):
    raw_points = annotation.get("points") or []
    points = []
    for point in raw_points:
        try:
            points.append((
                float(point.get("x", 0)) * page_width,
                page_height - (float(point.get("y", 0)) * page_height),
            ))
        except Exception:
            continue

    if len(points) >= 2:
        return points

    x = float(annotation.get("x", 0)) * page_width
    top = float(annotation.get("y", 0)) * page_height
    width = max(float(annotation.get("width", 0.12)) * page_width, 18)
    height = max(float(annotation.get("height", 0.08)) * page_height, 18)
    bottom = page_height - top - height
    return [
        (x, bottom + height),
        (x + width, bottom),
    ]


def draw_arrow_head(pdf, start_x, start_y, end_x, end_y, color):
    dx = end_x - start_x
    dy = end_y - start_y
    angle = math.atan2(dy, dx)
    head_length = 12
    spread = math.pi / 7
    left_x = end_x - head_length * math.cos(angle - spread)
    left_y = end_y - head_length * math.sin(angle - spread)
    right_x = end_x - head_length * math.cos(angle + spread)
    right_y = end_y - head_length * math.sin(angle + spread)
    pdf.setStrokeColor(color)
    pdf.line(end_x, end_y, left_x, left_y)
    pdf.line(end_x, end_y, right_x, right_y)


def status_color(annotation_color, resolved):
    if resolved:
        return colors.HexColor("#2f9961")
    mapping = {
        "red": "#d65454",
        "amber": "#f0a12a",
        "blue": "#1788d8",
    }
    return colors.HexColor(mapping.get(annotation_color, "#d65454"))


def status_fill_color(annotation_color, resolved):
    if resolved:
        return colors.HexColor("#ebf7f0")
    mapping = {
        "red": "#fff4f3",
        "amber": "#fff7df",
        "blue": "#dff1fb",
    }
    return colors.HexColor(mapping.get(annotation_color, "#fff4f3"))


def draw_badge(pdf, center_x, center_y, number, color):
    font_name = register_font()
    radius = 9
    pdf.setFillColor(color)
    pdf.setStrokeColor(color)
    pdf.circle(center_x, center_y, radius, stroke=1, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont(font_name, 10)
    text = str(number)
    pdf.drawCentredString(center_x, center_y - 3.5, text)


def build_summary_pdf(document, annotations):
    font_name = register_font()
    width, height = A4
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle("Review Summary")

    sections = [
        ("流程信息", [
            f"文件名称：{document.get('name', '')}",
            f"当前版本：{document.get('version', '')}",
            f"流程名称：{document.get('workflowName', '')}",
            f"当前状态：{status_label(document.get('status', 'uploaded'))}",
            f"发起者：{document.get('initiator', '')}",
            f"初审人：{document.get('reviewer', '')}",
            f"终审人：{document.get('approver', '')}",
            f"截止日期：{document.get('dueDate', '')}",
        ]),
        ("备注", split_block(document.get("remarks") or "无")),
        ("批注清单", annotation_lines(annotations)),
        ("活动记录", activity_lines(document.get("activity", []))),
    ]

    y = height - 46
    for title, lines in sections:
        if y < 90:
            pdf.showPage()
            y = height - 46

        pdf.setFillColor(colors.HexColor("#17324d"))
        pdf.setFont(font_name, 16)
        pdf.drawString(42, y, localize_text(title))
        y -= 20

        pdf.setFillColor(colors.HexColor("#6e8297"))
        pdf.setFont(font_name, 11)
        for line in lines:
            wrapped = wrap_text(line, width - 84, 11)
            for piece in wrapped:
                if y < 60:
                  pdf.showPage()
                  y = height - 46
                  pdf.setFillColor(colors.HexColor("#6e8297"))
                  pdf.setFont(font_name, 11)
                pdf.drawString(42, y, piece)
                y -= 16
        y -= 18

    pdf.save()
    buffer.seek(0)
    return buffer


def annotation_lines(annotations):
    if not annotations:
        return ["无批注。"]

    lines = []
    for index, annotation in enumerate(annotations, start=1):
        kind = {
            "circle": "画圈",
            "mark": "标记框",
            "note": "文字批注",
            "line": "箭头引线",
            "pen": "手绘标记",
        }.get(annotation.get("type"), annotation.get("type", "批注"))
        resolved = "已处理" if annotation.get("resolved") else "待处理"
        lines.append(
            f"#{index} · 第 {annotation.get('page', 1)} 页 · {kind} · {resolved} · {annotation.get('actor', '')}：{annotation.get('note', '')}"
        )
        attachments = annotation.get("attachments", [])
        if attachments:
            lines.append(
                "  附件：" + "；".join(
                    str(item.get("name") or item.get("url") or "未命名附件")
                    for item in attachments
                )
            )
        replies = annotation.get("replies", [])
        for reply_index, reply in enumerate(replies, start=1):
            content = str(reply.get("content") or "本条回复未填写文字说明，仅补充了附件。")
            lines.append(
                f"  回复 {reply_index} · {reply.get('actor', '')} · {reply.get('createdAt', '')}：{content}"
            )
            reply_attachments = reply.get("attachments", [])
            if reply_attachments:
                lines.append(
                    "    回复附件：" + "；".join(
                        str(item.get("name") or item.get("url") or "未命名附件")
                        for item in reply_attachments
                    )
                )
    return lines


def activity_lines(activity):
    if not activity:
        return ["无活动记录。"]

    lines = []
    for item in activity:
        lines.append(
            f"{item.get('timestamp', '')} · {item.get('actor', '')} · {item.get('label', '')}：{item.get('note', '')}"
        )
    return lines


def split_block(text):
    return text.splitlines() if text.strip() else ["无"]


def wrap_text(text, max_width, font_size):
    font_name = register_font()
    text = localize_text(text)
    lines = []
    current = ""
    for char in text:
        if char == "\n":
            lines.append(current)
            current = ""
            continue
        candidate = current + char
        if pdfmetrics.stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = char
    if current or not lines:
        lines.append(current)
    return lines


def draw_wrapped_text(pdf, text, x, y, width, font_size, leading):
    text = localize_text(text)
    pdf.setFont(register_font(), font_size)
    current_y = y
    for line in wrap_text(text, width, font_size):
        pdf.drawString(x, current_y, line)
        current_y -= leading


def truncate_text(text, max_chars):
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1] + "…"


def status_label(status):
    return {
        "uploaded": "待发起",
        "in_review": "初审中",
        "final_review": "终审中",
        "approved": "已归档",
        "rejected": "已退回",
    }.get(status, status)


if __name__ == "__main__":
    main()
