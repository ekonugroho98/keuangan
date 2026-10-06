import { useState } from "react";

/**
 * Input tag untuk `aliases` (akun/kategori/anggota) — nama panggilan lain yang dikenali resolver
 * (resolve_account/resolve_category/resolve_member di apps/api) saat parsing teks bebas ("bensin"
 * → kategori Transport, dst.). `value` array string, `onChange(nextArray)`.
 */
export default function AliasInput({ value = [], onChange, placeholder = "contoh: bensin, ojek" }) {
    const [draft, setDraft] = useState("");

    const commit = () => {
        const v = draft.trim();
        if (v && !value.includes(v)) onChange([...value, v]);
        setDraft("");
    };

    const remove = (alias) => onChange(value.filter((a) => a !== alias));

    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 8, display: "block", letterSpacing: 0.8 }}>
                ALIAS (OPSIONAL)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: value.length ? 8 : 0 }}>
                {value.map((alias) => (
                    <span
                        key={alias}
                        style={{
                            display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 10px",
                            borderRadius: 999, fontSize: 12, fontWeight: 600,
                            background: "rgba(255,255,255,.05)", border: "1px solid var(--glass-border)", color: "var(--color-text)",
                        }}
                    >
                        {alias}
                        <button
                            type="button"
                            onClick={() => remove(alias)}
                            aria-label={`Hapus alias ${alias}`}
                            style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}
                        >
                            ✕
                        </button>
                    </span>
                ))}
            </div>
            <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
                }}
                onBlur={commit}
                placeholder={placeholder}
                style={{
                    width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 10,
                    border: "1px solid var(--glass-border)", background: "rgba(255,255,255,.02)",
                    color: "var(--color-text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
            />
        </div>
    );
}
