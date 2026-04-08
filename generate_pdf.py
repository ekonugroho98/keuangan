#!/usr/bin/env python3
"""Generate PDF Panduan Karaya Finance — compact layout."""

import re
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from PIL import Image as PILImage

BASE_DIR = Path(__file__).parent
SS_DIR   = BASE_DIR / "SS"
MD_FILE  = BASE_DIR / "PANDUAN.md"
OUT_PDF  = BASE_DIR / "Panduan_Karaya_Finance.pdf"

# ── Warna ─────────────────────────────────────────────────────────────────────
C_PRIMARY = HexColor("#19ce9b")
C_DARK    = HexColor("#0d0d1a")
C_HEAD    = HexColor("#111827")
C_SUB     = HexColor("#374151")
C_MUTED   = HexColor("#6b7280")
C_BORDER  = HexColor("#e5e7eb")
C_BG_H2   = HexColor("#f0fdf9")
C_BG_TIP  = HexColor("#eff6ff")
C_BG_WARN = HexColor("#fffbeb")
C_BG_OK   = HexColor("#f0fdf4")
C_BG_CODE = HexColor("#f1f5f9")
C_GREEN   = HexColor("#15803d")

PAGE_W, PAGE_H = A4
MARGIN    = 16 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

# ── Styles ────────────────────────────────────────────────────────────────────
def S(name, **kw):
    base = dict(fontName="Helvetica", fontSize=9.5, leading=13.5,
                textColor=C_HEAD, spaceBefore=0, spaceAfter=2)
    base.update(kw)
    return ParagraphStyle(name, **base)

ST = {
    "h1":    S("h1",  fontName="Helvetica-Bold", fontSize=20, leading=25,
                      textColor=C_DARK, spaceAfter=4),
    "h2":    S("h2",  fontName="Helvetica-Bold", fontSize=12.5, leading=17,
                      textColor=C_HEAD, spaceBefore=6, spaceAfter=3),
    "h3":    S("h3",  fontName="Helvetica-Bold", fontSize=10.5, leading=15,
                      textColor=C_SUB,  spaceBefore=5, spaceAfter=2),
    "body":  S("body"),
    "li":    S("li",  leftIndent=14, bulletIndent=2, spaceAfter=1),
    "li2":   S("li2", leftIndent=28, bulletIndent=2, spaceAfter=1, fontSize=9),
    "bq":    S("bq",  fontName="Helvetica-Oblique", fontSize=8.5, leading=12.5,
                      textColor=HexColor("#374151"), leftIndent=10, rightIndent=4),
    "code":  S("code", fontName="Courier", fontSize=8, leading=12,
                       textColor=HexColor("#0f172a"), leftIndent=8),
    "cap":   S("cap",  fontSize=7.5, leading=10, textColor=C_MUTED,
                       alignment=TA_CENTER, spaceBefore=1, spaceAfter=5),
    "ok":    S("ok",   fontName="Helvetica-Bold", textColor=C_GREEN, spaceAfter=3),
    "sig":   S("sig",  fontName="Helvetica-Oblique", fontSize=9,
                       textColor=C_MUTED, alignment=TA_CENTER, spaceBefore=6),
}

# ── BlockquoteBox ─────────────────────────────────────────────────────────────
class BQBox(Flowable):
    KIND = {
        "note":    (HexColor("#f8fafc"), HexColor("#94a3b8")),
        "tip":     (C_BG_TIP,           HexColor("#3b82f6")),
        "warn":    (C_BG_WARN,           HexColor("#f59e0b")),
        "ok":      (C_BG_OK,             C_PRIMARY),
    }
    def __init__(self, text, kind="note", w=CONTENT_W):
        super().__init__()
        self.kind = kind
        self.w    = w
        self.bg, self.bar = self.KIND.get(kind, self.KIND["note"])
        self._p   = Paragraph(text, ST["bq"])
        _, self._h = self._p.wrap(w - 20, 9999)
        self.height = self._h + 10

    def draw(self):
        c = self.canv
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self.w, self.height, 3, fill=1, stroke=0)
        c.setFillColor(self.bar)
        c.rect(0, 0, 3, self.height, fill=1, stroke=0)
        self._p.drawOn(c, 12, (self.height - self._h) / 2)

    def wrap(self, *_):
        return (self.w, self.height)


# ── Load screenshot ───────────────────────────────────────────────────────────
def load_img(num):
    p = SS_DIR / f"SS-{num}.png"
    if not p.exists():
        return None
    pil = PILImage.open(p)
    pw, ph = pil.size
    # Fill full content width
    scale = CONTENT_W / pw
    # Cap height at ~180mm so it doesn't span a full page alone
    max_h = 180 * mm
    if ph * scale > max_h:
        scale = max_h / ph
    return Image(str(p), width=pw * scale, height=ph * scale)


