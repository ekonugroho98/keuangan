/** Pil kecil "dicatat oleh <nama>" di TransaksiView — hanya relevan kalau household >1 anggota. */
export default function RecordedByChip({ recordedBy }) {
    if (!recordedBy?.display_name) return null;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 600,
                background: "rgba(255,255,255,.05)",
                color: "var(--color-muted)",
                border: "1px solid var(--glass-border)",
                whiteSpace: "nowrap",
            }}
        >
            ✍️ {recordedBy.display_name}
        </span>
    );
}
