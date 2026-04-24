import Modal from "../ui/Modal";

const METRICS = [
    { label: "Income", value: "Rp 10,5jt", color: "var(--color-primary)", icon: "↑", chip: "chip-mint" },
    { label: "Expense", value: "Rp 2,8jt", color: "var(--color-expense)", icon: "↓", chip: "chip-red" },
    { label: "Goals", value: "3 aktif", color: "var(--color-transfer)", icon: "◎", chip: "chip-blue" },
];

const FEATURES = [
    { icon: "📊", label: "Analitik cerdas" },
    { icon: "🎯", label: "Target tabungan" },
    { icon: "🔔", label: "Reminder tagihan" },
    { icon: "🔒", label: "Data terenkripsi" },
];

const DemoModal = ({ open, onClose, onSignup }) => (
    <Modal open={open} onClose={onClose}>
        {({ isDesktop }) => (
            <div style={{
                background: "var(--glass-hero)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                border: "1px solid var(--glass-border)",
                borderRadius: isDesktop ? 28 : "28px 28px 0 0",
                padding: isDesktop ? "32px 32px 28px" : "24px 20px calc(28px + env(safe-area-inset-bottom))",
                maxHeight: "92vh", overflowY: "auto",
                boxShadow: "var(--glass-highlight), 0 32px 80px rgba(0,0,0,.45)",
                position: "relative", overflow: "hidden",
            }}>
                {/* Ambient aurora orbs */}
                <div style={{ position: "absolute", top: -120, left: -70, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,252,198,.22), transparent 70%)", pointerEvents: "none", filter: "blur(14px)" }} />
                <div style={{ position: "absolute", bottom: -140, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,.16), transparent 70%)", pointerEvents: "none", filter: "blur(14px)" }} />

                {/* Close */}
                <button
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        position: "absolute", top: 16, right: 16, zIndex: 3,
                        background: "rgba(255,255,255,.06)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--color-muted)",
                        width: 34, height: 34, borderRadius: 12,
                        cursor: "pointer", fontSize: 16,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                >✕</button>

                <div style={{ position: "relative", zIndex: 1 }}>
                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: 20 }}>
                        <div className="chip chip-mint" style={{ display: "inline-flex", marginBottom: 12 }}>
                            <span>◉</span> LIVE PREVIEW
                        </div>
                        <h2 style={{
                            fontSize: "clamp(22px, 3vw, 28px)",
                            fontWeight: 900,
                            color: "var(--color-text)",
                            letterSpacing: "-.03em",
                            margin: 0,
                        }}>
                            Intip <span className="gradient-text">dashboard</span> dulu
                        </h2>
                        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 6 }}>
                            Ini contoh tampilan yang bakal lu lihat tiap hari ✨
                        </p>
                    </div>

                    {/* Glass frame for preview */}
                    <div className="bento-glow" style={{
                        borderRadius: 20, padding: 2, marginBottom: 16,
                    }}>
                        <div style={{
                            background: "var(--bg-surface)",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            borderRadius: 18,
                            padding: 18,
                            border: "1px solid var(--glass-border)",
                        }}>
                            {/* Top row — tiny window chrome */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-expense)" }} />
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-amber)" }} />
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary)" }} />
                                <span className="eyebrow" style={{ marginLeft: "auto", fontSize: 9, color: "var(--color-subtle)" }}>
                                    DASBOR · APRIL
                                </span>
                            </div>

                            {/* Total balance */}
                            <div style={{
                                fontSize: 10,
                                color: "var(--color-subtle)",
                                fontWeight: 700,
                                letterSpacing: 1.4,
                                textTransform: "uppercase",
                            }}>Total Balance</div>
                            <div className="num-tight" style={{
                                fontSize: "clamp(26px, 4vw, 32px)",
                                fontWeight: 900,
                                color: "var(--color-text)",
                                letterSpacing: "-.02em",
                                marginTop: 2,
                            }}>Rp 9.270.000</div>
                            <div className="chip chip-mint" style={{ display: "inline-flex", marginTop: 6, marginBottom: 16 }}>
                                <span>↑</span> Saving rate 27%
                            </div>

                            {/* Metrics grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                                {METRICS.map((m, i) => (
                                    <div key={i} style={{
                                        background: "var(--bg-surface-low)",
                                        borderRadius: 12,
                                        padding: "10px 8px",
                                        border: "1px solid var(--glass-border)",
                                        textAlign: "center",
                                    }}>
                                        <div style={{
                                            fontSize: 10,
                                            color: "var(--color-subtle)",
                                            fontWeight: 700,
                                            letterSpacing: 1,
                                            textTransform: "uppercase",
                                            marginBottom: 4,
                                        }}>{m.label}</div>
                                        <div className="num-tight" style={{
                                            fontSize: 13,
                                            fontWeight: 800,
                                            color: m.color,
                                        }}>
                                            <span style={{ marginRight: 3 }}>{m.icon}</span>{m.value}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Mini chart bars */}
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 52, marginTop: 14, padding: "0 2px" }}>
                                {[40, 65, 52, 78, 60, 85, 70].map((h, i) => (
                                    <div key={i} style={{
                                        flex: 1,
                                        height: `${h}%`,
                                        borderRadius: 4,
                                        background: i === 5
                                            ? "linear-gradient(180deg, var(--color-primary), var(--color-primary-deep))"
                                            : "rgba(96,252,198,.22)",
                                        boxShadow: i === 5 ? "0 0 12px rgba(96,252,198,.4)" : "none",
                                    }} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Feature chips */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 20 }}>
                        {FEATURES.map((f, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "10px 12px",
                                background: "var(--bg-surface)",
                                border: "1px solid var(--glass-border)",
                                borderRadius: 12,
                            }}>
                                <span style={{ fontSize: 16 }}>{f.icon}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>{f.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* CTA row */}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            className="btn-secondary"
                            onClick={onClose}
                            style={{ flex: 1, minHeight: 48, fontSize: 14 }}
                        >Tutup</button>
                        <button
                            className="btn-primary"
                            onClick={() => { onClose(); onSignup(); }}
                            style={{ flex: 2, minHeight: 48, fontSize: 14 }}
                        >Mulai gratis →</button>
                    </div>

                    <p style={{
                        textAlign: "center", marginTop: 12,
                        fontSize: 11, color: "var(--color-subtle)",
                    }}>
                        Gratis selamanya · tanpa kartu kredit · data lu aman
                    </p>
                </div>
            </div>
        )}
    </Modal>
);

export default DemoModal;