# ── XML escape + inline markup ────────────────────────────────────────────────
def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def fmt(text):
    t = esc(text)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    # Lindungi code span dulu — ganti sementara agar underscore di dalamnya
    # tidak ikut diproses sebagai italic (contoh: VITE_APP_NAME)
    placeholders = {}
    def protect_code(m):
        key = f"\x00CODE{len(placeholders)}\x00"
        placeholders[key] = f'<font face="Courier" size="8">{m.group(1)}</font>'
        return key
    t = re.sub(r'`([^`]+)`', protect_code, t)
    # Italic hanya jika underscore di word boundary (bukan di dalam nama variabel)
    t = re.sub(r'(?<!\w)_([^_\n]+)_(?!\w)', r'<i>\1</i>', t)
    # Kembalikan code spans
    for key, val in placeholders.items():
        t = t.replace(key, val)
    t = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', t)
    return t


# ── Markdown → flowables ──────────────────────────────────────────────────────
def parse(md):
    out = []
    lines = md.split("\n")
    i = 0
    trows = []

    def flush_table():
        if not trows:
            return
        nc = max(len(r) for r in trows)
        rows = [r + [""] * (nc - len(r)) for r in trows]
        cw = CONTENT_W / nc
        data = []
        for ri, row in enumerate(rows):
            if ri == 1:   # separator row
                continue
            style = ST["body"] if ri > 1 else S("th", fontName="Helvetica-Bold",
                                                  fontSize=8.5, textColor=white)
            data.append([Paragraph(fmt(c.strip()), style) for c in row])
        t = Table(data, colWidths=[cw] * nc, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),   C_DARK),
            ("ROWBACKGROUNDS",(0,1), (-1,-1),   [white, HexColor("#f8fafc")]),
            ("GRID",          (0,0), (-1,-1),  0.4, C_BORDER),
            ("TOPPADDING",    (0,0), (-1,-1),  3),
            ("BOTTOMPADDING", (0,0), (-1,-1),  3),
            ("LEFTPADDING",   (0,0), (-1,-1),  5),
            ("FONTSIZE",      (0,0), (-1,-1),  8.5),
            ("VALIGN",        (0,0), (-1,-1),  "MIDDLE"),
        ]))
        out.append(t)
        out.append(Spacer(1, 3))
        trows.clear()

    while i < len(lines):
        raw = lines[i]

        # ── Screenshot placeholder ──────────────────────────────────────────
        m = re.match(r'^>\s*📸\s*_\[SS-(\d+):\s*([^\]]+)\]_', raw)
        if m:
            flush_table()
            num, desc = m.group(1), m.group(2).strip()
            img = load_img(num)
            block = []
            if img:
                img.hAlign = "CENTER"
                block.append(img)
            else:
                ph = Table([[Paragraph(
                    f'📸 SS-{num} — <i>{esc(desc)}</i><br/>'
                    f'<font size="7.5" color="#94a3b8">Screenshot belum tersedia</font>',
                    ST["bq"])]],
                    colWidths=[CONTENT_W])
                ph.setStyle(TableStyle([
                    ("BACKGROUND",(0,0),(-1,-1), HexColor("#f8fafc")),
                    ("BOX",(0,0),(-1,-1), 1, C_BORDER),
                    ("TOPPADDING",(0,0),(-1,-1),8),
                    ("BOTTOMPADDING",(0,0),(-1,-1),8),
                    ("LEFTPADDING",(0,0),(-1,-1),8),
                ]))
                block.append(ph)
            block.append(Paragraph(f"📸 SS-{num}: {esc(desc)}", ST["cap"]))
            out.append(KeepTogether(block))
            i += 1
            continue

        # ── Table ──────────────────────────────────────────────────────────
        if raw.startswith("|"):
            trows.append([c.strip() for c in raw.strip().strip("|").split("|")])
            i += 1
            continue
        else:
            flush_table()

        # ── H1 ─────────────────────────────────────────────────────────────
        if raw.startswith("# ") and not raw.startswith("## "):
            out.append(Paragraph(fmt(raw[2:].strip()), ST["h1"]))
            out.append(HRFlowable(width=CONTENT_W, thickness=2.5,
                                   color=C_PRIMARY, spaceBefore=2, spaceAfter=8))
            i += 1; continue

        # ── H2 ─────────────────────────────────────────────────────────────
        if raw.startswith("## "):
            out.append(Spacer(1, 5))
            label = fmt(raw[3:].strip())
            cell = Table([[Paragraph(label, ST["h2"])]], colWidths=[CONTENT_W])
            cell.setStyle(TableStyle([
                ("BACKGROUND",    (0,0),(-1,-1), C_BG_H2),
                ("LINEBEFORE",    (0,0),(0,-1),  4, C_PRIMARY),
                ("TOPPADDING",    (0,0),(-1,-1), 6),
                ("BOTTOMPADDING", (0,0),(-1,-1), 6),
                ("LEFTPADDING",   (0,0),(-1,-1), 10),
            ]))
            out.append(KeepTogether([cell, Spacer(1, 3)]))
            i += 1; continue

        # ── H3 ─────────────────────────────────────────────────────────────
        if raw.startswith("### "):
            out.append(Paragraph(fmt(raw[4:].strip()), ST["h3"]))
            i += 1; continue

        # ── HR ─────────────────────────────────────────────────────────────
        if raw.strip() in ("---", "***", "___"):
            out.append(HRFlowable(width=CONTENT_W, thickness=0.8,
                                   color=C_BORDER, spaceBefore=4, spaceAfter=4))
            i += 1; continue

        # ── Blockquote ─────────────────────────────────────────────────────
        if raw.startswith("> "):
            blines = []
            while i < len(lines) and lines[i].startswith("> "):
                blines.append(lines[i][2:])
                i += 1
            btext = fmt(" ".join(blines).strip())
            kind = ("warn" if "⚠️" in btext
                    else "tip" if "💡" in btext
                    else "ok"  if "✅" in btext
                    else "note")
            out.append(BQBox(btext, kind=kind))
            continue

        # ── Ordered list ───────────────────────────────────────────────────
        m = re.match(r'^(\d+)\.\s+(.*)', raw)
        if m:
            out.append(Paragraph(f"<b>{m.group(1)}.</b> {fmt(m.group(2))}", ST["li"]))
            i += 1; continue

        # ── Indented sub-item ──────────────────────────────────────────────
        if re.match(r'^\s{3,}[\-\*]\s+', raw):
            text = re.sub(r'^\s+[\-\*]\s+', '', raw)
            out.append(Paragraph(f"◦ {fmt(text)}", ST["li2"]))
            i += 1; continue

        # ── Unordered list ─────────────────────────────────────────────────
        if re.match(r'^[\-\*]\s+', raw):
            text = re.sub(r'^[\-\*]\s+', '', raw)
            out.append(Paragraph(f"• {fmt(text)}", ST["li"]))
            i += 1; continue

        # ── Code block ─────────────────────────────────────────────────────
        if raw.startswith("```"):
            clines = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                clines.append(lines[i])
                i += 1
            i += 1
            ctxt = esc("\n".join(clines)).replace("\n", "<br/>")
            cb = Table(
                [[Paragraph(ctxt, ParagraphStyle("cb", parent=ST["code"],
                             textColor=HexColor("#e2e8f0"), backColor=HexColor("#0f172a")))]],
                colWidths=[CONTENT_W]
            )
            cb.setStyle(TableStyle([
                ("BACKGROUND",    (0,0),(-1,-1), HexColor("#0f172a")),
                ("TOPPADDING",    (0,0),(-1,-1), 7),
                ("BOTTOMPADDING", (0,0),(-1,-1), 7),
                ("LEFTPADDING",   (0,0),(-1,-1), 9),
            ]))
            out.append(Spacer(1,2)); out.append(cb); out.append(Spacer(1,2))
            continue

        # ── Backtick-only line ─────────────────────────────────────────────
        if raw.strip().startswith("`") and raw.strip().endswith("`"):
            t = raw.strip()[1:-1]
            out.append(Paragraph(
                f'<font face="Courier" size="8">{esc(t)}</font>', ST["body"]))
            i += 1; continue

        # ── Italic-only line (signature) ───────────────────────────────────
        s = raw.strip()
        if s.startswith("*") and s.endswith("*") and not s.startswith("**"):
            out.append(Paragraph(fmt(s), ST["sig"]))
            i += 1; continue

        # ── Empty line ─────────────────────────────────────────────────────
        if raw.strip() == "":
            out.append(Spacer(1, 3))
            i += 1; continue

        # ── Normal paragraph ───────────────────────────────────────────────
        t = fmt(raw.strip())
        if t:
            style = ST["ok"] if "✅" in raw else ST["body"]
            out.append(Paragraph(t, style))
        i += 1

    flush_table()
    return out


