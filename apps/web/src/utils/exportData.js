const toLocalDateStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ═══════════════════════════════════════════════════════════════════════════
 * Minimal, Zero-Dependency Native .xlsx (OOXML ZIP) + .csv Generator
 * Menghasilkan file .xlsx asli (tanpa warning ekstensi di Excel/Numbers/Sheets)
 * lengkap dengan multi-sheet, lebar kolom, style header, dan format angka #,##0.
 * ═══════════════════════════════════════════════════════════════════════════ */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/** Buat arsip ZIP (STORE method=0) dari daftar [{ name, content }] */
function buildZip(files) {
    const encoder = new TextEncoder();
    const entries = files.map((f) => {
        const nameBytes = encoder.encode(f.name);
        const dataBytes = typeof f.content === "string" ? encoder.encode(f.content) : f.content;
        const crc = crc32(dataBytes);
        return { nameBytes, dataBytes, crc, offset: 0 };
    });

    let offset = 0;
    const localParts = [];
    for (const e of entries) {
        e.offset = offset;
        const header = new Uint8Array(30 + e.nameBytes.length);
        const view = new DataView(header.buffer);
        view.setUint32(0, 0x04034b50, true); // Local file header signature
        view.setUint16(4, 20, true);         // Version needed (2.0)
        view.setUint16(6, 0x0800, true);     // UTF-8 flag
        view.setUint16(8, 0, true);          // Compression method: 0 (STORED)
        view.setUint16(10, 0, true);         // Mod time
        view.setUint16(12, 0x5521, true);    // Mod date
        view.setUint32(14, e.crc, true);     // CRC-32
        view.setUint32(18, e.dataBytes.length, true); // Compressed size
        view.setUint32(22, e.dataBytes.length, true); // Uncompressed size
        view.setUint16(26, e.nameBytes.length, true); // File name length
        view.setUint16(28, 0, true);         // Extra field length
        header.set(e.nameBytes, 30);

        localParts.push(header, e.dataBytes);
        offset += header.length + e.dataBytes.length;
    }

    const centralOffset = offset;
    const centralParts = [];
    let centralSize = 0;
    for (const e of entries) {
        const cd = new Uint8Array(46 + e.nameBytes.length);
        const view = new DataView(cd.buffer);
        view.setUint32(0, 0x02014b50, true); // Central directory signature
        view.setUint16(4, 20, true);         // Version made by
        view.setUint16(6, 20, true);         // Version needed
        view.setUint16(8, 0x0800, true);     // UTF-8 flag
        view.setUint16(10, 0, true);         // Method: STORED
        view.setUint16(12, 0, true);         // Mod time
        view.setUint16(14, 0x5521, true);    // Mod date
        view.setUint32(16, e.crc, true);
        view.setUint32(20, e.dataBytes.length, true);
        view.setUint32(24, e.dataBytes.length, true);
        view.setUint16(28, e.nameBytes.length, true);
        view.setUint16(30, 0, true);         // Extra length
        view.setUint16(32, 0, true);         // Comment length
        view.setUint16(34, 0, true);         // Disk number
        view.setUint16(36, 0, true);         // Internal attrs
        view.setUint32(38, 0, true);         // External attrs
        view.setUint32(42, e.offset, true);  // Relative offset of local header
        cd.set(e.nameBytes, 46);
        centralParts.push(cd);
        centralSize += cd.length;
    }

    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // End of central directory signature
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, entries.length, true);
    eocdView.setUint16(10, entries.length, true);
    eocdView.setUint32(12, centralSize, true);
    eocdView.setUint32(16, centralOffset, true);
    eocdView.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, eocd], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
}

function xmlEscape(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function colLetter(colIdx) {
    let n = colIdx + 1;
    let s = "";
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - m) / 26);
    }
    return s;
}

