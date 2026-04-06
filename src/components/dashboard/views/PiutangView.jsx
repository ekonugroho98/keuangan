import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import AmountInput from "../../ui/AmountInput";

const EMOJI_OPTIONS = ["🤝","👤","👫","🧑‍💼","👨‍👩‍👧","🏠","🚗","💼","📱","💻","🎓","🏪","🛒","💰","🎮","📚","☕","🍕","✈️","🎯"];
const COLOR_OPTIONS = ["var(--color-primary)","#4FC3F7","#14b8a6","#22c55e","#f59e0b","#f97316","#ff716c","#ec4899","#a855f7","var(--color-subtle)"];

const emptyForm = (defaultAccount = "") => ({
    borrower_name: "",
    icon: "🤝",
    color: "var(--color-primary)",
    total: "",
    remaining: "",
    from_account: defaultAccount,
    due_date: "",
    notes: "",
});

const PiutangView = ({ piutang = [], onAdd, onEdit, onDelete, onTerima, accounts = [] }) => {
    const [showModal, setShowModal]     = useState(false);
    const [editTarget, setEditTarget]   = useState(null);
    const [form, setForm]               = useState(emptyForm());
    const [confirmDelete, setConfirmDelete] = useState(null);

    // State untuk modal Terima Kembali
    const [terimaTarget, setTerimaTarget] = useState(null);
    const [terimaAmount, setTerimaAmount] = useState("");
    const [terimaAccount, setTerimaAccount] = useState("");

    const openAdd = () => {
        setEditTarget(null);
        setForm(emptyForm(accounts[0]?.name || ""));
        setShowModal(true);
    };

    const openEdit = (p) => {
        setEditTarget(p);
        setForm({
            borrower_name: p.borrower_name,
            icon: p.icon,
            color: p.color,
            total: p.total,
            remaining: p.remaining,
            from_account: p.from_account || accounts[0]?.name || "",
            due_date: p.due_date || "",
            notes: p.notes || "",
        });
        setShowModal(true);
    };

    const handleSubmit = () => {
        if (!form.borrower_name.trim() || !form.total || !form.remaining) return;
        const payload = {
            borrower_name: form.borrower_name.trim(),
            icon:          form.icon,
            color:         form.color,
            total:         parseInt(form.total),
            remaining:     parseInt(form.remaining),
            from_account:  form.from_account || null,
            due_date:      form.due_date || null,
            notes:         form.notes.trim() || null,
        };
        if (editTarget) onEdit(editTarget.id, payload);
        else onAdd(payload);
        setShowModal(false);
    };

    // Untuk piutang baru wajib pilih akun; edit tidak wajib (akun sudah dipotong sebelumnya)
    const canSubmit = form.borrower_name.trim() && form.total && form.remaining &&
        (editTarget || form.from_account);

    const totalDipinjamkan = piutang.reduce((a, p) => a + p.total, 0);
    const totalSisa        = piutang.reduce((a, p) => a + p.remaining, 0);
    const totalKembali     = totalDipinjamkan - totalSisa;

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(22px,4vw,32px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
                        Piutang
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
                        {piutang.length} piutang · Sisa tagihan {fmtRp(totalSisa)}
                    </p>
                </div>
                <button onClick={openAdd}
                    style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#60fcc6,#19ce9b)", color: "#0a2e22", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    + Catat Piutang
                </button>
            </div>

            {/* Summary cards */}
            {piutang.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
                    <div style={{ background: "rgba(96,252,198,.08)", border: "1px solid rgba(96,252,198,.2)", borderRadius: 12, padding: "14px 18px" }}>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>TOTAL DIPINJAMKAN</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary)" }}>{fmtRp(totalDipinjamkan)}</div>
                    </div>
                    <div style={{ background: "rgba(96,252,198,.06)", border: "1px solid rgba(96,252,198,.15)", borderRadius: 12, padding: "14px 18px" }}>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>SUDAH KEMBALI</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#22c55e" }}>{fmtRp(totalKembali)}</div>
                    </div>
                    <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 12, padding: "14px 18px" }}>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>BELUM KEMBALI</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b" }}>{fmtRp(totalSisa)}</div>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {piutang.length === 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🤝</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6 }}>Belum ada piutang tercatat</div>
                    <div style={{ fontSize: 13, color: "var(--color-subtle)", marginBottom: 20 }}>Catat uang yang kamu pinjamkan ke orang lain agar tidak lupa</div>
                    <button onClick={openAdd}
                        style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#60fcc6,#19ce9b)", color: "#0a2e22", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        + Catat Piutang Pertama
                    </button>
                </div>
            )}

            {/* Grid kartu */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {piutang.map(p => {
                    const returned = p.total - p.remaining;
                    const pct      = p.total > 0 ? Math.min(100, Math.round((returned / p.total) * 100)) : 0;
                    const lunas    = p.remaining <= 0;

                    // Hitung status jatuh tempo
                    const today     = new Date().toISOString().slice(0, 10);
                    const overdue   = !lunas && p.due_date && p.due_date < today;
                    const nearDue   = !lunas && !overdue && p.due_date && (new Date(p.due_date) - new Date(today)) / 86400000 <= 7;

                    return (
                        <div key={p.id} style={{
                            background: "var(--bg-surface)",
                            border: `1px solid ${lunas ? "#60fcc633" : overdue ? "rgba(255,113,108,.3)" : p.color + "22"}`,
                            borderRadius: 16, padding: 24, position: "relative",
                        }}>
                            {/* Badge status */}
                            {lunas && (
                                <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(96,252,198,.15)", border: "1px solid rgba(96,252,198,.3)", borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "var(--color-primary)" }}>
                                    ✓ LUNAS
                                </div>
                            )}
                            {overdue && (
                                <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,113,108,.12)", border: "1px solid rgba(255,113,108,.3)", borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#ff716c" }}>
                                    ⚠️ JATUH TEMPO
                                </div>
                            )}
                            {nearDue && !overdue && (
                                <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#f59e0b" }}>
                                    ⏰ HAMPIR JATUH TEMPO
                                </div>
                            )}

                            {/* Header kartu */}
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 14, background: p.color + "18", border: `1px solid ${p.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                                    {p.icon}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {p.borrower_name}
                                    </div>
                                    {p.due_date && (
                                        <div style={{ fontSize: 11, color: overdue ? "#ff716c" : "var(--color-muted)" }}>
                                            Jatuh tempo: {new Date(p.due_date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                        </div>
                                    )}
                                    {p.notes && (
                                        <div style={{ fontSize: 11, color: "var(--color-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            📝 {p.notes}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Progress */}
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: "var(--color-muted)" }}>Dikembalikan {pct}%</span>
                                <span style={{ fontSize: 12, color: lunas ? "var(--color-primary)" : p.color, fontWeight: 600 }}>
                                    {fmtRp(returned)} / {fmtRp(p.total)}
                                </span>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: "var(--color-border-soft)", marginBottom: 12 }}>
                                <div style={{ height: "100%", borderRadius: 4, background: lunas ? "var(--color-primary)" : p.color, width: `${pct}%`, transition: "width 1s" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 16 }}>
                                <span style={{ color: "var(--color-subtle)" }}>Dipinjamkan: {fmtRp(p.total)}</span>
                                <span style={{ color: lunas ? "var(--color-primary)" : "#f59e0b", fontWeight: 700 }}>
                                    Sisa: {fmtRp(p.remaining)}
                                </span>
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 8 }}>
                                {!lunas && (
                                    <button
                                        onClick={() => {
                                            setTerimaTarget(p);
                                            setTerimaAmount("");
                                            setTerimaAccount(accounts[0]?.name || "");
                                        }}
                                        style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#60fcc6,#19ce9b)", color: "#0a2e22", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                        💰 Terima Kembali
                                    </button>
                                )}
                                <button onClick={() => openEdit(p)}
                                    style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid var(--color-border)", background: "rgba(96,252,198,.06)", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                    ✏️ Edit
                                </button>
                                <button onClick={() => setConfirmDelete(p)}
                                    style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,113,108,.15)", background: "rgba(255,113,108,.06)", color: "#ff716c", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                                    🗑️
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Modal Tambah / Edit ── */}
            {showModal && (
                <div onClick={() => setShowModal(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: "var(--bg-deep)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 17, margin: 0 }}>
                                {editTarget ? "Edit Piutang" : "Catat Piutang"}
                            </h3>
                            <button onClick={() => setShowModal(false)}
                                style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {/* Preview */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: form.color + "20", border: `1px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                                {form.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
                                    {form.borrower_name || "Nama Peminjam"}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                                    Sisa: {form.remaining ? fmtRp(parseInt(form.remaining)) : "Rp 0"}
                                </div>
                            </div>
                        </div>

                        {/* Form fields */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>NAMA PEMINJAM</label>
                        <input
                            value={form.borrower_name}
                            onChange={e => setForm(p => ({ ...p, borrower_name: e.target.value }))}
                            placeholder="Contoh: Budi, Pak Anton, Adik..."
                            maxLength={50}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }}
                        />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>JUMLAH DIPINJAMKAN (Rp)</label>
                        <AmountInput value={form.total} onChange={v => setForm(p => ({ ...p, total: v }))} placeholder="500.000" inputStyle={{ marginBottom: 16 }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>SISA BELUM DIKEMBALIKAN (Rp)</label>
                        <AmountInput value={form.remaining} onChange={v => setForm(p => ({ ...p, remaining: v }))} placeholder="500.000" inputStyle={{ marginBottom: 16 }} />

                        {/* Akun sumber — hanya wajib saat tambah baru */}
                        {accounts.length > 0 && (
                            <>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                                    {editTarget ? "AKUN ASAL" : "POTONG DARI AKUN"}{" "}
                                    {editTarget && <span style={{ fontSize: 10, color: "var(--color-subtle)", fontWeight: 400 }}>— saldo tidak akan berubah saat edit</span>}
                                </label>
                                <select
                                    value={form.from_account}
                                    onChange={e => setForm(p => ({ ...p, from_account: e.target.value }))}
                                    style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }}>
                                    {accounts.map(a => (
                                        <option key={a.id} value={a.name}>{a.icon} {a.name} — {fmtRp(a.balance)}</option>
                                    ))}
                                </select>
                            </>
                        )}

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>JATUH TEMPO — Opsional</label>
                        <input
                            type="date"
                            value={form.due_date}
                            onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box", colorScheme: "normal" }}
                        />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>CATATAN — Opsional</label>
                        <input
                            value={form.notes}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Contoh: untuk uang makan, beli HP..."
                            maxLength={100}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }}
                        />

                        {/* Icon picker */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>IKON</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "rgba(96,252,198,.5)" : "var(--color-border-soft)"}`, background: form.icon === e ? "rgba(96,252,198,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        {/* Color picker */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>WARNA</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                            {COLOR_OPTIONS.map(c => (
                                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
                            ))}
                        </div>

                        <button onClick={handleSubmit} disabled={!canSubmit}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !canSubmit ? "var(--color-border-soft)" : "linear-gradient(135deg,#60fcc6,#19ce9b)", color: !canSubmit ? "var(--color-muted)" : "#0a2e22", fontWeight: 700, fontSize: 13, cursor: !canSubmit ? "not-allowed" : "pointer", opacity: !canSubmit ? .5 : 1, fontFamily: "inherit" }}>
                            {editTarget ? "Simpan Perubahan" : "Catat Piutang"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modal Terima Kembali ── */}
            {terimaTarget && (
                <div onClick={() => setTerimaTarget(null)}
                    style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: "var(--bg-deep)", border: "1px solid rgba(96,252,198,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400 }}>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <div>
                                <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 16, margin: 0 }}>💰 Terima Pembayaran</h3>
                                <p style={{ color: "var(--color-muted)", fontSize: 12, margin: "4px 0 0" }}>dari {terimaTarget.borrower_name}</p>
                            </div>
                            <button onClick={() => setTerimaTarget(null)}
                                style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        <div style={{ background: "rgba(96,252,198,.06)", border: "1px solid rgba(96,252,198,.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--color-muted)" }}>
                            Sisa piutang: <strong style={{ color: "var(--color-primary)" }}>{fmtRp(terimaTarget.remaining)}</strong>
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>JUMLAH DITERIMA (Rp)</label>
                        <AmountInput
                            value={terimaAmount}
                            onChange={v => setTerimaAmount(v)}
                            placeholder={String(terimaTarget.remaining)}
                            inputStyle={{ background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", fontSize: 14, fontWeight: 700, marginBottom: 16 }}
                        />

                        {accounts.length > 0 && (
                            <>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>MASUK KE AKUN</label>
                                <select
                                    value={terimaAccount}
                                    onChange={e => setTerimaAccount(e.target.value)}
                                    style={{ width: "100%", padding: "10px 14px", background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 20, boxSizing: "border-box" }}>
                                    {accounts.map(a => (
                                        <option key={a.id} value={a.name}>{a.icon} {a.name} — {fmtRp(a.balance)}</option>
                                    ))}
                                </select>
                            </>
                        )}

                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setTerimaTarget(null)}
                                style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                Batal
                            </button>
                            <button
                                disabled={!terimaAmount || parseInt(terimaAmount) <= 0}
                                onClick={() => {
                                    if (!terimaAmount || parseInt(terimaAmount) <= 0) return;
                                    onTerima && onTerima(terimaTarget, parseInt(terimaAmount), terimaAccount);
                                    setTerimaTarget(null);
                                    setTerimaAmount("");
                                }}
                                style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: !terimaAmount ? "var(--color-border-soft)" : "linear-gradient(135deg,#60fcc6,#19ce9b)", color: !terimaAmount ? "var(--color-muted)" : "#0a2e22", fontSize: 13, fontWeight: 700, cursor: !terimaAmount ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                                ✅ Catat Penerimaan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm Delete ── */}
            {confirmDelete && (
                <div onClick={() => setConfirmDelete(null)}
                    style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: "var(--bg-deep)", border: "1px solid rgba(255,113,108,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>Hapus Piutang?</h3>
                        <p style={{ color: "var(--color-subtle)", fontSize: 13, margin: "0 0 24px" }}>
                            Piutang ke <strong style={{ color: "#ff716c" }}>{confirmDelete.borrower_name}</strong> akan dihapus permanen.
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)}
                                style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                Batal
                            </button>
                            <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
                                style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PiutangView;