# ── Header / Footer ───────────────────────────────────────────────────────────
def draw_hf(canvas, doc):
    canvas.saveState()
    W = PAGE_W
    # Header
    canvas.setFillColor(C_DARK)
    canvas.rect(0, PAGE_H - 10*mm, W, 10*mm, fill=1, stroke=0)
    canvas.setFillColor(C_PRIMARY)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(MARGIN, PAGE_H - 6.5*mm, "Karaya Finance")
    canvas.setFillColor(white)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(W - MARGIN, PAGE_H - 6.5*mm, "Panduan Setup Lengkap")
    # Footer
    canvas.setFillColor(HexColor("#f1f5f9"))
    canvas.rect(0, 0, W, 8*mm, fill=1, stroke=0)
    canvas.setFillColor(C_MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawRightString(W - MARGIN, 2.8*mm, f"Halaman {doc.page}")
    canvas.restoreState()


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Membaca PANDUAN.md...")
    md = MD_FILE.read_text(encoding="utf-8")
    print("Parsing...")
    els = parse(md)
    print(f"  {len(els)} elemen")
    print("Generating PDF...")
    doc = SimpleDocTemplate(
        str(OUT_PDF), pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=13*mm, bottomMargin=12*mm,
        title="Panduan Karaya Finance",
        author="Karaya Finance",
    )
    doc.build(els, onFirstPage=draw_hf, onLaterPages=draw_hf)
    kb = OUT_PDF.stat().st_size / 1024
    print(f"\n✅  {OUT_PDF.name}  —  {kb:.0f} KB  ({kb/1024:.1f} MB)")

if __name__ == "__main__":
    main()
