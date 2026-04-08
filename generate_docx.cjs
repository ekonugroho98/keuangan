"use strict";
const fs   = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  ExternalHyperlink, LevelFormat, HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom, TextWrappingType,
} = require("docx");

const BASE   = __dirname;
const SS_DIR = path.join(BASE, "SS");
const MD     = fs.readFileSync(path.join(BASE, "PANDUAN.md"), "utf8");
const OUT    = path.join(BASE, "Panduan_Karaya_Finance.docx");

// ── Ukuran halaman A4 ────────────────────────────────────────────────────────
const PAGE_W      = 11906;
const MARGIN      = 1080;   // ~19mm
const CONTENT_W   = PAGE_W - MARGIN * 2;  // ≈9746 DXA

// ── Warna ────────────────────────────────────────────────────────────────────
const C_PRIMARY   = "19CE9B";
const C_DARK      = "0D0D1A";
const C_HEAD      = "111827";
const C_MUTED     = "6B7280";
const C_BG_H2     = "F0FDF9";
const C_BG_TIP    = "EFF6FF";
const C_BG_WARN   = "FFFBEB";
const C_BG_OK     = "F0FDF4";
const C_BG_NOTE   = "F8FAFC";
const C_BORDER    = "E5E7EB";
const C_GREEN     = "15803D";
const C_CODE_BG   = "F1F5F9";

// ── Helpers ──────────────────────────────────────────────────────────────────
const sp = (before = 0, after = 0) => ({ before, after });
const cellBorder = (color = C_BORDER) => {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
};
const noBorder = () => {
  const b = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: b, bottom: b, left: b, right: b };
};

// ── Inline markup parser ─────────────────────────────────────────────────────
function parseInline(text) {
  const runs = [];
  // Pisahkan code spans (backtick) terlebih dahulu agar underscore di dalam
  // nama variabel (VITE_APP_NAME) tidak ikut diproses sebagai italic
  const parts = text.split(/(`[^`]+`)/);
  for (const part of parts) {
    if (/^`[^`]+`$/.test(part)) {
      // Code span — ambil isi tanpa backtick, tampilkan as-is
      runs.push(new TextRun({
        text: part.slice(1, -1),
        font: "Courier New", size: 19, color: C_HEAD,
        shading: { fill: C_CODE_BG, type: ShadingType.CLEAR },
      }));
    } else {
      // Non-code — proses bold / italic / link
      const regex = /\*\*(.+?)\*\*|(?<!\w)_([^_\n]+)_(?!\w)|\[([^\]]+)\]\(([^\)]+)\)/g;
      let last = 0, m;
      while ((m = regex.exec(part)) !== null) {
        if (m.index > last)
          runs.push(new TextRun({ text: part.slice(last, m.index), font: "Calibri", size: 21 }));
        if (m[1])      runs.push(new TextRun({ text: m[1], bold: true, font: "Calibri", size: 21 }));
        else if (m[2]) runs.push(new TextRun({ text: m[2], italics: true, font: "Calibri", size: 21 }));
        else if (m[3]) runs.push(new ExternalHyperlink({
          link: m[4],
          children: [new TextRun({ text: m[3], style: "Hyperlink", font: "Calibri", size: 21 })],
        }));
        last = m.index + m[0].length;
      }
      if (last < part.length)
        runs.push(new TextRun({ text: part.slice(last), font: "Calibri", size: 21 }));
    }
  }
  return runs;
}

// ── Screenshot loader ─────────────────────────────────────────────────────────
function loadImg(num) {
  const p = path.join(SS_DIR, `SS-${num}.png`);
  if (!fs.existsSync(p)) return null;
  const data = fs.readFileSync(p);
  // Baca dimensi asli untuk hitung aspect ratio
  // PNG header: width @ byte 16, height @ byte 20
  const w = data.readUInt32BE(16);
  const h = data.readUInt32BE(20);
  const maxW = CONTENT_W;
  const scale = maxW / w;
  const imgW = Math.round(maxW);
  const imgH = Math.round(h * scale);
  // Cap tinggi max 180mm = 10206 DXA
  const maxH = 10206;
  const finalH = imgH > maxH ? maxH : imgH;
  const finalW = imgH > maxH ? Math.round(w * (maxH / h)) : imgW;
  return new ImageRun({
    type: "png",
    data,
    transformation: { width: Math.round(finalW * 0.0694), height: Math.round(finalH * 0.0694) },
    altText: { title: `SS-${num}`, description: `Screenshot ${num}`, name: `SS-${num}` },
  });
}

