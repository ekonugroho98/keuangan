import { useState, useMemo } from "react";
import { fmtRp } from "../../../utils/formatters";
import { categoryIcons, categoryColors } from "../../../constants/categories";
import { useLanguage } from "../../../i18n/LanguageContext";

const EMOJI_OPTIONS = ["📦","🍔","🚗","🏠","🎬","🛍️","⚡","💊","📚","❤️","💰","💼","📊","📈","🔄","✈️","🎮","🐾","🌿","☕","🍕","🏋️","💇","🎵","📱","🖥️","🏦","🎁","🚀","🌟","🔧","🏪"];
const COLOR_OPTIONS = ["var(--color-primary)","var(--color-primary)","#4FC3F7","#a78bfa","#f59e0b","#ff716c","#ec4899","#14b8a6","#f97316","var(--color-subtle)","#a855f7","#22c55e"];

/* ─── sub-components ─── */
const SummaryCard = ({ label, value, sub, borderColor, valueStyle }) => (
    <div style={{ background: "var(--bg-surface)", borderRadius: 14, padding: "18px 20px", borderLeft: `4px solid ${borderColor}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</p>
        <h3 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 3px", lineHeight: 1, ...valueStyle }}>{value}</h3>
        <p style={{ fontSize: 10, color: "var(--color-muted)", margin: 0 }}>{sub}</p>
    </div>
);

/* ─── main ─── */
const KategoriView = ({ catTotals, customCategories, onAddCategory, onEditCategory, onDeleteCategory }) => {
    const { t } = useLanguage();

    /* Terjemahkan nama kategori default; custom tetap pakai nama aslinya */
    const tCat = (name, isDefault) => { if (!isDefault) return name; const k = "cat.name." + name; const v = t(k); return v === k ? name : v; };

    const [showModal,     setShowModal]     = useState(false);
    const [editTarget,    setEditTarget]    = useState(null);
    const [form,          setForm]          = useState({ name: "", icon: "📦", type: "expense", color: "var(--color-primary)" });
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [filterType,    setFilterType]    = useState("all");  // all | expense | income
    const [search,        setSearch]        = useState("");
    const [hoveredId,     setHoveredId]     = useState(null);

    /* ── build category list ── */
    const defaultCats = Object.entries(categoryIcons).map(([name, icon]) => ({
        id: null, name, icon,
        color: categoryColors[name] || "var(--color-subtle)",
        isDefault: true,
    }));
    const allCats = [
        ...defaultCats,
        ...(customCategories || []).map(c => ({ ...c, isDefault: false })),
    ];

    const INCOME_DEFAULTS = ["Gaji","Freelance","Bisnis","Investasi","Transfer"];
    const expenseCats = allCats.filter(c => c.isDefault ? !INCOME_DEFAULTS.includes(c.name) : c.type !== "income");
    const incomeCats  = allCats.filter(c => c.isDefault ? INCOME_DEFAULTS.includes(c.name)  : c.type !== "expense");

    /* ── totals for summary ── */
    const totalExpenseAmt = expenseCats.reduce((s, c) => s + (catTotals[c.name] || 0), 0);
    const totalIncomeAmt  = incomeCats.reduce((s, c)  => s + (catTotals[c.name] || 0), 0);

    /* ── filtered display list ── */
    const displayCats = useMemo(() => {
        let list = filterType === "expense" ? expenseCats
                 : filterType === "income"  ? incomeCats
                 : allCats;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                tCat(c.name, c.isDefault).toLowerCase().includes(q)
            );
        }
        // sort: by amount desc, then alphabetical
        return [...list].sort((a, b) => (catTotals[b.name] || 0) - (catTotals[a.name] || 0));
    }, [filterType, search, allCats, catTotals]);

    const totalRef = filterType === "income" ? totalIncomeAmt : totalExpenseAmt;

    /* ── modal handlers ── */
    const openAdd  = () => { setEditTarget(null); setForm({ name: "", icon: "📦", type: "expense", color: "var(--color-primary)" }); setShowModal(true); };
    const openEdit = (cat) => { setEditTarget(cat); setForm({ name: cat.name, icon: cat.icon, type: cat.type, color: cat.color }); setShowModal(true); };
    const handleSubmit = () => {
        if (!form.name.trim()) return;
        editTarget ? onEditCategory(editTarget.id, form) : onAddCategory(form);
        setShowModal(false);
    };

    const TYPE_TABS = [
        { id: "all",     label: t("tx.all") || "Semua",       count: allCats.length     },
        { id: "expense", label: t("cat.expense") || "Pengeluaran", count: expenseCats.length },
        { id: "income",  label: t("cat.income") || "Pemasukan",   count: incomeCats.length  },
    ];

    return (
        <div style={{ animation: "fadeIn .4s", display: "flex", flexDirection: "column", gap: 22 }}>

            {/* ── Confirm Delete ── */}
            {confirmDelete && (
                <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid rgba(255,113,108,.2)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>{confirmDelete.icon}</div>
                        <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>{t("cat.deleteConfirm")}</h3>
                        <p style={{ color: "var(--color-subtle)", fontSize: 13, margin: "0 0 24px" }}>
                            <strong style={{ color: "#ff716c" }}>{confirmDelete.name}</strong> — {t("cat.deleteMsg")}
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--color-border-soft)", background: "transparent", color: "var(--color-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
                            <button onClick={() => { onDeleteCategory(confirmDelete.id); setConfirmDelete(null); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff716c,#e04f4f)", color: "var(--color-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("common.delete")}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add/Edit Modal ── */}
            {showModal && (
                <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-deep)", border: "1px solid var(--color-border-soft)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                            <h3 style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 17, margin: 0 }}>
                                {editTarget ? t("cat.editTitle") : t("cat.addTitle")}
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "var(--color-border-soft)", border: "none", color: "var(--color-muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>

                        {/* Preview */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-surface-low)", border: "1px solid var(--color-border-soft)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: form.color + "20", border: `1px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{form.icon}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{form.name || t("cat.namePlaceholder")}</div>
                                <div style={{ fontSize: 11, color: "var(--color-subtle)" }}>{form.type === "expense" ? t("cat.expense") : form.type === "income" ? t("cat.income") : t("cat.typeBoth")}</div>
                            </div>
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>{t("cat.nameLabel")}</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t("cat.namePlaceholder")} maxLength={30}
                            style={{ width: "100%", padding: "10px 14px", background: "var(--color-border-soft)", border: "1px solid var(--color-border-soft)", borderRadius: 10, color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("cat.typeLabel")}</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            {[{ v: "expense", l: t("cat.expense"), c: "#ff716c" }, { v: "income", l: t("cat.income"), c: "var(--color-primary)" }, { v: "both", l: t("cat.typeBoth"), c: "#a78bfa" }].map(tp => (
                                <button key={tp.v} onClick={() => setForm(p => ({ ...p, type: tp.v }))}
                                    style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${form.type === tp.v ? tp.c + "55" : "var(--color-border-soft)"}`, background: form.type === tp.v ? tp.c + "15" : "transparent", color: form.type === tp.v ? tp.c : "var(--color-subtle)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                    {tp.l}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("cat.iconLabel")}</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {EMOJI_OPTIONS.map(e => (
                                <button key={e} onClick={() => setForm(p => ({ ...p, icon: e }))}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === e ? "#60fcc655" : "var(--color-border-soft)"}`, background: form.icon === e ? "rgba(96,252,198,.15)" : "transparent", fontSize: 18, cursor: "pointer" }}>
                                    {e}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 8 }}>{t("cat.colorLabel")}</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                            {COLOR_OPTIONS.map(c => (
                                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
                            ))}
                        </div>

                        <button onClick={handleSubmit} disabled={!form.name.trim()}
                            style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: !form.name.trim() ? "var(--color-border-soft)" : "var(--color-primary)", color: !form.name.trim() ? "#94a3b8" : "var(--color-on-primary)", fontWeight: 700, fontSize: 13, cursor: !form.name.trim() ? "not-allowed" : "pointer", opacity: !form.name.trim() ? .4 : 1, fontFamily: "inherit" }}>
                            {editTarget ? t("cat.submitEdit") : t("cat.submitAdd")}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Page Header ── */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
                        {t("cat.title")}
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
                        {t("cat.subtitle") || "Atur kategori pengeluaran dan pemasukan Anda."}
                    </p>
                </div>
                <button onClick={openAdd} style={{ padding: "10px 20px", borderRadius: 9999, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, transition: "opacity .2s" }}
                    onMouseOver={e => e.currentTarget.style.opacity = ".85"}
                    onMouseOut={e => e.currentTarget.style.opacity = "1"}>
                    + {t("cat.addNew")?.replace("+ ", "") || "Kategori Baru"}
                </button>
            </div>

            {/* ── Summary Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                <SummaryCard label={t("cat.totalCats") || "Total Kategori"} value={allCats.length} sub={`${(customCategories||[]).length} ${t("cat.custom") || "kustom"}`} borderColor="var(--color-primary)" valueStyle={{ color: "var(--color-primary)" }} />
                <SummaryCard label={t("cat.expense") || "Pengeluaran"} value={expenseCats.length} sub={fmtRp(totalExpenseAmt)} borderColor="#ff716c" valueStyle={{ color: "#ff716c" }} />
                <SummaryCard label={t("cat.income") || "Pemasukan"} value={incomeCats.length} sub={fmtRp(totalIncomeAmt)} borderColor="#a78bfa" valueStyle={{ color: "#a78bfa" }} />
            </div>

            {/* ── Filter Bar ── */}
            <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(20px)", border: "1px solid rgba(72,71,79,.15)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                {/* Type tabs */}
                <div style={{ display: "flex", background: "var(--bg-surface-low)", borderRadius: 10, padding: 4, gap: 2 }}>
                    {TYPE_TABS.map(tab => {
                        const isActive = filterType === tab.id;
                        return (
                            <button key={tab.id} onClick={() => setFilterType(tab.id)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: isActive ? "var(--color-primary)" : "transparent", color: isActive ? "var(--color-on-primary)" : "var(--color-muted)", fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                                {tab.label}
                                <span style={{ fontSize: 10, background: isActive ? "rgba(0,94,68,.2)" : "rgba(255,255,255,.07)", borderRadius: 99, padding: "1px 6px", fontWeight: 700 }}>{tab.count}</span>
                            </button>
                        );
                    })}
                </div>
                {/* Search */}
                <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: .4, pointerEvents: "none" }}>🔍</span>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("cat.search") || "Cari kategori..."}
                        style={{ background: "var(--bg-surface-low)", border: "1px solid var(--color-border)", borderRadius: 9, color: "var(--color-text)", fontSize: 12, fontFamily: "inherit", padding: "8px 12px 8px 28px", outline: "none", width: 180 }} />
                </div>
            </div>

            {/* ── Category Grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                {displayCats.map((c) => {
                    const amt      = catTotals[c.name] || 0;
                    const total    = filterType === "income" ? totalIncomeAmt : totalExpenseAmt;
                    const pct      = total > 0 ? Math.min((amt / total) * 100, 100) : 0;
                    const color    = c.color || "var(--color-subtle)";
                    const isHov    = hoveredId === (c.id || c.name);
                    const isCustom = !c.isDefault;

                    return (
                        <div key={c.id || c.name}
                            onMouseEnter={() => setHoveredId(c.id || c.name)}
                            onMouseLeave={() => setHoveredId(null)}
                            style={{
                                background: "var(--bg-surface)",
                                border: `1px solid ${isHov ? color + "45" : "var(--color-border-soft)"}`,
                                borderRadius: 16, padding: "18px 18px 14px",
                                display: "flex", flexDirection: "column", gap: 10,
                                transition: "border-color .2s, box-shadow .2s, transform .2s",
                                transform: isHov ? "translateY(-2px)" : "translateY(0)",
                                boxShadow: isHov ? `0 8px 28px ${color}18` : "none",
                                position: "relative",
                            }}
                        >
                            {/* Top: icon + badges */}
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                                <div style={{ width: 48, height: 48, borderRadius: 14, background: color + "18", border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                                    {c.icon}
                                </div>
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                    {isCustom && isHov && (
                                        <>
                                            <button onClick={() => openEdit(c)} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(96,252,198,.12)", color: "var(--color-primary)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✏️</button>
                                            <button onClick={() => setConfirmDelete(c)} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(255,113,108,.1)", color: "#ff716c", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🗑️</button>
                                        </>
                                    )}
                                    {isCustom && !isHov && (
                                        <span style={{ fontSize: 8, fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,.12)", padding: "2px 6px", borderRadius: 4, letterSpacing: 0.8 }}>KUSTOM</span>
                                    )}
                                    {!isCustom && (
                                        <span style={{ fontSize: 8, fontWeight: 700, color: "#48474f", background: "var(--color-border-soft)", padding: "2px 6px", borderRadius: 4, letterSpacing: 0.8 }}>DEFAULT</span>
                                    )}
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tCat(c.name, c.isDefault)}</div>
                                <div style={{ fontSize: 11, color: amt > 0 ? color : "#48474f", marginTop: 2, fontWeight: amt > 0 ? 600 : 400 }}>
                                    {amt > 0 ? fmtRp(amt) : t("cat.noTx") || "Belum ada transaksi"}
                                </div>
                            </div>

                            {/* Progress bar */}
                            {amt > 0 && (
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                        <span style={{ fontSize: 9, color: "var(--color-muted)" }}>{t("cat.ofTotal") || "dari total"}</span>
                                        <span style={{ fontSize: 9, fontWeight: 700, color }}>
                                            {filterType === "all"
                                                ? (totalExpenseAmt + totalIncomeAmt) > 0
                                                    ? Math.round((amt / (totalExpenseAmt + totalIncomeAmt)) * 100) + "%"
                                                    : "0%"
                                                : Math.round(pct) + "%"
                                            }
                                        </span>
                                    </div>
                                    <div style={{ height: 4, borderRadius: 99, background: "var(--color-border-soft)" }}>
                                        <div style={{
                                            height: "100%", borderRadius: 99,
                                            background: color,
                                            width: filterType === "all"
                                                ? (totalExpenseAmt + totalIncomeAmt) > 0
                                                    ? `${Math.min((amt / (totalExpenseAmt + totalIncomeAmt)) * 100, 100)}%`
                                                    : "0%"
                                                : `${pct}%`,
                                            transition: "width .8s",
                                        }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* ── Add Category Card ── */}
                <div onClick={openAdd}
                    style={{ minHeight: 160, borderRadius: 16, border: "2px dashed rgba(96,252,198,.2)", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 8, transition: "border-color .2s, background .2s" }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(96,252,198,.45)"; e.currentTarget.style.background = "rgba(96,252,198,.03)"; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(96,252,198,.2)"; e.currentTarget.style.background = "transparent"; }}
                >
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(96,252,198,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "var(--color-primary)" }}>+</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>{t("cat.addNew") || "+ Kategori Baru"}</span>
                </div>
            </div>

            {/* ── Empty state ── */}
            {displayCats.length === 0 && search && (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#475569" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                    <p style={{ fontSize: 13, color: "var(--color-muted)" }}>Tidak ada kategori yang cocok dengan "<strong>{search}</strong>"</p>
                </div>
            )}
        </div>
    );
};

export default KategoriView;
