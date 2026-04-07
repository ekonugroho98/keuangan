from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import Flowable

# ── Warna ────────────────────────────────────────────────────────────────────
C_PRIMARY   = colors.HexColor("#00C896")   # hijau Karaya
C_DARK      = colors.HexColor("#0F1923")   # bg gelap
C_SURFACE   = colors.HexColor("#1A2535")   # card
C_MUTED     = colors.HexColor("#8A9BB0")   # teks muted
C_WARNING   = colors.HexColor("#F59E0B")   # kuning
C_WHITE     = colors.white
C_LIGHT_BG  = colors.HexColor("#F0FDF9")   # bg info

PAGE_W, PAGE_H = A4

# ── Style helper ─────────────────────────────────────────────────────────────
def mkstyle(**kw):
    base = kw.pop("parent", None)
    s = ParagraphStyle("x", parent=base, **kw)
    return s

# ── Custom Flowable: kotak screenshot placeholder ─────────────────────────────
class SSBox(Flowable):
    def __init__(self, label, height=3.5*cm):
        super().__init__()
        self.label = label
        self.height = height
        self.width = PAGE_W - 4*cm

    def draw(self):
        w, h = self.width, self.height
        self.canv.saveState()
        # Background
        self.canv.setFillColor(colors.HexColor("#EFF6FF"))
        self.canv.setStrokeColor(colors.HexColor("#93C5FD"))
        self.canv.setLineWidth(1)
        self.canv.setDash(5, 3)
        self.canv.roundRect(0, 0, w, h, 6, fill=1, stroke=1)
        # Icon kamera
        self.canv.setFont("Helvetica-Bold", 18)
        self.canv.setFillColor(colors.HexColor("#93C5FD"))
        self.canv.drawCentredString(w/2, h/2 + 4, "📸")
        # Label
        self.canv.setFont("Helvetica", 8)
        self.canv.setFillColor(colors.HexColor("#3B82F6"))
        # Wrap label jika panjang
        max_w = w - 20
        words = self.label.split()
        lines, line = [], ""
        for word in words:
            test = (line + " " + word).strip()
            if self.canv.stringWidth(test, "Helvetica", 8) < max_w:
                line = test
            else:
                if line: lines.append(line)
                line = word
        if line: lines.append(line)
        y_start = h/2 - 10
        for i, ln in enumerate(lines[:3]):
            self.canv.drawCentredString(w/2, y_start - i*10, ln)
        self.canv.restoreState()

    def wrap(self, aw, ah):
        return self.width, self.height

