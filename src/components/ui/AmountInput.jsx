/**
 * AmountInput — input Rupiah dengan format titik otomatis
 * Contoh: ketik 1500000 → tampil "1.500.000"
 * Nilai internal (value/onChange) tetap angka bersih tanpa titik.
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

    const baseStyle = {
        width: "100%",
        padding: "10px 14px",
        background: "var(--color-border-soft)",
        border: "1px solid var(--color-border-soft)",
        borderRadius: 10,
        color: "var(--color-text)",
        fontSize: 13,
        fontFamily: "inherit",
        outline: "none",
        boxSizing: "border-box",
        ...inputStyle,
    };

    const input = (
        <input
            type="text"
            inputMode="numeric"
            value={fmt(value)}
            onChange={handleChange}
            placeholder={placeholder}
            style={{ ...baseStyle, ...style }}
            {...rest}
        />
    );

    if (!label) return input;

    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 6, display: "block", letterSpacing: 0.5 }}>
                {label}
            </label>
            <div style={{ position: "relative" }}>
                {icon && (
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: 0.5 }}>
                        {icon}
                    </span>
                )}
                <input
                    type="text"
                    inputMode="numeric"
                    value={fmt(value)}
                    onChange={handleChange}
                    placeholder={placeholder}
                    style={{
                        width: "100%",
                        padding: "12px 16px 12px 40px",
                        borderRadius: 12,
                        border: "1px solid var(--color-border)",
                        background: "var(--bg-surface-low)",
                        color: "var(--color-text)",
                        fontSize: 16,
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                        ...style,
                    }}
                    onFocus={e => { e.target.style.borderColor = "var(--color-primary)"; e.target.style.boxShadow = "0 0 0 3px var(--nav-active-bg)"; }}
                    onBlur={e => { e.target.style.borderColor = "var(--color-border)"; e.target.style.boxShadow = "none"; }}
                    {...rest}
                />
            </div>
        </div>
    );
};

export default AmountInput;
