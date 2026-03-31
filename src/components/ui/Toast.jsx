const Toast = ({ message, show, type = "success" }) => {
    if (!show) return null;
    const styles = {
        success: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", text: "#34d399", icon: "✓" },
        info: { bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.3)", text: "#818cf8", icon: "ℹ" },
    };
    const c = styles[type] || styles.info;
    return (
        <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 10000,
            padding: "14px 20px", borderRadius: 14,
            background: c.bg, border: `1px solid ${c.border}`,
            backdropFilter: "blur(20px)",
            display: "flex", alignItems: "center", gap: 10,
            animation: "slideInRight 0.4s cubic-bezier(0.16,1,0.3,1)", maxWidth: 380,
        }}>
            <span style={{
                width: 26, height: 26, borderRadius: 8, background: c.border,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13, color: c.text,
            }}>{c.icon}</span>
            <span style={{ color: c.text, fontSize: 13, fontWeight: 500 }}>{message}</span>
        </div>
    );
};

export default Toast;