# ── Header & Footer ───────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # Header strip
    canvas.setFillColor(C_DARK)
    canvas.rect(0, PAGE_H - 1.2*cm, PAGE_W, 1.2*cm, fill=1, stroke=0)
    canvas.setFillColor(C_PRIMARY)
    canvas.rect(0, PAGE_H - 1.2*cm, 0.5*cm, 1.2*cm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(C_WHITE)
    canvas.drawString(1*cm, PAGE_H - 0.8*cm, "💰 Karaya Finance — Panduan Setup")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(C_MUTED)
    canvas.drawRightString(PAGE_W - 1*cm, PAGE_H - 0.8*cm, "karaya.finance")
    # Footer
    canvas.setFillColor(C_DARK)
    canvas.rect(0, 0, PAGE_W, 0.8*cm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(C_MUTED)
    canvas.drawCentredString(PAGE_W/2, 0.25*cm, f"Halaman {doc.page}")
    canvas.setFillColor(C_PRIMARY)
    canvas.rect(0, 0, 0.5*cm, 0.8*cm, fill=1, stroke=0)
    canvas.restoreState()

def on_first_page(canvas, doc):
    canvas.saveState()
    # Full cover dark bg
    canvas.setFillColor(C_DARK)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Accent strip kiri
    canvas.setFillColor(C_PRIMARY)
    canvas.rect(0, 0, 0.6*cm, PAGE_H, fill=1, stroke=0)
    # Garis dekoratif
    canvas.setStrokeColor(C_PRIMARY)
    canvas.setLineWidth(0.5)
    canvas.setDash(4, 4)
    canvas.line(0.9*cm, 0, 0.9*cm, PAGE_H)
    canvas.setDash()
    # Footer
    canvas.setFillColor(colors.HexColor("#0A1520"))
    canvas.rect(0, 0, PAGE_W, 1.2*cm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(C_MUTED)
    canvas.drawCentredString(PAGE_W/2, 0.4*cm, "© 2026 Karaya Finance · Semua hak dilindungi")
    canvas.restoreState()

# ── Build PDF ─────────────────────────────────────────────────────────────────
def build():
    out = "/Users/macbookpro/Desktop/Karaya_Finance_Panduan_Setup.pdf"
    doc = SimpleDocTemplate(
        out, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=1.8*cm, bottomMargin=1.5*cm,
    )

    # ── Styles ────────────────────────────────────────────────────────────────
    normal = ParagraphStyle("normal", fontName="Helvetica", fontSize=10,
                            leading=16, textColor=colors.HexColor("#1E293B"),
                            alignment=TA_JUSTIFY)
    h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=20,
                        leading=26, textColor=C_PRIMARY, spaceAfter=6)
    h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=14,
                        leading=20, textColor=C_WHITE, spaceAfter=4)
    h3 = ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=11,
                        leading=16, textColor=colors.HexColor("#0F766E"), spaceAfter=4)
    bullet = ParagraphStyle("bullet", fontName="Helvetica", fontSize=10,
                            leading=17, leftIndent=16, textColor=colors.HexColor("#1E293B"),
                            spaceAfter=3)
    sub_bullet = ParagraphStyle("sub_bullet", fontName="Helvetica", fontSize=9.5,
                                leading=15, leftIndent=32, textColor=colors.HexColor("#475569"),
                                spaceAfter=2)
    tip = ParagraphStyle("tip", fontName="Helvetica-Oblique", fontSize=9,
                         leading=14, textColor=colors.HexColor("#0369A1"),
                         leftIndent=10, rightIndent=10)
    warn = ParagraphStyle("warn", fontName="Helvetica-Oblique", fontSize=9,
                          leading=14, textColor=colors.HexColor("#92400E"),
                          leftIndent=10, rightIndent=10)
    code_style = ParagraphStyle("code", fontName="Courier", fontSize=8.5,
                                leading=13, textColor=colors.HexColor("#1E293B"),
                                leftIndent=10)

    story = []

    # ══════════════════════════════════════════════════════════════════════════
    # COVER PAGE
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 4*cm))
    cover_logo = ParagraphStyle("logo", fontName="Helvetica-Bold", fontSize=48,
                                textColor=C_PRIMARY, alignment=TA_CENTER)
    story.append(Paragraph("💰", cover_logo))
    story.append(Spacer(1, 0.5*cm))

    cover_title = ParagraphStyle("ct", fontName="Helvetica-Bold", fontSize=30,
                                 textColor=C_WHITE, alignment=TA_CENTER, leading=38)
    story.append(Paragraph("Karaya Finance", cover_title))
    story.append(Spacer(1, 0.3*cm))

    cover_sub = ParagraphStyle("cs", fontName="Helvetica", fontSize=14,
                               textColor=C_MUTED, alignment=TA_CENTER, leading=22)
    story.append(Paragraph("Panduan Lengkap Setup Aplikasi Keuangan Pribadi", cover_sub))
    story.append(Spacer(1, 0.6*cm))

    cover_line_style = ParagraphStyle("cl", alignment=TA_CENTER)
    story.append(HRFlowable(width="60%", thickness=1, color=C_PRIMARY, spaceAfter=0.6*cm))

    cover_desc = ParagraphStyle("cd", fontName="Helvetica", fontSize=11,
                                textColor=colors.HexColor("#94A3B8"), alignment=TA_CENTER,
                                leading=18)
    story.append(Paragraph(
        "Ikuti panduan ini dan miliki aplikasi keuangan pribadimu sendiri.<br/>"
        "Estimasi waktu: <b><font color='#00C896'>15–30 menit</font></b> &nbsp;·&nbsp; "
        "Biaya: <b><font color='#00C896'>100% Gratis</font></b>",
        cover_desc))
    story.append(Spacer(1, 2.5*cm))

    # Chips layanan
    chips_data = [["GitHub", "Supabase", "Vercel"]]
    chips_table = Table(chips_data, colWidths=[4*cm, 4*cm, 4*cm])
    chips_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#1A2535")),
        ("TEXTCOLOR",  (0,0), (-1,-1), C_PRIMARY),
        ("FONTNAME",   (0,0), (-1,-1), "Helvetica-Bold"),
        ("FONTSIZE",   (0,0), (-1,-1), 11),
        ("ALIGN",      (0,0), (-1,-1), "CENTER"),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("ROWHEIGHT",  (0,0), (-1,-1), 0.8*cm),
        ("ROUNDEDCORNERS", [6,6,6,6]),
        ("BOX",        (0,0), (0,0),   0.5, C_PRIMARY),
        ("BOX",        (1,0), (1,0),   0.5, C_PRIMARY),
        ("BOX",        (2,0), (2,0),   0.5, C_PRIMARY),
        ("LEFTPADDING",  (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
    ]))
    story.append(chips_table)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # DAFTAR ISI
    # ══════════════════════════════════════════════════════════════════════════
    def section_header(title, emoji=""):
        items = []
        items.append(Spacer(1, 0.3*cm))
        header_bg = Table(
            [[Paragraph(f"{emoji}  {title}" if emoji else title, h2)]],
            colWidths=[PAGE_W - 4*cm]
        )
        header_bg.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), C_DARK),
            ("ROUNDEDCORNERS", [8,8,8,8]),
            ("TOPPADDING",    (0,0), (-1,-1), 10),
            ("BOTTOMPADDING", (0,0), (-1,-1), 10),
            ("LEFTPADDING",   (0,0), (-1,-1), 14),
        ]))
        items.append(header_bg)
        items.append(Spacer(1, 0.3*cm))
        return items

    def tip_box(text):
        box = Table(
            [[Paragraph(f"💡 {text}", tip)]],
            colWidths=[PAGE_W - 4*cm]
        )
        box.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), colors.HexColor("#E0F2FE")),
            ("ROUNDEDCORNERS", [6,6,6,6]),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ]))
        return [box, Spacer(1, 0.25*cm)]

    def warn_box(text):
        box = Table(
            [[Paragraph(f"⚠️  {text}", warn)]],
            colWidths=[PAGE_W - 4*cm]
        )
        box.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), colors.HexColor("#FEF9C3")),
            ("ROUNDEDCORNERS", [6,6,6,6]),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ]))
        return [box, Spacer(1, 0.25*cm)]

    def success_line(text):
        s = ParagraphStyle("ok", fontName="Helvetica-Bold", fontSize=10,
                           textColor=C_PRIMARY, leading=14)
        return [Paragraph(f"✅  {text}", s), Spacer(1, 0.2*cm)]

    def step_num(n, total=8):
        badge_style = ParagraphStyle("badge", fontName="Helvetica-Bold", fontSize=9,
                                     textColor=C_WHITE, alignment=TA_CENTER)
        badge = Table([[Paragraph(str(n), badge_style)]], colWidths=[0.6*cm], rowHeights=[0.6*cm])
        badge.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), C_PRIMARY),
            ("ROUNDEDCORNERS", [10,10,10,10]),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0), (-1,-1), 0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ]))
        return badge

    def numbered_item(n, text):
        ns = ParagraphStyle("ni", fontName="Helvetica", fontSize=10,
                            leading=15, textColor=colors.HexColor("#1E293B"))
        num_s = ParagraphStyle("nn", fontName="Helvetica-Bold", fontSize=10,
                               leading=15, textColor=C_PRIMARY, alignment=TA_CENTER)
        row = Table(
            [[Paragraph(str(n)+".", num_s), Paragraph(text, ns)]],
            colWidths=[0.7*cm, PAGE_W - 4.7*cm]
        )
        row.setStyle(TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "TOP"),
            ("TOPPADDING",    (0,0), (-1,-1), 2),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2),
            ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ]))
        return [row]

    def sub_item(text):
        s = ParagraphStyle("si", fontName="Helvetica", fontSize=9.5,
                           leading=14, textColor=colors.HexColor("#475569"),
                           leftIndent=18)
        return [Paragraph(f"– {text}", s)]

    # ── Daftar Isi ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5*cm))
    toc_title = ParagraphStyle("toc", fontName="Helvetica-Bold", fontSize=18,
                               textColor=C_DARK, leading=24)
    story.append(Paragraph("Daftar Isi", toc_title))
    story.append(HRFlowable(width="100%", thickness=1.5, color=C_PRIMARY, spaceAfter=0.4*cm))

    toc_items = [
        ("1", "Buat Akun GitHub"),
        ("2", "Fork Aplikasi"),
        ("3", "Buat Akun Supabase"),
        ("4", "Setup Database"),
        ("5", "Buat Akun Vercel"),
        ("6", "Deploy Aplikasi"),
        ("7", "Aplikasi Siap Dipakai"),
        ("8", "Cara Update Jika Ada Fitur Baru"),
    ]
    toc_data = []
    for num, title in toc_items:
        toc_data.append([
            Paragraph(num, ParagraphStyle("tn", fontName="Helvetica-Bold", fontSize=11,
                                          textColor=C_PRIMARY, alignment=TA_CENTER)),
            Paragraph(title, ParagraphStyle("tt", fontName="Helvetica", fontSize=11,
                                            textColor=colors.HexColor("#1E293B"), leading=16)),
        ])

    toc_table = Table(toc_data, colWidths=[1*cm, PAGE_W - 5*cm])
    toc_table.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("LINEBELOW",     (0,0), (-1,-2), 0.5, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0,0), (-1,-1),
         [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # LANGKAH 1 — GITHUB
    # ══════════════════════════════════════════════════════════════════════════
    story += section_header("Buat Akun GitHub", "1️⃣")
    story += warn_box("Sudah punya akun GitHub? Langsung login dan lanjut ke Langkah 2.")
    story.append(Paragraph(
        "GitHub adalah tempat menyimpan kode aplikasi. Kamu perlu akun untuk menyalin (fork) aplikasi ini.",
        normal))
    story.append(Spacer(1, 0.3*cm))

    story += numbered_item(1, "Buka <b>https://github.com/signup</b>")
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Halaman signup GitHub — form username, email, password"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(2, "Isi form pendaftaran:")
    story += sub_item("<b>Username</b> — nama unik kamu (contoh: johndoe)")
    story += sub_item("<b>Email</b> — email aktif")
    story += sub_item("<b>Password</b> — minimal 8 karakter")
    story += numbered_item(3, 'Klik tombol <b>"Create account"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Form yang sudah diisi, sebelum klik Create account"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(4, "Cek email → klik link verifikasi yang dikirim GitHub")
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Email verifikasi dari GitHub di inbox"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(5, "Login ke GitHub")
    story += success_line("Akun GitHub siap.")
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # LANGKAH 2 — FORK
    # ══════════════════════════════════════════════════════════════════════════
    story += section_header("Fork Aplikasi", "2️⃣")
    story.append(Paragraph(
        "Fork artinya <b>menyalin aplikasi ke akun GitHub milikmu sendiri</b>. "
        "Kamu akan punya salinan penuh yang bisa dikelola sendiri.", normal))
    story.append(Spacer(1, 0.3*cm))

    story += numbered_item(1, "Pastikan sudah login ke GitHub")
    story += numbered_item(2, "Buka link berikut: <b>https://github.com/ekonugroho98/keuangan</b>")
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Tampilan halaman repo keuangan di GitHub"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(3, 'Klik tombol <b>"Fork"</b> di pojok kanan atas halaman')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Posisi tombol Fork di pojok kanan atas"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(4, 'Di halaman berikutnya, klik <b>"Create fork"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Halaman konfirmasi fork, sebelum klik Create fork"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(5, "Tunggu beberapa detik...")
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Hasil fork — repo sudah muncul di akun kamu sendiri"))
    story.append(Spacer(1, 0.2*cm))

    story += success_line("Sekarang kamu punya salinan aplikasi di: github.com/USERNAME_KAMU/keuangan")
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # LANGKAH 3 — SUPABASE
    # ══════════════════════════════════════════════════════════════════════════
    story += section_header("Buat Akun Supabase", "3️⃣")
    story += warn_box("Sudah punya akun Supabase? Login dan langsung buat project baru (lewati ke langkah 5 di bagian ini).")
    story.append(Paragraph(
        "Supabase adalah database gratis untuk menyimpan semua data keuanganmu "
        "(transaksi, akun, goals, dan lainnya).", normal))
    story.append(Spacer(1, 0.3*cm))

    story += numbered_item(1, "Buka <b>https://supabase.com</b>")
    story += numbered_item(2, 'Klik <b>"Start your project"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Halaman utama Supabase, tunjukkan tombol Start your project"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(3, 'Pilih <b>"Sign up with GitHub"</b> — lebih mudah, tidak perlu isi form')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Halaman login Supabase, tunjukkan opsi Sign up with GitHub"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(4, 'Klik <b>"Authorize supabase"</b> jika muncul popup')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Popup authorize Supabase di GitHub"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(5, 'Klik tombol <b>"New project"</b> di dashboard')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Dashboard Supabase, tunjukkan tombol New project"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(6, "Isi form project:")
    story += sub_item("<b>Project name</b> — isi bebas, contoh: keuangan-pribadi")
    story += sub_item('<b>Database password</b> — klik "Generate a password" lalu <b>simpan di tempat aman</b>')
    story += sub_item('<b>Region</b> — pilih <b>"Southeast Asia (Singapore)"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Form buat project yang sudah diisi"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(7, 'Klik <b>"Create new project"</b> → tunggu 1–2 menit')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Tampilan project Supabase setelah selesai dibuat"))
    story.append(Spacer(1, 0.2*cm))

    story += success_line("Project Supabase siap.")
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # LANGKAH 4 — SETUP DATABASE
    # ══════════════════════════════════════════════════════════════════════════
    story += section_header("Setup Database", "4️⃣")
    story.append(Paragraph(
        "Langkah ini membuat semua tabel yang dibutuhkan aplikasi di database kamu.", normal))
    story.append(Spacer(1, 0.3*cm))

    story += numbered_item(1, 'Di dashboard Supabase, klik menu <b>"SQL Editor"</b> di sidebar kiri')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Sidebar Supabase, tunjukkan menu SQL Editor"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(2, 'Klik <b>"New query"</b>')
    story += numbered_item(3, "Buka link berikut di tab baru:")
    story += tip_box("https://github.com/ekonugroho98/keuangan/blob/main/supabase_schema.sql")
    story += numbered_item(4, 'Klik tombol <b>"Copy raw file"</b> — icon copy di kanan atas kode')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Halaman supabase_schema.sql di GitHub, tunjukkan tombol copy"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(5, "Kembali ke tab Supabase SQL Editor")
    story += numbered_item(6, "<b>Paste</b> (Ctrl+V / Cmd+V) semua kode yang baru disalin")
    story += numbered_item(7, 'Klik tombol <b>"Run"</b> atau tekan Ctrl+Enter')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: SQL Editor dengan kode yang sudah di-paste, sebelum Run"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(8, 'Tunggu sampai muncul pesan <b>"Success"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Pesan Success setelah Run berhasil"))
    story.append(Spacer(1, 0.2*cm))

    story += success_line("Database siap.")

    # Sub-section: Salin Kredensial
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph("Salin Kredensial Supabase", h3))
    story.append(Paragraph(
        "Kamu perlu 2 data ini untuk langkah deploy. Simpan di Notepad / Notes.", normal))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(1, 'Di sidebar Supabase, klik <b>"Settings"</b> (ikon gear di bawah)')
    story += numbered_item(2, 'Klik <b>"API"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Halaman Settings → API Supabase"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(3, "Salin dan simpan dua nilai berikut:")
    story += sub_item('<b>Project URL</b> — contoh: https://abcdefgh.supabase.co')
    story += sub_item('<b>anon public</b> key — string panjang di bawah "Project API Keys"')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Posisi Project URL dan anon key (blur/sensor sebagian nilainya)"))
    story.append(Spacer(1, 0.2*cm))

    story += tip_box("Simpan kedua nilai ini di Notepad / Notes — akan dipakai di Langkah 6.")
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # LANGKAH 5 — VERCEL
    # ══════════════════════════════════════════════════════════════════════════
    story += section_header("Buat Akun Vercel", "5️⃣")
    story += warn_box("Sudah punya akun Vercel? Login dan langsung lanjut ke Langkah 6.")
    story.append(Paragraph(
        "Vercel adalah layanan hosting gratis untuk menjalankan aplikasimu di internet.", normal))
    story.append(Spacer(1, 0.3*cm))

    story += numbered_item(1, "Buka <b>https://vercel.com/signup</b>")
    story += numbered_item(2, 'Pilih <b>"Continue with GitHub"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Halaman signup Vercel, tunjukkan tombol Continue with GitHub"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(3, 'Klik <b>"Authorize Vercel"</b> jika muncul popup')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Popup authorize Vercel di GitHub"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(4, 'Pilih tipe akun: <b>"Hobby"</b> (gratis)')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Pilihan tipe akun Vercel, tunjukkan opsi Hobby"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(5, "Isi nama lengkap → klik Continue")
    story += success_line("Akun Vercel siap.")
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # LANGKAH 6 — DEPLOY
    # ══════════════════════════════════════════════════════════════════════════
    story += section_header("Deploy Aplikasi", "6️⃣")
    story.append(Paragraph(
        "Langkah ini menghubungkan kode di GitHub ke Vercel dan "
        "menjalankannya sebagai website yang bisa diakses siapa saja.", normal))
    story.append(Spacer(1, 0.3*cm))

    story += numbered_item(1, 'Di dashboard Vercel, klik <b>"Add New Project"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Dashboard Vercel, tunjukkan tombol Add New Project"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(2, 'Di bagian "Import Git Repository", cari repo <b>keuangan</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Daftar repo GitHub di Vercel, repo keuangan terlihat"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(3, 'Klik <b>"Import"</b> di sebelah repo keuangan')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Posisi tombol Import di sebelah repo keuangan"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(4, "<b>Jangan ubah apapun</b> di halaman konfigurasi, kecuali bagian di bawah ini")

    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("Tambahkan Environment Variables", h3))
    story.append(Paragraph(
        'Scroll ke bawah, cari bagian <b>"Environment Variables"</b>, '
        "lalu tambahkan 2 variabel berikut:", normal))
    story.append(Spacer(1, 0.2*cm))

    env_data = [
        ["Name", "Value"],
        ["VITE_SUPABASE_URL", "Project URL dari Supabase (langkah 4)"],
        ["VITE_SUPABASE_ANON_KEY", "anon public key dari Supabase (langkah 4)"],
    ]
    env_table = Table(env_data, colWidths=[5.5*cm, PAGE_W - 9.5*cm])
    env_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),   C_DARK),
        ("TEXTCOLOR",     (0,0), (-1,0),   C_PRIMARY),
        ("FONTNAME",      (0,0), (-1,0),   "Helvetica-Bold"),
        ("FONTNAME",      (0,1), (0,-1),   "Courier-Bold"),
        ("FONTNAME",      (1,1), (1,-1),   "Helvetica"),
        ("FONTSIZE",      (0,0), (-1,-1),  9),
        ("BACKGROUND",    (0,1), (-1,1),   colors.white),
        ("BACKGROUND",    (0,2), (-1,2),   colors.HexColor("#F8FAFC")),
        ("GRID",          (0,0), (-1,-1),  0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING",    (0,0), (-1,-1),  7),
        ("BOTTOMPADDING", (0,0), (-1,-1),  7),
        ("LEFTPADDING",   (0,0), (-1,-1),  8),
    ]))
    story.append(env_table)
    story.append(Spacer(1, 0.25*cm))

    story.append(SSBox("SS: 2 variabel sudah diisi di form Environment Variables Vercel"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(5, 'Klik <b>"Deploy"</b> → tunggu 1–3 menit')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Loading proses deployment Vercel"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(6, 'Muncul halaman konfetti 🎉 → klik <b>"Continue to Dashboard"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Halaman sukses deploy dengan konfetti 🎉"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(7, 'Klik tombol <b>"Visit"</b> untuk membuka aplikasimu')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Dashboard Vercel dengan tombol Visit dan URL aplikasi"))
    story.append(Spacer(1, 0.2*cm))

    story += success_line("Aplikasi sudah live di internet!")
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # LANGKAH 7 — PAKAI APLIKASI
    # ══════════════════════════════════════════════════════════════════════════
    story += section_header("Aplikasi Siap Dipakai", "7️⃣")
    story.append(Paragraph(
        "Kamu akan diarahkan ke halaman login aplikasi Karaya Finance.", normal))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("Daftar akun pertama kali:", h3))
    story += numbered_item(1, 'Klik <b>"Daftar"</b> atau <b>"Sign Up"</b>')
    story += numbered_item(2, "Isi email dan password")
    story += numbered_item(3, "Cek email → klik link konfirmasi dari Supabase")
    story += numbered_item(4, "Login → aplikasi siap digunakan")
    story.append(Spacer(1, 0.2*cm))

    story.append(SSBox("SS: Halaman login Karaya Finance"))
    story.append(Spacer(1, 0.2*cm))
    story.append(SSBox("SS: Tampilan dasbor setelah berhasil login"))
    story.append(Spacer(1, 0.2*cm))

    story += tip_box("URL aplikasimu bisa ditemukan di dashboard Vercel. "
                     "Contoh: https://keuangan-namakamu.vercel.app")
    story += success_line("Selamat! Aplikasi keuanganmu sudah berjalan. 🎉")
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # LANGKAH 8 — UPDATE
    # ══════════════════════════════════════════════════════════════════════════
    story += section_header("Cara Update Jika Ada Fitur Baru", "8️⃣")
    story.append(Paragraph(
        "Jika ada update atau fitur baru, kamu bisa mengambilnya tanpa kehilangan data.", normal))
    story.append(Spacer(1, 0.3*cm))

    story += numbered_item(1, "Buka repo fork kamu di GitHub: github.com/USERNAME_KAMU/keuangan")
    story += numbered_item(2, 'Klik tombol <b>"Sync fork"</b> — ada di atas daftar file')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Posisi tombol Sync fork di halaman repo GitHub"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(3, 'Klik <b>"Update branch"</b>')
    story.append(Spacer(1, 0.15*cm))
    story.append(SSBox("SS: Popup konfirmasi Update branch"))
    story.append(Spacer(1, 0.2*cm))

    story += numbered_item(4, "Vercel akan otomatis deploy ulang dalam 1–2 menit")
    story += success_line("Aplikasi terupdate, data tetap aman.")

    # ══════════════════════════════════════════════════════════════════════════
    # FAQ
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("❓  FAQ", h1))
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceAfter=0.3*cm))

    faqs = [
        ("Apakah data saya aman?",
         "Ya. Data tersimpan di Supabase milikmu sendiri. "
         "Tidak ada pihak lain yang bisa mengaksesnya."),
        ("Apakah benar-benar gratis?",
         "Ya, 100% gratis untuk penggunaan pribadi (1–5 orang). "
         "Tidak ada biaya tersembunyi."),
        ("Bagaimana jika aplikasi tidak bisa dibuka?",
         "Kemungkinan project Supabase ter-pause (otomatis setelah 7 hari tidak aktif "
         "di free plan). Buka supabase.com → klik project → klik Resume. Data tidak hilang."),
        ("Bisa diakses dari HP?",
         "Bisa. Aplikasi responsive dan bisa dibuka dari browser HP manapun."),
    ]

    q_style = ParagraphStyle("q", fontName="Helvetica-Bold", fontSize=10,
                             textColor=C_DARK, leading=15)
    a_style = ParagraphStyle("a", fontName="Helvetica", fontSize=10,
                             textColor=colors.HexColor("#475569"), leading=15)

    for q, a in faqs:
        faq_data = [
            [Paragraph(f"Q: {q}", q_style)],
            [Paragraph(f"A: {a}", a_style)],
        ]
        faq_box = Table(faq_data, colWidths=[PAGE_W - 4*cm])
        faq_box.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0), colors.HexColor("#F0FDF9")),
            ("BACKGROUND",    (0,1), (-1,1), colors.white),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("LEFTPADDING",   (0,0), (-1,-1), 12),
            ("BOX",           (0,0), (-1,-1), 0.5, colors.HexColor("#D1FAE5")),
            ("LINEBELOW",     (0,0), (-1,0),  0.5, colors.HexColor("#6EE7B7")),
        ]))
        story.append(faq_box)
        story.append(Spacer(1, 0.3*cm))

    # ── Penutup ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5*cm))
    closing = ParagraphStyle("cl", fontName="Helvetica-Bold", fontSize=13,
                             textColor=C_PRIMARY, alignment=TA_CENTER, leading=20)
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceAfter=0.4*cm))
    story.append(Paragraph("Selamat menggunakan Karaya Finance! 💰", closing))
    story.append(Spacer(1, 0.2*cm))
    sub_closing = ParagraphStyle("sc", fontName="Helvetica", fontSize=10,
                                 textColor=C_MUTED, alignment=TA_CENTER)
    story.append(Paragraph("Ada pertanyaan? Hubungi kami melalui halaman produk.", sub_closing))

    # ── Build ──────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_page)
    print(f"✅ PDF berhasil dibuat: {out}")

build()
