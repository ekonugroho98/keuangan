import { useState } from "react";
import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";
import AmountInput from "../../ui/AmountInput";

const EMOJI_OPTIONS = ["🏠","🚗","✈️","📱","💻","🎓","💍","🏖️","💰","🏋️","🎮","📚","🌟","🏦","🎁","🚀","🛍️","🍕","☕","🌿","❤️","🔧","🏪","🎵","🐾","⚡","🎬","💊","🌍","🏆"];
const COLOR_OPTIONS = ["var(--color-primary)","var(--color-primary)","#4FC3F7","var(--color-primary)","#f59e0b","#ff716c","#ec4899","#14b8a6","#f97316","var(--color-subtle)","#a855f7","#22c55e"];

const emptyForm = () => ({ name: "", icon: "🏠", color: "var(--color-primary)", target: "", current: "", deadline: "" });

// Hitung sisa hari dari hari ini ke deadline
function getDaysLeft(deadline) {
    if (!deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dl = new Date(deadline);
    dl.setHours(0, 0, 0, 0);
    return Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
}

// Badge deadline berdasarkan sisa hari
function DeadlineBadge({ deadline, done }) {
    if (done || !deadline) return null;
    const days = getDaysLeft(deadline);
    if (days === null) return null;

    let text, color, bg, border;
    if (days < 0) {
        text  = `❌ Terlambat ${Math.abs(days)} hari`;
        color = "#ff716c"; bg = "rgba(255,113,108,.1)"; border = "rgba(255,113,108,.25)";
    } else if (days === 0) {
        text  = "⚠️ Hari ini!";
        color = "#f97316"; bg = "rgba(249,115,22,.1)"; border = "rgba(249,115,22,.25)";
    } else if (days <= 7) {
        text  = `⚠️ ${days} hari lagi!`;
        color = "#f97316"; bg = "rgba(249,115,22,.1)"; border = "rgba(249,115,22,.25)";
    } else if (days <= 30) {
        text  = `🗓️ ${days} hari lagi`;
        color = "#f59e0b"; bg = "rgba(245,158,11,.08)"; border = "rgba(245,158,11,.2)";
    } else {
        const months = Math.round(days / 30);
        text  = `🗓️ ~${months} bulan lagi`;
        color = "var(--color-muted)"; bg = "var(--bg-surface-low)"; border = "var(--color-border-soft)";
    }

    return (
        <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: "2px 8px", marginBottom: 10 }}>
            {text}
        </div>
    );
}

