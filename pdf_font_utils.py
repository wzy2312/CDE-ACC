import os

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont


DEFAULT_FONT_FAMILIES = [
    "STSong-Light",
    "HeiseiKakuGo-W5",
    "HYSMyeongJo-Medium",
]

DEFAULT_FONT_PATH_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/arphic/ukai.ttc",
]


def register_pdf_font(font_name, env_var="CDE_PDF_FONT_PATH", preferred_paths=None):
    if font_name in pdfmetrics.getRegisteredFontNames():
        return font_name

    candidate_paths = []
    configured_path = str(os.environ.get(env_var, "")).strip()
    if configured_path:
        candidate_paths.append(configured_path)
    if preferred_paths:
        candidate_paths.extend([path for path in preferred_paths if path])
    candidate_paths.extend(DEFAULT_FONT_PATH_CANDIDATES)

    seen = set()
    for candidate in candidate_paths:
        normalized = str(candidate or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        if not os.path.exists(normalized):
            continue
        try:
            pdfmetrics.registerFont(TTFont(font_name, normalized))
            return font_name
        except Exception:
            continue

    for fallback_name in DEFAULT_FONT_FAMILIES:
        try:
            if fallback_name not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(UnicodeCIDFont(fallback_name))
            return fallback_name
        except Exception:
            continue

    return "Helvetica"
