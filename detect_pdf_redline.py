#!/usr/bin/env python3
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter


def load_json_stdin():
    try:
        return json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid detector manifest: {exc}") from exc


def clamp(value, lower, upper):
    return max(lower, min(upper, value))


def option_number(options, key, fallback, lower=None, upper=None):
    try:
        value = float(options.get(key, fallback))
    except (TypeError, ValueError):
        value = fallback
    if lower is not None:
        value = max(lower, value)
    if upper is not None:
        value = min(upper, value)
    return value


class PdfRenderer:
    def __init__(self):
        self.backend = ""
        self.fitz = None
        try:
            import fitz  # type: ignore
            self.fitz = fitz
            self.backend = "pymupdf"
            return
        except Exception:
            pass

        try:
            from pdf2image import convert_from_path, pdfinfo_from_path  # type: ignore
            self.convert_from_path = convert_from_path
            self.pdfinfo_from_path = pdfinfo_from_path
            self.backend = "pdf2image"
            return
        except Exception:
            pass

        raise RuntimeError(
            "PDF redline renderer unavailable. Install PyMuPDF (`python3 -m pip install PyMuPDF`) "
            "or Poppler + pdf2image (`brew install poppler`)."
        )

    def page_count(self, pdf_path):
        if self.backend == "pymupdf":
            with self.fitz.open(pdf_path) as doc:
                return int(doc.page_count)
        info = self.pdfinfo_from_path(pdf_path)
        return int(info.get("Pages", 0))

    def render_page(self, pdf_path, page_index, dpi):
        if self.backend == "pymupdf":
            with self.fitz.open(pdf_path) as doc:
                page = doc.load_page(page_index)
                matrix = self.fitz.Matrix(dpi / 72.0, dpi / 72.0)
                pixmap = page.get_pixmap(matrix=matrix, alpha=False)
                mode = "RGB" if pixmap.n < 4 else "RGBA"
                image = Image.frombytes(mode, (pixmap.width, pixmap.height), pixmap.samples)
                return image.convert("RGB")

        images = self.convert_from_path(pdf_path, dpi=dpi, first_page=page_index + 1, last_page=page_index + 1)
        if not images:
            raise RuntimeError(f"Failed to render page {page_index + 1} for {pdf_path}")
        return images[0].convert("RGB")

    def extract_words(self, pdf_path, page_index):
        if self.backend != "pymupdf":
            return []
        with self.fitz.open(pdf_path) as doc:
            if page_index >= doc.page_count:
                return []
            page = doc.load_page(page_index)
            rect = page.rect
            words = []
            for item in page.get_text("words"):
                x0, y0, x1, y1, text = item[:5]
                clean = str(text or "").strip()
                if not clean:
                    continue
                words.append({
                    "text": clean,
                    "bbox": {
                        "x": clamp(float(x0) / float(rect.width or 1), 0, 1),
                        "y": clamp(float(y0) / float(rect.height or 1), 0, 1),
                        "width": clamp(float(x1 - x0) / float(rect.width or 1), 0.001, 1),
                        "height": clamp(float(y1 - y0) / float(rect.height or 1), 0.001, 1),
                    },
                })
            return words


def resize_for_detection(image, max_dimension):
    width, height = image.size
    longest = max(width, height)
    if longest <= max_dimension:
        return image
    scale = max_dimension / float(longest)
    return image.resize((max(1, int(width * scale)), max(1, int(height * scale))), Image.Resampling.BICUBIC)


def align_pair(image_a, image_b):
    if image_a.size == image_b.size:
        return image_a, image_b
    width_a, height_a = image_a.size
    width_b, height_b = image_b.size
    aspect_a = width_a / float(height_a or 1)
    aspect_b = width_b / float(height_b or 1)
    if abs(aspect_a - aspect_b) < 0.03:
        return image_a, image_b.resize(image_a.size, Image.Resampling.BICUBIC)

    width = max(width_a, width_b)
    height = max(height_a, height_b)
    canvas_a = Image.new("RGB", (width, height), "white")
    canvas_b = Image.new("RGB", (width, height), "white")
    canvas_a.paste(image_a, (0, 0))
    canvas_b.paste(image_b, (0, 0))
    return canvas_a, canvas_b


def component_boxes(mask):
    height, width = mask.shape
    visited = np.zeros(mask.shape, dtype=np.bool_)
    ys, xs = np.nonzero(mask)
    boxes = []
    for seed_x, seed_y in zip(xs, ys):
        if visited[seed_y, seed_x]:
            continue
        stack = [(int(seed_x), int(seed_y))]
        visited[seed_y, seed_x] = True
        min_x = max_x = int(seed_x)
        min_y = max_y = int(seed_y)
        area = 0
        while stack:
            x, y = stack.pop()
            area += 1
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if nx < 0 or ny < 0 or nx >= width or ny >= height:
                    continue
                if visited[ny, nx] or not mask[ny, nx]:
                    continue
                visited[ny, nx] = True
                stack.append((nx, ny))
        boxes.append({"x0": min_x, "y0": min_y, "x1": max_x, "y1": max_y, "area": area})
    return boxes


