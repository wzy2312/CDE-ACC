#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path


def clamp(value, lower, upper):
    return max(lower, min(upper, value))


def load_manifest():
    try:
        return json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid OCR manifest: {exc}") from exc


def normalize_bbox(x0, y0, x1, y1, width, height):
    page_width = float(width or 1)
    page_height = float(height or 1)
    return {
        "x": clamp(float(x0) / page_width, 0, 1),
        "y": clamp(float(y0) / page_height, 0, 1),
        "width": clamp(float(x1 - x0) / page_width, 0.001, 1),
        "height": clamp(float(y1 - y0) / page_height, 0.001, 1),
    }


def zone_type_for_text(text, bbox, font_size=0):
    value = str(text or "").strip()
    upper = value.upper()
    if bbox.get("x", 0) > 0.58 and bbox.get("y", 0) > 0.68:
        return "title"
    if re.search(r"\b(P|E|T|V|FT|PT|LT|AT|TT)-\d{2,5}[A-Z]?\b", upper):
        return "tag"
    if re.search(r"\b(DN|NPS|PN|SCH)\s*[-.]?\s*\d+", upper) or re.search(r"\d+(\.\d+)?\s*(MM|M|BARG|BARA|MPA|KPA|KW|KVA|RPM|M3/H|GPM)\b", upper):
        return "dimension"
    if "LEGEND" in upper or "图例" in value:
        return "legend"
    if "\t" in value or re.search(r"\s{3,}", value):
        return "table"
    if font_size and font_size >= 14:
        return "title"
    return "note"


def native_words_for_page(page):
    rect = page.rect
    words = []
    for item in page.get_text("words"):
        x0, y0, x1, y1, text = item[:5]
        clean = str(text or "").strip()
        if not clean:
            continue
        font_size = max(6.0, float(y1 - y0))
        bbox = normalize_bbox(x0, y0, x1, y1, rect.width, rect.height)
        words.append({
            "text": clean,
            "bbox": bbox,
            "fontSize": round(font_size, 2),
            "confidence": 1.0,
            "zoneType": zone_type_for_text(clean, bbox, font_size),
            "source": "native_text",
        })
    return words


def try_ocr_page(page, dpi=220):
    try:
        import fitz  # type: ignore
        import pytesseract  # type: ignore
        from PIL import Image, ImageOps, ImageFilter  # type: ignore
    except Exception as exc:
        return [], f"OCR engine is not available: {exc}"

    matrix = fitz.Matrix(dpi / 72.0, dpi / 72.0)
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    image = ImageOps.grayscale(image)
    image = ImageOps.autocontrast(image)
    image = image.filter(ImageFilter.MedianFilter(size=3))
    lang = "chi_sim+eng"
    try:
        data = pytesseract.image_to_data(image, lang=lang, output_type=pytesseract.Output.DICT)
    except Exception:
        data = pytesseract.image_to_data(image, lang="eng", output_type=pytesseract.Output.DICT)

    words = []
    count = len(data.get("text", []))
    for index in range(count):
        text = str(data["text"][index] or "").strip()
        if not text:
            continue
        try:
            confidence = float(data.get("conf", [0])[index]) / 100.0
        except Exception:
            confidence = 0.0
        if confidence <= 0.05:
            continue
        x = float(data["left"][index])
        y = float(data["top"][index])
        width = float(data["width"][index])
        height = float(data["height"][index])
        bbox = normalize_bbox(x, y, x + width, y + height, pixmap.width, pixmap.height)
        words.append({
            "text": text,
            "bbox": bbox,
            "fontSize": round(max(6.0, height / (dpi / 72.0)), 2),
            "confidence": round(clamp(confidence, 0, 1), 3),
            "zoneType": zone_type_for_text(text, bbox, height / (dpi / 72.0)),
            "source": "ocr",
        })
    return words, ""


def page_quality(words, source, warning=""):
    if not words:
        return 35 if warning else 45
    avg_confidence = sum(float(item.get("confidence", 0)) for item in words) / max(1, len(words))
    base = 96 if source == "native_text" else 78
    if len(words) < 5:
        base -= 18
    if warning:
        base -= 20
    return int(clamp(round(base * avg_confidence + (100 - base)), 0, 100))


def merge_page_text(words):
    return " ".join(str(item.get("text", "")).strip() for item in words if str(item.get("text", "")).strip())


def extract(manifest):
    try:
        import fitz  # type: ignore
    except Exception as exc:
        raise RuntimeError(f"PyMuPDF is required for drawing OCR extraction: {exc}") from exc

    source_path = Path(str(manifest.get("sourcePath") or ""))
    if not source_path.is_file():
        raise RuntimeError("Source PDF file does not exist for OCR extraction.")
    options = manifest.get("options") if isinstance(manifest.get("options"), dict) else {}
    min_native_words = int(options.get("minNativeWords", 3) or 3)
    max_pages = int(options.get("maxPages", 120) or 120)
    dpi = int(options.get("ocrDpi", 220) or 220)

    pages = []
    blocks = []
    with fitz.open(str(source_path)) as doc:
        page_count = min(int(doc.page_count), max_pages)
        for page_index in range(page_count):
            page = doc.load_page(page_index)
            native_words = native_words_for_page(page)
            warning = ""
            source = "native_text"
            words = native_words
            if len(native_words) < min_native_words:
                source = "ocr"
                words, warning = try_ocr_page(page, dpi=dpi)
                if not words and native_words:
                    source = "native_text_partial"
                    words = native_words
                    warning = warning or "Native text layer is sparse and OCR produced no usable words."
                elif not words:
                    source = "image_pdf"
                    warning = warning or "No native text layer and OCR produced no usable words."

            quality = page_quality(words, source, warning)
            page_text = merge_page_text(words)
            page_record = {
                "page": page_index + 1,
                "sourceType": source,
                "qualityScore": quality,
                "text": page_text,
                "warning": warning,
                "wordCount": len(words),
            }
            pages.append(page_record)
            for word in words:
                blocks.append({
                    **word,
                    "page": page_index + 1,
                    "qualityScore": quality,
                })

    source_types = set(page.get("sourceType", "") for page in pages)
    if source_types == {"native_text"}:
        source_type = "native_text"
    elif "ocr" in source_types:
        source_type = "ocr"
    elif "native_text_partial" in source_types:
        source_type = "mixed"
    else:
        source_type = "image_pdf"
    quality_score = int(round(sum(page.get("qualityScore", 0) for page in pages) / max(1, len(pages))))
    return {
        "sourceType": source_type,
        "qualityScore": quality_score,
        "pageCount": len(pages),
        "blockCount": len(blocks),
        "pages": pages,
        "blocks": blocks,
    }


def main():
    try:
        print(json.dumps(extract(load_manifest()), ensure_ascii=False))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
