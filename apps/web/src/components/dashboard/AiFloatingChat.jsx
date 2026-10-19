import { useRef, useEffect } from "react";
import { AI_PROVIDERS } from "../../services/aiService";
import { APP_AI_NAME } from "../../config/app";
import { useIsMobile } from "../../hooks/useIsMobile";

const CONTEXT_PROMPTS = {
  dasbor: [
    { label: "💡 Jatah aman harian", text: "Berapa sisa jatah aman harian bulan ini?" },
    { label: "📊 Ringkasan bulan ini", text: "Analisis pengeluaran rumah tangga bulan ini" },
    { label: "✍️ Catat pengeluaran...", text: "Catat pengeluaran beli ", fillOnly: true },
    { label: "🛒 Cek belanja & kulkas", text: "Cek daftar belanja & stok kulkas yang menipis" },
  ],
  belanja: [
    { label: "🛒 Daftar belum dibeli", text: "Barang apa saja di daftar belanja yang belum dibeli?" },
    { label: "⚖️ Bandingkan harga", text: "Bandingkan harga barang kebutuhan pokok antar toko" },
    { label: "➕ Tambah belanjaan...", text: "Tambahkan ke daftar belanja: ", fillOnly: true },
  ],
  pantry: [
    { label: "🧊 Stok menipis", text: "Stok kulkas atau rumah apa saja yang sudah menipis atau habis?" },
    { label: "📦 Semua stok rumah", text: "Tampilkan ringkasan stok kulkas & rumah saat ini" },
    { label: "➕ Update stok...", text: "Update stok kulkas: ", fillOnly: true },
  ],
  transaksi: [
    { label: "🔥 Pengeluaran terbesar", text: "Kategori apa yang paling besar pengeluarannya bulan ini?" },
    { label: "✍️ Catat pengeluaran...", text: "Catat pengeluaran beli ", fillOnly: true },
    { label: "🔍 Cari transaksi...", text: "Cari transaksi ", fillOnly: true },
  ],
  anggaran: [
    { label: "⚠️ Anggaran hampir habis", text: "Kategori anggaran mana yang sudah hampir habis bulan ini?" },
    { label: "📊 Evaluasi budget", text: "Evaluasi pemakaian anggaran keluarga bulan ini" },
  ],
  hutang: [
    { label: "📋 Sisa hutang & cicilan", text: "Cek kondisi cicilan & sisa hutang keluarga saat ini" },
  ],
  piutang: [
    { label: "🤝 Piutang belum lunas", text: "Siapa saja yang masih punya piutang belum lunas?" },
  ],
  goals: [
    { label: "🎯 Progres target finansial", text: "Bagaimana progres target tabungan (goals) keluarga kita?" },
  ],
  investasi: [
    { label: "📈 Portofolio investasi", text: "Ringkas portofolio investasi & aset keluarga saat ini" },
  ],
  laporan: [
    { label: "📈 Bulan ini vs bulan lalu", text: "Bandingkan pengeluaran bulan ini vs bulan lalu" },
    { label: "💰 Rasio tabungan", text: "Berapa saving rate dan sisa kas keluarga bulan ini?" },
  ],
};