// ── Blockquote box ────────────────────────────────────────────────────────────
function bqBox(text, kind = "note") {
  const colors = { note: [C_BG_NOTE, "94A3B8"], tip: [C_BG_TIP, "3B82F6"], warn: [C_BG_WARN, "F59E0B"], ok: [C_BG_OK, C_PRIMARY] };
  const [bg, bar] = colors[kind] || colors.note;
  const runs = parseInline(text.replace(/^[⚠️💡✅📌]\s*/, ""));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [60, CONTENT_W - 60],
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: [
      new TableCell({
        width: { size: 60, type: WidthType.DXA },
        borders: noBorder(),
        shading: { fill: bar, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [] })],
      }),
      new TableCell({
        width: { size: CONTENT_W - 60, type: WidthType.DXA },
        borders: noBorder(),
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 160, right: 120 },
        children: [new Paragraph({ children: runs, spacing: sp(0, 0) })],
      }),
    ]})]
  });
}

// ── H2 styled box ─────────────────────────────────────────────────────────────
function h2Box(text) {
  const runs = parseInline(text);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [120, CONTENT_W - 120],
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: [
      new TableCell({
        width: { size: 120, type: WidthType.DXA },
        borders: noBorder(),
        shading: { fill: C_PRIMARY, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [] })],
      }),
      new TableCell({
        width: { size: CONTENT_W - 120, type: WidthType.DXA },
        borders: noBorder(),
        shading: { fill: C_BG_H2, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 200, right: 120 },
        children: [new Paragraph({
          children: runs.map(r => r instanceof TextRun ? new TextRun({ ...r, bold: true, size: 26, color: C_HEAD, font: "Calibri" }) : r),
          spacing: sp(0, 0),
        })],
      }),
    ]})]
  });
}

// ── Fitur tabel ───────────────────────────────────────────────────────────────
function featureTable(rows) {
  const colW = [Math.round(CONTENT_W * 0.28), Math.round(CONTENT_W * 0.72)];
  const borderStyle = cellBorder(C_BORDER);
  const makeCell = (text, isHeader, w) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: borderStyle,
    shading: { fill: isHeader ? C_DARK : "FFFFFF", type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 80 },
    children: [new Paragraph({
      children: parseInline(text).map(r => r instanceof TextRun
        ? new TextRun({ ...r, bold: isHeader, color: isHeader ? "FFFFFF" : C_HEAD, font: "Calibri", size: 19 })
        : r),
      spacing: sp(0, 0),
    })],
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: rows.map((row, ri) => new TableRow({
      tableHeader: ri === 0,
      children: row.map((cell, ci) => makeCell(cell, ri === 0, colW[ci])),
    })),
  });
}