/**
 * Style indices di xl/styles.xml:
 * 0 = Default cell
 * 1 = Title / Section Header (Bold 13pt, Forest Green text)
 * 2 = Table Header (Bold white text, Forest Green #46634E fill, border)
 * 3 = Text Cell (normal border)
 * 4 = Currency Number Cell (#,##0, normal border)
 * 5 = Bold Summary Label Cell (soft green fill, bold, border)
 * 6 = Bold Summary Currency Cell (#,##0, soft green fill, bold, border)
 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><color rgb="FF1F2420"/><name val="Calibri"/></font>
    <font><b/><sz val="13"/><color rgb="FF2D4735"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1F2420"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF46634E"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEBF1E9"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD8E0D5"/></left>
      <right style="thin"><color rgb="FFD8E0D5"/></right>
      <top style="thin"><color rgb="FFD8E0D5"/></top>
      <bottom style="thin"><color rgb="FFD8E0D5"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

function buildWorksheetXml({ rows, widths = [] }) {
    const colsXml = widths.length
        ? `<cols>${widths
              .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
              .join("")}</cols>`
        : "";

    const rowsXml = rows
        .map((row, rIdx) => {
            const rowNum = rIdx + 1;
            if (!row || row.length === 0) return `<row r="${rowNum}"/>`;
            const cellsXml = row
                .map((cell, cIdx) => {
                    if (cell === null || cell === undefined || cell === "") return "";
                    const ref = `${colLetter(cIdx)}${rowNum}`;
                    const isObj = typeof cell === "object" && cell !== null;
                    const val = isObj ? cell.v : cell;
                    const style = isObj && cell.s !== undefined ? cell.s : typeof val === "number" ? 4 : 3;
                    if (typeof val === "number" && Number.isFinite(val)) {
                        return `<c r="${ref}" s="${style}" t="n"><v>${val}</v></c>`;
                    }
                    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xmlEscape(val)}</t></is></c>`;
                })
                .join("");
            return `<row r="${rowNum}" ht="20" customHeight="1">${cellsXml}</row>`;
        })
        .join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

export function buildXlsxBlob(sheets) {
    const safeSheets = sheets.map((s, idx) => ({
        name: (s.name || `Sheet${idx + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31),
        xml: buildWorksheetXml(s),
    }));

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets
      .map(
          (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("\n  ")}
</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets
        .map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("\n    ")}
  </sheets>
</workbook>`;

    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets
      .map(
          (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("\n  ")}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const files = [
        { name: "[Content_Types].xml", content: contentTypes },
        { name: "_rels/.rels", content: rootRels },
        { name: "xl/workbook.xml", content: workbookXml },
        { name: "xl/_rels/workbook.xml.rels", content: workbookRels },
        { name: "xl/styles.xml", content: STYLES_XML },
        ...safeSheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: s.xml })),
    ];

    return buildZip(files);
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const TYPE_LABEL = {
    income: "Pemasukan",
    expense: "Pengeluaran",
    transfer: "Transfer",
};

/**
 * Export daftar transaksi ke CSV (UTF-8 BOM agar langsung rapi di Excel)
 */
export function exportTransactionsCSV(transactions = [], opts = {}) {
    const filename = opts.filename || `keluarga-berkembang-transaksi-${toLocalDateStr()}.csv`;
    const headers = [
        "Tanggal",
        "Tipe",
        "Kategori",
        "Jumlah (Rp)",
        "Rekening Sumber",
        "Rekening Tujuan",
        "Dicatat Oleh",
        "Peruntukan",
        "Catatan",
    ];
    const rows = transactions.map((tx) => [
        tx.date || "",
        TYPE_LABEL[tx.type] || tx.type || "",
        tx.category || "",
        tx.amount ?? 0,
        tx.account_name || "",
        tx.type === "transfer" ? tx.to_account_name || "" : "",
        tx.recorded_by?.display_name || "",
        tx.beneficiary || (tx.type === "expense" ? "Bersama" : ""),
        tx.note || "",
    ]);

    const csv = [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, filename);
}

/**
 * Export daftar transaksi (+ ringkasan & breakdown kategori opsional) ke file Excel (.xlsx) asli
 */