def overlaps(left, right, padding=0):
    return not (
        left["x1"] + padding < right["x0"] or
        right["x1"] + padding < left["x0"] or
        left["y1"] + padding < right["y0"] or
        right["y1"] + padding < left["y0"]
    )


def merge_boxes(boxes, padding):
    merged = []
    for box in sorted(boxes, key=lambda item: (item["y0"], item["x0"])):
        target = None
        for existing in merged:
            if overlaps(existing, box, padding):
                target = existing
                break
        if target is None:
            merged.append(dict(box))
            continue
        target["x0"] = min(target["x0"], box["x0"])
        target["y0"] = min(target["y0"], box["y0"])
        target["x1"] = max(target["x1"], box["x1"])
        target["y1"] = max(target["y1"], box["y1"])
        target["area"] += box.get("area", 0)
    return merged


def classify_region(gray_a, gray_b, box, ink_threshold):
    region_a = gray_a[box["y0"]:box["y1"] + 1, box["x0"]:box["x1"] + 1]
    region_b = gray_b[box["y0"]:box["y1"] + 1, box["x0"]:box["x1"] + 1]
    dark_a = int(np.count_nonzero(region_a < ink_threshold))
    dark_b = int(np.count_nonzero(region_b < ink_threshold))
    if dark_b > dark_a * 1.28 + 12:
        return "added"
    if dark_a > dark_b * 1.28 + 12:
        return "deleted"
    return "modified"


def record_from_box(page, box, width, height, diff_type, source, text_a="", text_b=""):
    area = int(box.get("area", max(1, (box["x1"] - box["x0"] + 1) * (box["y1"] - box["y0"] + 1))))
    bbox = {
        "x": clamp(box["x0"] / float(width or 1), 0, 1),
        "y": clamp(box["y0"] / float(height or 1), 0, 1),
        "width": clamp((box["x1"] - box["x0"] + 1) / float(width or 1), 0.001, 1),
        "height": clamp((box["y1"] - box["y0"] + 1) / float(height or 1), 0.001, 1),
    }
    heat = clamp(math.sqrt(area) / math.sqrt(max(1, width * height) * 0.04), 0.12, 1)
    summary = ""
    if diff_type == "added":
        summary = f"新增：{text_b or '图形内容'}"
    elif diff_type == "deleted":
        summary = f"删除：{text_a or '图形内容'}"
    elif diff_type == "moved":
        summary = f"{text_a or text_b or '内容'} 位置移动"
    else:
        summary = f"{text_a or '图形内容'} → {text_b or '图形内容'}"
    return {
        "page": page,
        "diffType": diff_type,
        "bbox": bbox,
        "textA": text_a,
        "textB": text_b,
        "contentSummary": summary,
        "area": area,
        "heat": heat,
        "aiConfidence": "medium" if source == "pdf-text-layer" else "low",
        "aiInterpretation": (
            "该差异由 PDF 文本层定位，可结合图面确认是否为实质性修订。"
            if source == "pdf-text-layer"
            else "该差异由 PDF 页面渲染后的像素差异检测定位，建议结合原图确认变更含义。"
        ),
        "source": source,
    }


def detect_pixel_records(image_a, image_b, page, options):
    threshold = int(option_number(options, "pixelThreshold", 34, 1, 255))
    min_area = int(option_number(options, "minPixelArea", 50, 1, None))
    padding = int(option_number(options, "componentMergePadding", 8, 0, 80))
    ink_threshold = int(option_number(options, "inkThreshold", 238, 1, 255))
    gray_a = np.asarray(image_a.convert("L"), dtype=np.int16)
    gray_b = np.asarray(image_b.convert("L"), dtype=np.int16)
    diff = np.abs(gray_a - gray_b)
    mask_image = Image.fromarray((diff >= threshold).astype(np.uint8) * 255, "L")
    mask_image = mask_image.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    mask = np.asarray(mask_image) > 0
    boxes = [box for box in component_boxes(mask) if int(box.get("area", 0)) >= min_area]
    boxes = [box for box in merge_boxes(boxes, padding) if int(box.get("area", 0)) >= min_area]
    width, height = image_a.size
    records = []
    for box in boxes:
        diff_type = classify_region(gray_a, gray_b, box, ink_threshold)
        records.append(record_from_box(page, box, width, height, diff_type, "pdf-pixel-render"))
    return records


def center(bbox):
    return (bbox["x"] + bbox["width"] / 2.0, bbox["y"] + bbox["height"] / 2.0)


def distance(left, right):
    lx, ly = center(left)
    rx, ry = center(right)
    return math.hypot(lx - rx, ly - ry)


def bbox_to_box(bbox, width=10000, height=10000):
    return {
        "x0": int(bbox["x"] * width),
        "y0": int(bbox["y"] * height),
        "x1": int((bbox["x"] + bbox["width"]) * width),
        "y1": int((bbox["y"] + bbox["height"]) * height),
        "area": max(1, int(bbox["width"] * width * bbox["height"] * height)),
    }


