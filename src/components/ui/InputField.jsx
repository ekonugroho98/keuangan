const InputField = ({ label, type = "text", value, onChange, error, placeholder, icon }) => (
    <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block", letterSpacing: 0.5 }}>{label}</label>
        <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: 0.5 }}>{icon}</span>
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                style={{
                    width: "100%", padding: "12px 16px 12px 40px", borderRadius: 12,
                    border: `1px solid ${error ? "rgba(255,113,108,0.5)" : "var(--color-border)"}`,
                    background: "var(--bg-surface-low)", color: "var(--color-text)",
                    fontSize: 16, outline: "none", transition: "all 0.3s",
                    boxSizing: "border-box", fontFamily: "inherit",
                }}
                onFocus={e => { e.target.style.borderColor = "var(--color-primary)"; e.target.style.boxShadow = "0 0 0 3px var(--nav-active-bg)"; }}
                onBlur={e => { e.target.style.borderColor = error ? "rgba(255,113,108,0.5)" : "var(--color-border)"; e.target.style.boxShadow = "none"; }}
            />
        </div>
        {error && <span style={{ fontSize: 11, color: "#ff716c", marginTop: 4, display: "block" }}>{error}</span>}
    </div>
);

export default InputField;