const GoalsView = ({ goals, accounts = [], onAdd, onEdit, onDelete, onTopup }) => {
    const { t } = useLanguage();
    const [showModal,    setShowModal]    = useState(false);
    const [editTarget,   setEditTarget]   = useState(null);
    const [form,         setForm]         = useState(emptyForm());
    const [confirmDelete, setConfirmDelete] = useState(null);

    // Topup state
    const [topupTarget,  setTopupTarget]  = useState(null);   // goal yg sedang di-topup
    const [topupAmount,  setTopupAmount]  = useState("");
    const [topupLoading, setTopupLoading] = useState(false);
    const [topupRecord,  setTopupRecord]  = useState(false);  // toggle "catat sebagai transaksi"
    const [topupAccount, setTopupAccount] = useState("");

    const openAdd = () => {
        setEditTarget(null);
        setForm(emptyForm());
        setShowModal(true);
    };

    const openEdit = (g) => {
        setEditTarget(g);
        setForm({ name: g.name, icon: g.icon, color: g.color, target: g.target, current: g.current, deadline: g.deadline || "" });
        setShowModal(true);
    };

    const handleSubmit = () => {
        if (!form.name.trim() || !form.target) return;
        const payload = {
            name:     form.name.trim(),
            icon:     form.icon,
            color:    form.color,
            target:   parseInt(form.target),
            current:  parseInt(form.current || 0),
            deadline: form.deadline || null,
        };
        if (editTarget) onEdit(editTarget.id, payload);
        else onAdd(payload);
        setShowModal(false);
    };

    const handleTopup = async () => {
        if (!topupAmount || parseInt(topupAmount) <= 0 || !topupTarget) return;
        if (topupRecord && !topupAccount) return; // akun wajib jika toggle aktif
        setTopupLoading(true);
        const amount      = parseInt(topupAmount);
        const accountName = topupRecord ? topupAccount : null;
        await onTopup(topupTarget.id, topupTarget, amount, accountName);
        setTopupTarget(null);
        setTopupAmount("");
        setTopupRecord(false);
        setTopupAccount("");
        setTopupLoading(false);
    };

    const canSubmit = form.name.trim() && form.target;

    return (
        <div style={{ animation: "fadeIn .4s" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>{t("goals.title")}</h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
                        {goals.length} target · {goals.filter(g => g.current >= g.target).length} {t("goals.achieved")}
                    </p>
                </div>
                <button
                    onClick={openAdd}
                    style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#60fcc6,#19ce9b)", color: "var(--color-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                    {t("goals.addNew")}
                </button>
            </div>

            {/* Empty state */}
            {goals.length === 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border-soft)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6 }}>{t("goals.noData")}</div>
                    <div style={{ fontSize: 13, color: "#48474f", marginBottom: 20 }}>{t("goals.noDataSub")}</div>
                    <button onClick={openAdd} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("goals.addFirst")}
                    </button>
                </div>
            )}

            {/* Goals grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {goals.map(g => {
                    const pct  = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                    const done = g.current >= g.target;
                    return (
                        <div key={g.id} style={{ background: "var(--bg-surface)", border: `1px solid ${done ? g.color + "44" : "var(--color-border-soft)"}`, borderRadius: 16, padding: 24, position: "relative" }}>
                            {/* Badge tercapai */}
                            {done && (
                                <div style={{ position: "absolute", top: 12, right: 12, background: g.color + "20", border: `1px solid ${g.color}44`, borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: g.color }}>
                                    {t("goals.achieved_badge")}
                                </div>
                            )}

                            {/* Header kartu */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 14, background: g.color + "18", border: `1px solid ${g.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                                        {g.icon}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>{g.name}</div>
                                        <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>{t("goals.target")}: {fmtRp(g.target)}</div>
                                    </div>
                                </div>
                                {!done && <div style={{ fontSize: 22, fontWeight: 800, color: g.color }}>{pct}%</div>}
                            </div>

                            {/* Deadline badge */}
                            <DeadlineBadge deadline={g.deadline} done={done} />

                            {/* Progress bar */}
                            <div style={{ height: 10, borderRadius: 5, background: "var(--color-border-soft)", marginBottom: 12 }}>
                                <div style={{ height: "100%", borderRadius: 5, background: `linear-gradient(135deg,${g.color},${g.color}88)`, width: `${pct}%`, transition: "width 1s" }} />
                            </div>

                            {/* Terkumpul & Kurang */}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 16 }}>
                                <span style={{ color: "var(--color-muted)" }}>{t("goals.collected")}: <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{fmtRp(g.current)}</span></span>
                                {!done && <span style={{ color: g.color, fontWeight: 600 }}>{t("goals.remaining")}: {fmtRp(g.target - g.current)}</span>}
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 8 }}>
                                {!done && (
                                    <button
                                        onClick={() => { setTopupTarget(g); setTopupAmount(""); setTopupRecord(false); setTopupAccount(accounts[0]?.name || ""); }}
                                        style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: g.color + "20", color: g.color, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                                    >
                                        💰 Tambah Dana
                                    </button>
                                )}
                                <button onClick={() => openEdit(g)} style={{ flex: done ? 1 : 0, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-border)", background: "rgba(96,252,198,.08)", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✏️</button>
                                <button onClick={() => setConfirmDelete(g)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,113,108,.15)", background: "rgba(255,113,108,.06)", color: "#ff716c", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Modal Topup Dana ── */}
            {topupTarget && (
                <div onClick={() => setTopupTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 380 }}>
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: topupTarget.color + "20", border: `1px solid ${topupTarget.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                                {topupTarget.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>💰 Tambah Dana</div>
                                <div style={{ fontSize: 12, color: "var(--color-subtle)" }}>{topupTarget.name}</div>
                            </div>
                            <button onClick={() => setTopupTarget(null)} style={{ marginLeft: "auto", background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 14 }}>✕</button>
                        </div>

                        {/* Progress mini */}
                        <div style={{ background: "var(--bg-surface-low)", borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                                <span style={{ color: "var(--color-subtle)" }}>Terkumpul</span>
                                <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{fmtRp(topupTarget.current)} / {fmtRp(topupTarget.target)}</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: "var(--color-border-soft)" }}>
                                <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(135deg,${topupTarget.color},${topupTarget.color}88)`, width: `${Math.min(100, Math.round((topupTarget.current / topupTarget.target) * 100))}%`, transition: "width .6s" }} />
                            </div>
                            <div style={{ fontSize: 11, color: topupTarget.color, fontWeight: 600, marginTop: 6 }}>
                                Kurang: {fmtRp(topupTarget.target - topupTarget.current)}
                            </div>
                        </div>

                        {/* Quick amount chips */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                            {[50000, 100000, 250000, 500000].map(v => (
                                <button key={v} onClick={() => setTopupAmount(String(v))}
                                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${topupAmount === String(v) ? topupTarget.color : "var(--color-border-soft)"}`, background: topupAmount === String(v) ? topupTarget.color + "18" : "transparent", color: topupAmount === String(v) ? topupTarget.color : "var(--color-subtle)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                    {fmtRp(v)}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>JUMLAH DITAMBAHKAN (Rp)</label>
                        <AmountInput value={topupAmount} onChange={v => setTopupAmount(v)} placeholder="100.000" inputStyle={{ marginBottom: 18 }} />

                        {/* Preview hasil */}
                        {topupAmount && parseInt(topupAmount) > 0 && (
                            <div style={{ background: topupTarget.color + "10", border: `1px solid ${topupTarget.color}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "var(--color-muted)" }}>Setelah ditambah</span>
                                    <span style={{ color: topupTarget.color, fontWeight: 700 }}>
                                        {fmtRp(topupTarget.current + parseInt(topupAmount))} / {fmtRp(topupTarget.target)}
                                    </span>
                                </div>
                                {topupTarget.current + parseInt(topupAmount) >= topupTarget.target && (
                                    <div style={{ color: topupTarget.color, fontWeight: 700, marginTop: 6, textAlign: "center", fontSize: 13 }}>
                                        🎉 Target tercapai!
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Toggle: catat sebagai transaksi */}
                        <div
                            onClick={() => setTopupRecord(p => !p)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: topupRecord ? "rgba(96,252,198,.06)" : "var(--bg-surface-low)", border: `1px solid ${topupRecord ? "rgba(96,252,198,.25)" : "var(--color-border-soft)"}`, borderRadius: 10, padding: "11px 14px", marginBottom: topupRecord ? 10 : 18, cursor: "pointer", transition: "all .15s" }}
                        >
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>Catat sebagai pengeluaran</div>
                                <div style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 2 }}>Kurangi saldo akun secara otomatis</div>
                            </div>
                            <div style={{ width: 36, height: 20, borderRadius: 10, background: topupRecord ? "var(--color-primary)" : "var(--color-border-soft)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                                <div style={{ position: "absolute", top: 2, left: topupRecord ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
                            </div>
                        </div>

                        {/* Account selector — muncul jika toggle aktif */}
                        {topupRecord && (
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>DARI AKUN</label>
                                {accounts.length === 0 ? (
                                    <div style={{ fontSize: 12, color: "#f59e0b", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 8, padding: "8px 12px" }}>
                                        ⚠️ Belum ada akun — tambah akun terlebih dahulu
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {accounts.map(acc => (
                                            <button
                                                key={acc.id}
                                                onClick={() => setTopupAccount(acc.name)}
                                                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${topupAccount === acc.name ? topupTarget.color : "var(--color-border-soft)"}`, background: topupAccount === acc.name ? topupTarget.color + "18" : "transparent", color: topupAccount === acc.name ? topupTarget.color : "var(--color-subtle)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                                            >
                                                {acc.name}
                                                <span style={{ marginLeft: 5, fontSize: 10, opacity: .7 }}>Rp {acc.balance?.toLocaleString("id-ID")}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={handleTopup}
                            disabled={!topupAmount || parseInt(topupAmount) <= 0 || topupLoading || (topupRecord && !topupAccount)}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: (!topupAmount || parseInt(topupAmount) <= 0 || (topupRecord && !topupAccount)) ? "var(--color-border-soft)" : `linear-gradient(135deg,${topupTarget.color},${topupTarget.color}cc)`, color: (!topupAmount || parseInt(topupAmount) <= 0 || (topupRecord && !topupAccount)) ? "var(--color-muted)" : "#fff", fontWeight: 700, fontSize: 13, cursor: (!topupAmount || parseInt(topupAmount) <= 0 || (topupRecord && !topupAccount)) ? "not-allowed" : "pointer", opacity: topupLoading ? .7 : 1, fontFamily: "inherit" }}
                        >
                            {topupLoading ? "⏳ Menyimpan..." : "💰 Tambah Dana"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modal Tambah/Edit ── */}
            {showModal && (
                <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 17, margin: 0 }}>{editTarget ? t("goals.editTitle") : t("goals.addTitle")}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {/* Preview */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: form.color + "20", border: `1px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{form.icon}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{form.name || "Nama Target"}</div>
                                <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>Target: {form.target ? fmtRp(parseInt(form.target)) : "Rp 0"}</div>
                            </div>
                        </div>

                        {/* Nama */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("goals.nameLabel")}</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Beli Rumah, Dana Darurat..." maxLength={40}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        {/* Jumlah target */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("goals.targetLabel")}</label>
                        <AmountInput value={form.target} onChange={v => setForm(p => ({ ...p, target: v }))} placeholder="5.000.000" inputStyle={{ marginBottom: 16 }} />

                        {/* Dana terkumpul */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("goals.currentLabel")}</label>
                        <AmountInput value={form.current} onChange={v => setForm(p => ({ ...p, current: v }))} placeholder="0" inputStyle={{ marginBottom: 16 }} />

                        {/* Target Date */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                            🗓️ TANGGAL TARGET <span style={{ fontWeight: 400, color: "var(--color-subtle)" }}>(opsional)</span>
                        </label>
                        <input
                            type="date"
                            value={form.deadline}
                            onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                            min={new Date().toISOString().slice(0, 10)}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 10, color: form.deadline ? "var(--color-text)" : "var(--color-subtle)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: form.deadline ? 8 : 16, boxSizing: "border-box", colorScheme: "dark" }}
                        />
                        {form.deadline && (() => {
                            const days = getDaysLeft(form.deadline);
                            if (days === null) return null;
                            const months = Math.round(days / 30);
                            const label  = days <= 0 ? "⚠️ Tanggal sudah lewat" : days <= 30 ? `🗓️ ${days} hari lagi` : `🗓️ ~${months} bulan lagi`;
                            const color  = days <= 0 ? "#ff716c" : days <= 7 ? "#f97316" : "#f59e0b";
                            return <div style={{ fontSize: 11, color, marginBottom: 16, fontWeight: 600 }}>{label}</div>;
                        })()}

                        {/* Icon */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>ICON</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "#60fcc655" : "var(--color-border-soft)"}`, background: form.icon === e ? "rgba(96,252,198,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        {/* Warna */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>WARNA</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                            {COLOR_OPTIONS.map(c => (
                                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
                            ))}
                        </div>

                        <button onClick={handleSubmit} disabled={!canSubmit}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !canSubmit ? "var(--color-border-soft)" : "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, fontSize: 13, cursor: !canSubmit ? "not-allowed" : "pointer", opacity: !canSubmit ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("common.saveChanges") : t("goals.submitAdd")}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            {confirmDelete && (
                <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid rgba(255,113,108,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("goals.deleteConfirm")}</h3>
                        <p style={{ color: "var(--color-subtle)", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "#ff716c" }}>{confirmDelete.name}</strong> — {t("goals.deleteMsg")}
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
                            <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "var(--color-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("common.delete")}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoalsView;
