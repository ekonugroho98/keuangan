const InputField = ({ label, type = "text", value, onChange, error, placeholder, icon }) => (
    <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block", letterSpacing: 0.5 }}>{label}</label>
        <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: 0.5 }}>{icon}</span>
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                style={{
                    width: "100%", padding: "12px 16px 12px 40px", borderRadius: 12,
                    border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
                    background: "rgba(255,255,255,0.04)", color: "#e2e8f0",
                    fontSize: 16, outline: "none", transition: "all 0.3s",
                    boxSizing: "border-box", fontFamily: "inherit",
                }}
                onFocus={e => { e.target.style.borderColor = "rgba(99,102,241,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                onBlur={e => { e.target.style.borderColor = error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
            />
        </div>
        {error && <span style={{ fontSize: 11, color: "#f87171", marginTop: 4, display: "block" }}>{error}</span>}
    </div>
);

export default InputField;
