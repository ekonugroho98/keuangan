/**
 * InputField — glass-surface text input with optional label + leading icon.
 * Prop signature preserved: { label, type, value, onChange, error, placeholder, icon, ...rest }
 */
const InputField = ({ label, type = "text", value, onChange, error, placeholder, icon, ...rest }) => (
    <div style={{ marginBottom: 16 }}>
        {label && (
            <label
                style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--color-subtle)",
                    textTransform: "uppercase",
                    letterSpacing: 1.6,
                    marginBottom: 8,
                    display: "block",
                }}
            >
                {label}
            </label>
        )}
        <div style={{ position: "relative" }}>
            {icon && (
                <span
                    style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 15,
                        opacity: 0.6,
                        pointerEvents: "none",
                    }}
                >
                    {icon}
                </span>
            )}
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                {...rest}
                style={{
                    width: "100%",
                    padding: icon ? "14px 16px 14px 40px" : "14px 16px",
                    fontSize: 15,
                    borderRadius: 14,
                    border: `1px solid ${error ? "rgba(255,113,108,.5)" : "var(--glass-border)"}`,
                    background: "rgba(255,255,255,.02)",
                    color: "var(--color-text)",
                    fontFamily: "inherit",
                    outline: "none",
                    minHeight: 46,
                    boxSizing: "border-box",
                    transition: "border-color .2s, background .2s, box-shadow .2s",
                }}
                onFocus={e => {
                    e.target.style.borderColor = "var(--color-primary)";
                    e.target.style.background = "rgba(96,252,198,.04)";
                    e.target.style.boxShadow = "0 0 0 3px var(--nav-active-bg, rgba(96,252,198,.12))";
                }}
                onBlur={e => {
                    e.target.style.borderColor = error ? "rgba(255,113,108,.5)" : "var(--glass-border)";
                    e.target.style.background = "rgba(255,255,255,.02)";
                    e.target.style.boxShadow = "none";
                }}
            />
        </div>
        {error && (
            <span
                style={{
                    fontSize: 11,
                    color: "#ff716c",
                    marginTop: 6,
                    display: "block",
                    fontWeight: 500,
                }}
            >
                {error}
            </span>
        )}
    </div>
);

export default InputField;