// ── PARSER utama ──────────────────────────────────────────────────────────────
function parse(md) {
  const els  = [];
  const lines = md.split("\n");
  let i = 0;
  let tableRows = [];

  function flushTable() {
    if (!tableRows.length) return;
    const parsed = tableRows
      .filter((_, ri) => ri !== 1) // skip separator
      .map(r => r.map(c => c.trim()));
    els.push(featureTable(parsed));
    els.push(new Paragraph({ children: [], spacing: sp(60, 0) }));
    tableRows = [];
  }

  while (i < lines.length) {
    const raw = lines[i];

    // Screenshot placeholder
    const ssM = raw.match(/^>\s*📸\s*_\[SS-(\d+):\s*([^\]]+)\]_/);
    if (ssM) {
      flushTable();
      const [, num, desc] = ssM;
      const img = loadImg(num);
      if (img) {
        els.push(new Paragraph({ children: [img], alignment: AlignmentType.CENTER, spacing: sp(80, 0) }));
      } else {
        els.push(bqBox(`📸 SS-${num} — ${desc} (screenshot belum tersedia)`, "note"));
      }
      els.push(new Paragraph({
        children: [new TextRun({ text: `📸 SS-${num}: ${desc}`, color: C_MUTED, italics: true, size: 17, font: "Calibri" })],
        alignment: AlignmentType.CENTER,
        spacing: sp(20, 80),
      }));
      i++; continue;
    }

    // Table row
    if (raw.startsWith("|")) {
      tableRows.push(raw.trim().replace(/^\||\|$/g, "").split("|"));
      i++; continue;
    } else {
      flushTable();
    }

    // H1
    if (/^# [^#]/.test(raw)) {
      els.push(new Paragraph({
        children: [new TextRun({ text: raw.slice(2).trim(), bold: true, size: 40, color: C_DARK, font: "Calibri" })],
        spacing: sp(0, 60),
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C_PRIMARY, space: 6 } },
      }));
      i++; continue;
    }

    // H2
    if (/^## /.test(raw)) {
      els.push(new Paragraph({ children: [], spacing: sp(120, 60) }));
      els.push(h2Box(raw.slice(3).trim()));
      els.push(new Paragraph({ children: [], spacing: sp(40, 0) }));
      i++; continue;
    }

    // H3
    if (/^### /.test(raw)) {
      els.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: raw.slice(4).trim(), bold: true, size: 23, color: C_HEAD, font: "Calibri" })],
        spacing: sp(120, 40),
      }));
      i++; continue;
    }

    // HR
    if (/^[-*_]{3,}$/.test(raw.trim())) {
      els.push(new Paragraph({
        children: [],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C_BORDER, space: 1 } },
        spacing: sp(80, 80),
      }));
      i++; continue;
    }

    // Blockquote — kumpulkan multi-line
    if (raw.startsWith("> ")) {
      const bLines = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        bLines.push(lines[i].slice(2));
        i++;
      }
      const bText = bLines.join(" ").trim();
      const kind = bText.includes("⚠️") ? "warn"
                 : bText.includes("💡") ? "tip"
                 : bText.includes("✅") ? "ok"
                 : "note";
      els.push(bqBox(bText, kind));
      els.push(new Paragraph({ children: [], spacing: sp(40, 0) }));
      continue;
    }

    // Ordered list
    const olM = raw.match(/^(\d+)\.\s+(.*)/);
    if (olM) {
      els.push(new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        children: parseInline(olM[2]),
        spacing: sp(20, 20),
      }));
      i++; continue;
    }

    // Indented sub-item
    if (/^\s{3,}[-*]\s/.test(raw)) {
      const text = raw.replace(/^\s+[-*]\s+/, "");
      els.push(new Paragraph({
        numbering: { reference: "bullets-sub", level: 0 },
        children: parseInline(text),
        spacing: sp(10, 10),
      }));
      i++; continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(raw)) {
      const text = raw.replace(/^[-*]\s+/, "");
      els.push(new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: parseInline(text),
        spacing: sp(20, 20),
      }));
      i++; continue;
    }

    // Code block
    if (raw.startsWith("```")) {
      const cLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        cLines.push(lines[i]);
        i++;
      }
      i++;
      const codeTable = new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          borders: cellBorder("CBD5E1"),
          shading: { fill: "0F172A", type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
          children: cLines.map(cl => new Paragraph({
            children: [new TextRun({ text: cl || " ", font: "Courier New", size: 17, color: "E2E8F0" })],
            spacing: sp(0, 0),
          })),
        })] })]
      });
      els.push(new Paragraph({ children: [], spacing: sp(40, 0) }));
      els.push(codeTable);
      els.push(new Paragraph({ children: [], spacing: sp(0, 40) }));
      continue;
    }

    // Empty line
    if (raw.trim() === "") {
      els.push(new Paragraph({ children: [], spacing: sp(0, 0) }));
      i++; continue;
    }

    // ✅ status line
    if (raw.includes("✅")) {
      els.push(new Paragraph({
        children: [new TextRun({ text: raw.trim(), bold: true, color: C_GREEN, font: "Calibri", size: 21 })],
        spacing: sp(60, 40),
      }));
      i++; continue;
    }

    // Italic-only (signature)
    if (/^\*[^*].+\*$/.test(raw.trim())) {
      els.push(new Paragraph({
        children: [new TextRun({ text: raw.trim().replace(/^\*|\*$/g, ""), italics: true, color: C_MUTED, font: "Calibri", size: 19 })],
        alignment: AlignmentType.CENTER,
        spacing: sp(80, 0),
      }));
      i++; continue;
    }

    // Normal paragraph
    const t = raw.trim();
    if (t) {
      els.push(new Paragraph({ children: parseInline(t), spacing: sp(0, 40) }));
    }
    i++;
  }

  flushTable();
  return els;
}