export default function AiFloatingChat({
  open,
  setOpen,
  aiChat,
  aiTyping,
  aiInput,
  setAiInput,
  handleAi,
  onResetChat,
  aiConfig,
  onOpenAiSettings,
  activeMenu,
}) {
  const isMobile = useIsMobile();
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const isAiEnabled = Boolean(aiConfig?.apiKey?.trim()) && !aiConfig?.disabled;

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, aiChat, aiTyping]);

  useEffect(() => {
    if (open && !isMobile) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, isMobile]);

  // Hanya tampil bagi user yang sudah login & mengaktifkan fitur AI
  if (!isAiEnabled) return null;

  const isGatekeeper = aiConfig?.apiKey?.trim().startsWith("sk-kb-");
  const providerKey = isGatekeeper ? "gatekeeper" : aiConfig?.provider;
  const provider = AI_PROVIDERS[providerKey] || AI_PROVIDERS.gatekeeper;
  const modelLabel =
    provider?.models?.find((m) => m.id === aiConfig?.model)?.label ||
    aiConfig?.model ||
    (isGatekeeper ? "KB Auto" : "AI Model");

  const prompts = CONTEXT_PROMPTS[activeMenu] || CONTEXT_PROMPTS.dasbor;

  const handleChipClick = (chip) => {
    if (aiTyping) return;
    if (chip.fillOnly) {
      setAiInput(chip.text);
      inputRef.current?.focus();
    } else {
      handleAi(chip.text);
    }
  };

  return (
    <>
      {/* ── Jendela Popover Chat AI ── */}
      {open && (
        <div
          role="dialog"
          aria-label={`${APP_AI_NAME} Chat`}
          style={{
            position: "fixed",
            bottom: isMobile ? 84 : 94,
            right: isMobile ? 12 : 24,
            left: isMobile ? 12 : "auto",
            width: isMobile ? "auto" : 400,
            height: isMobile ? "min(74vh, calc(100vh - 104px))" : "min(580px, calc(100vh - 120px))",
            zIndex: 950,
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-elevated, var(--bg-surface))",
            border: "1px solid var(--color-border)",
            borderRadius: 24,
            boxShadow: "0 20px 50px rgba(0,0,0,0.22), 0 4px 16px rgba(63,81,66,0.14)",
            overflow: "hidden",
            animation: "scaleIn .2s cubic-bezier(.2,.8,.2,1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep, #2D3B30))",
              color: "var(--color-on-primary, #fff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.16)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {provider?.icon || "🤖"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontFamily: "'Fredoka', sans-serif",
                  }}
                >
                  {APP_AI_NAME}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    opacity: 0.9,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#6EE7B7",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span>
                    {provider?.label?.split(" ")[0] || "AI"} · {modelLabel} · ⚡ Bisa Catat
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {onResetChat && aiChat.length > 1 && (
                <button
                  type="button"
                  onClick={onResetChat}
                  title="Bersihkan percakapan"
                  aria-label="Bersihkan percakapan"
                  style={{
                    width: 32,
                    height: 32,
                    minHeight: 32,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ↺
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenAiSettings?.();
                }}
                title="Pengaturan AI Coach"
                aria-label="Pengaturan AI Coach"
                style={{
                  width: 32,
                  height: 32,
                  minHeight: 32,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ⚙️
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Tutup chat"
                aria-label="Tutup chat"
                style={{
                  width: 32,
                  height: 32,
                  minHeight: 32,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Daftar Pesan */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px 14px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: "var(--bg-app)",
            }}
          >
            {aiChat.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "86%",
                  padding: "10px 14px",
                  borderRadius:
                    m.role === "user"
                      ? "16px 16px 4px 16px"
                      : "16px 16px 16px 4px",
                  background:
                    m.role === "user"
                      ? "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep, #2D3B30))"
                      : m.role === "error"
                        ? "var(--color-expense-soft)"
                        : "var(--bg-surface)",
                  border:
                    m.role === "user"
                      ? "none"
                      : m.role === "error"
                        ? "1px solid rgba(255,113,108,0.35)"
                        : "1px solid var(--color-border-soft)",
                  boxShadow:
                    m.role === "user"
                      ? "0 2px 8px rgba(63,81,66,0.2)"
                      : "var(--shadow-sm)",
                  color:
                    m.role === "user"
                      ? "var(--color-on-primary, #fff)"
                      : m.role === "error"
                        ? "var(--color-expense)"
                        : "var(--color-text)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.text}
              </div>
            ))}

            {aiTyping && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "10px 14px",
                  borderRadius: "16px 16px 16px 4px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--color-border-soft)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--color-muted)",
                }}
              >
                <span style={{ display: "inline-flex", gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--color-primary)",
                        display: "inline-block",
                        animation: `pulse 1s ${i * 0.18}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </span>
                <span>Memproses data keluarga...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chip Saran Kontekstual */}
          <div
            style={{
              padding: "8px 12px 6px",
              background: "var(--bg-surface)",
              borderTop: "1px solid var(--color-border-soft)",
              display: "flex",
              gap: 6,
              overflowX: "auto",
              flexShrink: 0,
            }}
          >
            {prompts.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                disabled={aiTyping}
                onClick={() => handleChipClick(chip)}
                className="chip chip-mint"
                style={{
                  cursor: aiTyping ? "not-allowed" : "pointer",
                  opacity: aiTyping ? 0.5 : 1,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  fontSize: 11,
                  padding: "5px 10px",
                  minHeight: 28,
                  fontFamily: "inherit",
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div
            style={{
              padding: "8px 12px 12px",
              background: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAi();
                }
              }}
              placeholder="Tanya atau suruh catat transaksi..."
              disabled={aiTyping}
              aria-label="Ketik pesan ke AI"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid var(--color-border)",
                background: "var(--bg-surface-low)",
                color: "var(--color-text)",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => handleAi()}
              disabled={!aiInput.trim() || aiTyping}
              aria-label="Kirim pesan"
              style={{
                width: 40,
                height: 40,
                minHeight: 40,
                borderRadius: "50%",
                border: "none",
                background:
                  aiInput.trim() && !aiTyping
                    ? "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep, #2D3B30))"
                    : "var(--color-border-soft)",
                color:
                  aiInput.trim() && !aiTyping
                    ? "var(--color-on-primary, #fff)"
                    : "var(--color-muted)",
                fontSize: 18,
                fontWeight: 700,
                cursor: aiInput.trim() && !aiTyping ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all .15s",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* ── Tombol Floating Bubble di Pojok Kanan Bawah ── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={open ? "Tutup Asisten AI" : `Chat dengan ${APP_AI_NAME}`}
        aria-label={open ? "Tutup Asisten AI" : `Chat dengan ${APP_AI_NAME}`}
        style={{
          position: "fixed",
          bottom: isMobile ? 20 : 26,
          right: isMobile ? 18 : 26,
          zIndex: 951,
          width: 56,
          height: 56,
          minHeight: 56,
          borderRadius: "50%",
          border: "2.5px solid rgba(255,255,255,0.9)",
          background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep, #2D3B30))",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(63,81,66,0.38), 0 2px 8px rgba(0,0,0,0.18)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = "scale(1.06)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {open ? (
          <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>✕</span>
        ) : (
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
          </svg>
        )}

        {/* Indikator titik hijau aktif saat tertutup */}
        {!open && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#34D399",
              border: "2px solid #fff",
            }}
          />
        )}
      </button>
    </>
  );
}
