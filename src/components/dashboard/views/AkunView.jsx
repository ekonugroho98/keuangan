import { fmtRp } from "../../../utils/formatters";
import { useLanguage } from "../../../i18n/LanguageContext";

const AkunView = ({ accounts, transactions, setShowAddAccount }) => {
    const { t } = useLanguage();
    return (
    <div style={{ animation: "fadeIn .4s" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>
            {accounts.map(a => (
                <div key={a.id} style={{ background: "rgba(15,15,30,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${a.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{a.icon}</div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: "#64748b", textTransform: "capitalize" }}>{a.type}</div>
                        </div>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>{fmtRp(a.balance)}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{transactions.filter(tx => tx.account === a.name).length} {t("nav.transactions").toLowerCase()}</div>
                </div>
            ))}
            <div
                onClick={() => setShowAddAccount(true)}
                style={{ background: "rgba(15,15,30,.3)", border: "2px dashed rgba(99,102,241,.2)", borderRadius: 16, padding: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", minHeight: 140 }}
            >
                <div style={{ textAlign: "center", color: "#818cf8" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>+</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t("acc.addNew").replace("+ ", "")}</div>
                </div>
            </div>
        </div>
    </div>
    );
};

export default AkunView;
