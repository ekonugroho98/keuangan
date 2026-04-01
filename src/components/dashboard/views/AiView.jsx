const AiView = ({ aiChat, aiTyping, aiInput, setAiInput, handleAi }) => (
    <div style={{ animation: "fadeIn .4s", maxWidth: 700 }}>
        <div style={{ background: "rgba(25,25,33,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#60fcc6,#19ce9b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Karaya AI Financial Coach</div>
                    <div style={{ fontSize: 11, color: "#60fcc6" }}>● Online</div>
                </div>
            </div>

            <div style={{ height: 350, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {aiChat.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "80%", padding: "12px 16px",
                        borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        background: m.role === "user" ? "linear-gradient(135deg,#60fcc6,#19ce9b)" : "rgba(255,255,255,.05)",
                        color: "#e2e8f0", fontSize: 14, lineHeight: 1.7, animation: "slideUp .3s",
                    }}>{m.text}</div>
                ))}
                {aiTyping && (
                    <div style={{ alignSelf: "flex-start", padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,.05)", color: "#acaab4" }}>
                        <span style={{ animation: "pulse 1s ease infinite" }}>●●●</span>
                    </div>
                )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                <input
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAi()}
                    placeholder="Tanya AI soal keuangan lu..."
                    style={{ flex: 1, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "12px 16px", color: "#e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit" }}
                />
                <button onClick={handleAi} style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#60fcc6,#19ce9b)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>↑</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {["Analisis spending gue", "Tips hemat", "Cek hutang gue", "Gimana saving rate gue?"].map((q, i) => (
                    <button key={i} onClick={() => setAiInput(q)} style={{ padding: "5px 12px", borderRadius: 16, border: "1px solid rgba(96,252,198,.2)", background: "rgba(96,252,198,.05)", color: "#60fcc6", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{q}</button>
                ))}
            </div>
        </div>
    </div>
);

export default AiView;