// ── Daftar Isi ────────────────────────────────────────────────────────────────
function makeTOC() {
  const items = [
    ["1. Buat Akun GitHub", "14"],
    ["2. Fork Aplikasi", "15"],
    ["3. Buat Akun Supabase", "16"],
    ["4. Setup Database", "17"],
    ["5. Buat Akun Vercel", "19"],
    ["6. Deploy Aplikasi", "20"],
    ["7. Aplikasi Siap Dipakai", "22"],
    ["8. Aktifkan AI Coach Gratis (Groq)", "23"],
    ["9. Cara Update Jika Ada Fitur Baru", "26"],
  ];
  return items.map(([title]) =>
    new Paragraph({
      children: [new TextRun({ text: `• ${title}`, font: "Calibri", size: 21, color: C_HEAD })],
      spacing: sp(30, 30),
      indent: { left: 360 },
    })
  );
}

// ── Cover page ─────────────────────────────────────────────────────────────────
function makeCover() {
  return [
    new Paragraph({ children: [], spacing: sp(0, 1200) }),
    new Paragraph({
      children: [new TextRun({ text: "📘 Panduan Lengkap", bold: true, size: 52, color: C_PRIMARY, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: sp(0, 80),
    }),
    new Paragraph({
      children: [new TextRun({ text: "Karaya Finance", bold: true, size: 72, color: C_DARK, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: sp(0, 160),
    }),
    new Paragraph({
      children: [new TextRun({ text: "Setup aplikasi keuangan pribadimu dalam 15–30 menit", size: 26, color: C_MUTED, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: sp(0, 40),
    }),
    new Paragraph({
      children: [new TextRun({ text: "100% Gratis • GitHub + Supabase + Vercel", size: 22, color: C_MUTED, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: sp(0, 800),
    }),
    new Paragraph({
      children: [new TextRun({ text: "Versi 1.0  •  2025", size: 19, color: C_MUTED, italics: true, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: sp(0, 0),
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── Build Document ─────────────────────────────────────────────────────────────
async function main() {
  console.log("Parsing PANDUAN.md...");
  const content = parse(MD);
  console.log(`  ${content.length} elemen`);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 600, hanging: 300 } },
                     run: { font: "Calibri", size: 21 } } }],
        },
        {
          reference: "bullets-sub",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 960, hanging: 300 } },
                     run: { font: "Calibri", size: 19 } } }],
        },
        {
          reference: "numbers",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 600, hanging: 300 } },
                     run: { font: "Calibri", size: 21 } } }],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 21, color: C_HEAD } },
      },
      paragraphStyles: [
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal",
          run: { font: "Calibri", size: 23, bold: true, color: C_HEAD },
          paragraph: { spacing: { before: 120, after: 40 } } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },  // A4
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: "Karaya Finance", bold: true, color: "FFFFFF", font: "Calibri", size: 19 }),
              new TextRun({ text: "    Panduan Setup Lengkap", color: "CCFFF0", font: "Calibri", size: 17 }),
            ],
            shading: { fill: C_DARK, type: ShadingType.CLEAR },
            spacing: { before: 0, after: 0, line: 420, lineRule: "exact" },
            indent: { left: 160, right: 160 },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: "karaya-finance.vercel.app", color: C_MUTED, font: "Calibri", size: 16 }),
              new TextRun({ text: "    •    Halaman ", color: C_MUTED, font: "Calibri", size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: C_MUTED, font: "Calibri", size: 16 }),
            ],
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C_BORDER, space: 6 } },
            spacing: { before: 60, after: 0 },
          })],
        }),
      },
      children: [
        ...makeCover(),
        // TOC
        new Paragraph({
          children: [new TextRun({ text: "Daftar Isi", bold: true, size: 32, color: C_DARK, font: "Calibri" })],
          spacing: sp(0, 80),
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C_PRIMARY, space: 4 } },
        }),
        ...makeTOC(),
        new Paragraph({ children: [new PageBreak()] }),
        // Content
        ...content,
      ],
    }],
  });

  console.log("Generating DOCX...");
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT, buf);
  const kb = Math.round(buf.length / 1024);
  console.log(`\n✅  Panduan_Karaya_Finance.docx  —  ${kb} KB  (${(kb/1024).toFixed(1)} MB)`);
}

main().catch(console.error);
