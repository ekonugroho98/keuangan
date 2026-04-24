import Modal from "../ui/Modal";

const TYPES = [
    { v: "bank", l: "Bank", icon: "🏦", tint: "var(--color-primary)" },
    { v: "ewallet", l: "E-Wallet", icon: "📱", tint: "var(--color-transfer)" },
    { v: "cash", l: "Cash", icon: "💵", tint: "var(--color-amber)" },
    { v: "tabungan", l: "Tabungan", icon: "🪙", tint: "var(--color-purple)" },
    { v: "crypto", l: "Crypto", icon: "₿", tint: "var(--color-amber)" },
];

const fmtAmount = (raw) => {
    if (raw === "" || raw === null || raw === undefined) return "";
    const n = parseInt(String(raw).replace(/\D/g, ""), 10);
    if (isNaN(n)) return "";
    return n.toLocaleString("id-ID");
};

const AddAccountModal = ({ open, onClose, accForm, setAccForm, onSubmit }) => {
    const canSubmit = accForm.name && accForm.balance;

    return (
        <Modal open={open} onClose={onClose}>
            {({ isDesktop }) => (
                <div
                    style={{
                        background: "var(--glass-hero)",
                        backdropFilter: "var(--glass-blur)",
                        WebkitBackdropFilter: "var(--glass-blur)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: isDesktop ? 24 : "24px 24px 0 0",
                        padding: isDesktop ? "28px 28px 32px" : "24px 20px calc(32px + env(safe-area-inset-bottom))",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        boxShadow: "var(--glass-highlight), 0 20px 60px rgba(0,0,0,.35)",
                        position: "relative",
                    }}
                >
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 6 }}>
                                AKUN BARU
                            </div>
                            <h3 style={{ fontSize: "clamp(20px, 2.6vw, 26px)", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-.025em", margin: 0 }}>
                                Tambah Akun
                            </h3>
                            <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4, margin: "4px 0 0" }}>
                                Kartu rekening, dompet, atau kas
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            style={{
                                width: 36, height: 36, borderRadius: 12,
                                background: "var(--color-border-soft)",
                                border: "1px solid var(--glass-border)",
                                color: "var(--color-muted)",
                                cursor: "pointer", fontSize: 16, flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all .2s", fontFamily: "inherit",
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* NAMA */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8, display: "block", letterSpacing: 0.8 }}>
                            NAMA AKUN
                        </label>
                        <input
                            value={accForm.name}
                            onChange={e => setAccForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="contoh: BCA, GoPay, Cash"
                            style={{
                                width: "100%", padding: "14px 16px", fontSize: 15,
                                borderRadius: 14, border: "1px solid var(--glass-border)",
                                background: "rgba(255,255,255,.02)",
                                color: "var(--color-text)",
                                fontFamily: "inherit", outline: "none",
                                transition: "border-color .2s, background .2s, box-shadow .2s",
                                minHeight: 46, boxSizing: "border-box",
                            }}
                            onFocus={e => { e.target.style.borderColor = "color-mix(in srgb, var(--color-primary) 40%, transparent)"; e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent)"; }}
                            onBlur={e => { e.target.style.borderColor = "var(--glass-border)"; e.target.style.boxShadow = "none"; }}
                        />
                    </div>

                    {/* TIPE */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8, display: "block", letterSpacing: 0.8 }}>
                            TIPE AKUN
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 }}>
                            {TYPES.map(t => {
                                const active = accForm.type === t.v;
                                return (
                                    <button
                                        key={t.v}
                                        onClick={() => setAccForm(p => ({ ...p, type: t.v }))}
                                        style={{
                                            padding: "12px 8px",
                                            borderRadius: 14,
                                            border: `1px solid ${active ? `color-mix(in srgb, ${t.tint} 40%, transparent)` : "var(--glass-border)"}`,
                                            background: active
                                                ? `linear-gradient(135deg, color-mix(in srgb, ${t.tint} 16%, transparent), color-mix(in srgb, ${t.tint} 4%, transparent))`
                                                : "rgba(255,255,255,.02)",
                                            color: active ? t.tint : "var(--color-muted)",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            gap: 4,
                                            minHeight: 60,
                                            boxShadow: active ? `inset 0 0 0 1px color-mix(in srgb, ${t.tint} 20%, transparent)` : "none",
                                            transition: "all .2s",
                                        }}
                                    >
                                        <span style={{ fontSize: 18 }}>{t.icon}</span>
                                        <span>{t.l}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SALDO */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8, display: "block", letterSpacing: 0.8 }}>
                            SALDO AWAL
                        </label>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px 10px 10px",
                                borderRadius: 14,
                                border: "1px solid var(--glass-border)",
                                background: "rgba(255,255,255,.02)",
                                minHeight: 56,
                                transition: "border-color .2s, box-shadow .2s",
                            }}
                        >
                            <span
                                className="mono"
                                style={{
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
                                    color: "var(--color-primary)",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: 0.5,
                                    flexShrink: 0,
                                }}
                            >
                                Rp
                            </span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={fmtAmount(accForm.balance)}
                                onChange={e => setAccForm(p => ({ ...p, balance: e.target.value.replace(/\D/g, "") }))}
                                placeholder="0"
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    padding: 0,
                                    border: "none",
                                    background: "transparent",
                                    color: "var(--color-text)",
                                    fontSize: 20,
                                    fontWeight: 700,
                                    fontFamily: "inherit",
                                    outline: "none",
                                    fontVariantNumeric: "tabular-nums",
                                    letterSpacing: "-0.01em",
                                }}
                            />
                        </div>
                    </div>

                    {/* SUBMIT */}
                    <button
                        className="btn-primary"
                        onClick={onSubmit}
                        disabled={!canSubmit}
                        style={{
                            width: "100%",
                            minHeight: 48,
                            fontSize: 15,
                            opacity: canSubmit ? 1 : 0.45,
                            cursor: canSubmit ? "pointer" : "not-allowed",
                        }}
                    >
                        Simpan Akun
                    </button>
                </div>
            )}
        </Modal>
    );
};

export default AddAccountModal;