export function exportTransactionsExcel(transactions = [], opts = {}) {
    const filename = opts.filename || `keluarga-berkembang-transaksi-${toLocalDateStr()}.xlsx`;
    const periodLabel = opts.periodLabel || "Semua Periode";
    const scopeLabel = opts.scopeLabel || "Seluruh Keluarga";

    // Hitung ringkasan otomatis jika tidak dikirim lewat opts.summary
    const piutangOffset = transactions
        .filter((tx) => tx.type === "income" && tx.category === "Piutang")
        .reduce((a, tx) => a + (tx.amount || 0), 0);
    const totalIn =
        opts.summary?.income ??
        transactions
            .filter((tx) => tx.type === "income" && tx.category !== "Piutang")
            .reduce((a, tx) => a + (tx.amount || 0), 0);
    const rawOut = transactions
        .filter((tx) => tx.type === "expense")
        .reduce((a, tx) => a + (tx.amount || 0), 0);
    const totalOut = opts.summary?.expense ?? Math.max(0, rawOut - piutangOffset);
    const totalTransfer =
        opts.summary?.transfer ??
        transactions
            .filter((tx) => tx.type === "transfer")
            .reduce((a, tx) => a + (tx.amount || 0), 0);
    const net = opts.summary?.net ?? totalIn - totalOut;

    // Sheet 1: Daftar Transaksi
    const txRows = [
        [{ v: `KELUARGA BERKEMBANG — DAFTAR TRANSAKSI (${periodLabel})`, s: 1 }],
        [{ v: `Cakupan: ${scopeLabel} · Diekspor pada ${toLocalDateStr()}`, s: 0 }],
        [],
        [
            { v: "Ringkasan Periode", s: 2 },
            { v: "Total Pemasukan (Rp)", s: 2 },
            { v: "Total Pengeluaran (Rp)", s: 2 },
            { v: "Total Transfer (Rp)", s: 2 },
            { v: "Arus Kas Bersih (Rp)", s: 2 },
        ],
        [
            { v: `${transactions.length} Transaksi`, s: 5 },
            { v: totalIn, s: 6 },
            { v: totalOut, s: 6 },
            { v: totalTransfer, s: 6 },
            { v: net, s: 6 },
        ],
        [],
        [
            { v: "Tanggal", s: 2 },
            { v: "Tipe", s: 2 },
            { v: "Kategori", s: 2 },
            { v: "Jumlah (Rp)", s: 2 },
            { v: "Rekening Sumber", s: 2 },
            { v: "Rekening Tujuan", s: 2 },
            { v: "Dicatat Oleh", s: 2 },
            { v: "Peruntukan", s: 2 },
            { v: "Catatan", s: 2 },
        ],
        ...transactions.map((tx) => [
            { v: tx.date || "", s: 3 },
            { v: TYPE_LABEL[tx.type] || tx.type || "", s: 3 },
            { v: tx.category || "", s: 3 },
            { v: Number(tx.amount || 0), s: 4 },
            { v: tx.account_name || "", s: 3 },
            { v: tx.type === "transfer" ? tx.to_account_name || "" : "-", s: 3 },
            { v: tx.recorded_by?.display_name || "-", s: 3 },
            { v: tx.beneficiary || (tx.type === "expense" ? "Bersama" : "-"), s: 3 },
            { v: tx.note || "", s: 3 },
        ]),
    ];

    const sheets = [
        {
            name: "Daftar Transaksi",
            widths: [14, 15, 22, 18, 18, 18, 16, 16, 38],
            rows: txRows,
        },
    ];

    // Sheet 2: Rincian Kategori & Rekening (selalu disertakan agar kaya informasi di Excel)
    const catMap = {};
    transactions.forEach((tx) => {
        if (tx.type === "expense" && tx.category) {
            catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount;
        } else if (tx.type === "income" && tx.category === "Piutang") {
            catMap.Piutang = Math.max(0, (catMap.Piutang || 0) - tx.amount);
        }
    });
    const sortedCats = Object.entries(catMap)
        .filter(([, amt]) => amt > 0)
        .sort((a, b) => b[1] - a[1]);

    const summarySheetRows = [
        [{ v: `RINGKASAN & RINCIAN KATEGORI — ${periodLabel}`, s: 1 }],
        [{ v: `Cakupan: ${scopeLabel}`, s: 0 }],
        [],
        [
            { v: "Metrik Keuangan", s: 2 },
            { v: "Nilai (Rp)", s: 2 },
            { v: "Keterangan", s: 2 },
        ],
        [{ v: "Total Pemasukan", s: 3 }, { v: totalIn, s: 4 }, { v: "Tidak termasuk transfer & pelunasan piutang", s: 3 }],
        [{ v: "Total Pengeluaran Bersih", s: 3 }, { v: totalOut, s: 4 }, { v: "Sudah dikurangi pelunasan piutang/talangan", s: 3 }],
        [{ v: "Total Transfer Antar Rekening", s: 3 }, { v: totalTransfer, s: 4 }, { v: "Perpindahan saldo internal", s: 3 }],
        [{ v: "Arus Kas Bersih (Net Cashflow)", s: 5 }, { v: net, s: 6 }, { v: totalIn > 0 ? `Rasio Tabungan: ${Math.round(((totalIn - totalOut) / totalIn) * 100)}%` : "-", s: 5 }],
        [],
        [
            { v: "Kategori Pengeluaran", s: 2 },
            { v: "Total Pengeluaran (Rp)", s: 2 },
            { v: "Porsi (%)", s: 2 },
            ...(opts.budgetMap ? [{ v: "Anggaran Bulan Ini (Rp)", s: 2 }, { v: "Sisa / Selisih (Rp)", s: 2 }] : []),
        ],
        ...sortedCats.map(([cat, amt]) => {
            const pct = totalOut > 0 ? `${Math.round((amt / totalOut) * 100)}%` : "0%";
            const bAmt = opts.budgetMap?.[cat];
            return [
                { v: cat, s: 3 },
                { v: amt, s: 4 },
                { v: pct, s: 3 },
                ...(opts.budgetMap
                    ? [
                          bAmt !== undefined ? { v: bAmt, s: 4 } : { v: "-", s: 3 },
                          bAmt !== undefined ? { v: bAmt - amt, s: 4 } : { v: "-", s: 3 },
                      ]
                    : []),
            ];
        }),
        [
            { v: "TOTAL PENGELUARAN", s: 5 },
            { v: totalOut, s: 6 },
            { v: "100%", s: 5 },
            ...(opts.budgetMap ? [{ v: "", s: 5 }, { v: "", s: 5 }] : []),
        ],
    ];

    if (opts.accounts && opts.accounts.length > 0) {
        summarySheetRows.push(
            [],
            [
                { v: "Nama Rekening", s: 2 },
                { v: "Saldo Saat Ini (Rp)", s: 2 },
                { v: "Tipe / Pemilik", s: 2 },
            ],
            ...opts.accounts.map((a) => [
                { v: a.name, s: 3 },
                a.can_view === false || a.balance === null
                    ? { v: "Privat", s: 3 }
                    : { v: Number(a.balance || 0), s: 4 },
                { v: `${a.type || "-"} (${a.owner?.display_name || "Bersama"}${a.visibility === "private" ? " · Privat" : ""})`, s: 3 },
            ]),
            [
                { v: "TOTAL SALDO REKENING", s: 5 },
                { v: opts.accounts.reduce((s, a) => s + (a.balance || 0), 0), s: 6 },
                { v: `${opts.accounts.length} Rekening`, s: 5 },
            ],
        );
    }

    sheets.unshift({
        name: "Ringkasan & Kategori",
        widths: [28, 22, 26, 22, 22],
        rows: summarySheetRows,
    });

    const blob = buildXlsxBlob(sheets);
    triggerDownload(blob, filename);
}
