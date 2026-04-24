/**
 * AmountInput — input Rupiah dengan format titik otomatis.
 * Contoh: ketik 1500000 → tampil "1.500.000"
 * Nilai internal (value/onChange) tetap angka bersih tanpa titik.
 *
 * Prop signature preserved: { value, onChange, placeholder, style, label, icon, inputStyle, ...rest }
 */
const AmountInput = ({
    value,
    onChange,
    placeholder = "0",
    style = {},
    label,
    icon,
    inputStyle = {},
    ...rest
}) => {
    const fmt = (raw) => {
        if (raw === "" || raw === null || raw === undefined) return "";
        const n = parseInt(String(raw).replace(/\D/g, ""), 10);
        if (isNaN(n)) return "";
        return n.toLocaleString("id-ID");
    };

    const handleChange = (e) => {
        const raw = e.target.value.replace(/\D/g, "");
        onChange(raw);
    };

    // Glass surface shared focus/blur behaviour
    const applyFocus = (e) => {
        e.target.style.borderColor = "var(--color-primary)";
        e.target.style.background = "rgba(96,252,198,.04)";
        e.target.style.boxShadow = "0 0 0 3px var(--nav-active-bg, rgba(96,252,198,.12))";
    };
    const applyBlur = (e) => {
        e.target.style.borderColor = "var(--glass-border)";
        e.target.style.background = "rgba(255,255,255,.02)";
        e.target.style.boxShadow = "none";
    };

    // Compact variant — used inline in modals/forms when no label is provided
    const baseStyle = {
        width: "100%",
        padding: "14px 16px",
        fontSize: 15,
        borderRadius: 14,
        border: "1px solid var(--glass-border)",
        background: "rgba(255,255,255,.02)",
        color: "var(--color-text)",
        fontFamily: "inherit",
        outline: "none",
        minHeight: 46,
        boxSizing: "border-box",
        transition: "border-color .2s, background .2s, box-shadow .2s",
        ...inputStyle,
    };

    if (!label) {
        return (
            <input
                type="text"
                inputMode="numeric"
                value={fmt(value)}
                onChange={handleChange}
                placeholder={placeholder}
                onFocus={applyFocus}
                onBlur={applyBlur}
                style={{ ...baseStyle, ...style }}
                {...rest}
            />
        );
    }

    return (
        <div style={{ marginBottom: 16 }}>
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
                    type="text"
                    inputMode="numeric"
                    value={fmt(value)}
                    onChange={handleChange}
                    placeholder={placeholder}
                    onFocus={applyFocus}
                    onBlur={applyBlur}
                    style={{
                        ...baseStyle,
                        padding: icon ? "14px 16px 14px 40px" : "14px 16px",
                        ...style,
                    }}
                    {...rest}
                />
            </div>
        </div>
    );
};

export default AmountInput;