def detect_text_records(words_a, words_b, page, options):
    move_threshold = option_number(options, "textMoveThreshold", 0.035, 0.001, 0.5)
    location_threshold = option_number(options, "textLocationThreshold", 0.018, 0.001, 0.5)
    used_a = set()
    used_b = set()
    records = []

    for b_index, word_b in enumerate(words_b):
        candidates = [
            (a_index, distance(word_a["bbox"], word_b["bbox"]))
            for a_index, word_a in enumerate(words_a)
            if a_index not in used_a and word_a["text"] == word_b["text"]
        ]
        if not candidates:
            continue
        a_index, dist = min(candidates, key=lambda item: item[1])
        if dist <= location_threshold:
            used_a.add(a_index)
            used_b.add(b_index)
            continue
        if dist >= move_threshold:
            used_a.add(a_index)
            used_b.add(b_index)
            box = bbox_to_box(word_b["bbox"])
            records.append(record_from_box(page, box, 10000, 10000, "moved", "pdf-text-layer", words_a[a_index]["text"], word_b["text"]))

    for b_index, word_b in enumerate(words_b):
        if b_index in used_b:
            continue
        candidates = [
            (a_index, distance(word_a["bbox"], word_b["bbox"]))
            for a_index, word_a in enumerate(words_a)
            if a_index not in used_a and word_a["text"] != word_b["text"]
        ]
        if candidates:
            a_index, dist = min(candidates, key=lambda item: item[1])
            if dist <= move_threshold:
                used_a.add(a_index)
                used_b.add(b_index)
                box = bbox_to_box(word_b["bbox"])
                records.append(record_from_box(page, box, 10000, 10000, "modified", "pdf-text-layer", words_a[a_index]["text"], word_b["text"]))

    for b_index, word_b in enumerate(words_b):
        if b_index not in used_b:
            records.append(record_from_box(page, bbox_to_box(word_b["bbox"]), 10000, 10000, "added", "pdf-text-layer", "", word_b["text"]))

    for a_index, word_a in enumerate(words_a):
        if a_index not in used_a:
            records.append(record_from_box(page, bbox_to_box(word_a["bbox"]), 10000, 10000, "deleted", "pdf-text-layer", word_a["text"], ""))

    return records


def filter_and_limit(records, options):
    include = set(options.get("includeTypes") or ["added", "deleted", "modified", "moved"])
    max_records = int(option_number(options, "maxRecords", 240, 1, 2000))
    filtered = [record for record in records if record["diffType"] in include]
    filtered.sort(key=lambda item: (item["page"], -float(item.get("heat", 0)), item["bbox"]["y"], item["bbox"]["x"]))
    return filtered[:max_records]


def detect(manifest):
    source_a = Path(str(manifest.get("sourceAPath") or ""))
    source_b = Path(str(manifest.get("sourceBPath") or ""))
    options = manifest.get("options") if isinstance(manifest.get("options"), dict) else {}
    if not source_a.is_file() or not source_b.is_file():
        raise RuntimeError("Both PDF version files must exist before redline detection.")

    dpi = int(option_number(options, "renderDpi", 110, 48, 220))
    max_dimension = int(option_number(options, "maxRenderDimension", 1800, 600, 4200))
    max_pages = int(option_number(options, "maxPages", 80, 1, 500))
    renderer = PdfRenderer()
    pages_a = renderer.page_count(str(source_a))
    pages_b = renderer.page_count(str(source_b))
    page_count = min(max(pages_a, pages_b), max_pages)
    records = []

    for page_index in range(page_count):
        page_number = page_index + 1
        if page_index >= pages_a:
            records.append(record_from_box(page_number, {"x0": 0, "y0": 0, "x1": 9999, "y1": 9999, "area": 100000000}, 10000, 10000, "added", "pdf-page-count"))
            continue
        if page_index >= pages_b:
            records.append(record_from_box(page_number, {"x0": 0, "y0": 0, "x1": 9999, "y1": 9999, "area": 100000000}, 10000, 10000, "deleted", "pdf-page-count"))
            continue

        image_a = resize_for_detection(renderer.render_page(str(source_a), page_index, dpi), max_dimension)
        image_b = resize_for_detection(renderer.render_page(str(source_b), page_index, dpi), max_dimension)
        image_a, image_b = align_pair(image_a, image_b)
        records.extend(detect_pixel_records(image_a, image_b, page_number, options))

        words_a = renderer.extract_words(str(source_a), page_index)
        words_b = renderer.extract_words(str(source_b), page_index)
        if words_a or words_b:
            records.extend(detect_text_records(words_a, words_b, page_number, options))

    return {
        "records": filter_and_limit(records, options),
        "diagnostics": {
            "backend": renderer.backend,
            "pagesA": pages_a,
            "pagesB": pages_b,
            "dpi": dpi,
            "maxRenderDimension": max_dimension,
        },
    }


def main():
    try:
        payload = detect(load_json_stdin())
        print(json.dumps(payload, ensure_ascii=False))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
