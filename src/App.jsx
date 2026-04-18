import { useState, useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Toast from "./components/ui/Toast";
import { supabase } from "./lib/supabase";
import InstallBanner from "./components/ui/InstallBanner";

const globalStyles = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { background: var(--bg-app, #0e0e15); }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: var(--scrollbar-bg, #0e0e15); }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, #60fcc6); border-radius: 3px; }
input::placeholder { color: var(--color-subtle, #76747e); }
input, select, textarea { color: var(--color-text); background: var(--bg-surface-low); }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
@keyframes pulse { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
@keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes shimmer { from { left: -100%; } to { left: 200%; } }
.gradient-text { background: linear-gradient(135deg,#60fcc6,#19ce9b,#60fcc6,#4FC3F7); background-size: 200% 200%; animation: gradient 4s ease infinite; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.nav-link { color: #acaab4; text-decoration: none; font-size: 14px; font-weight: 500; transition: all .3s; padding: 8px 16px; border-radius: 8px; cursor: pointer; border: none; background: none; font-family: inherit; }
.nav-link:hover { color: #fff; background: rgba(96,252,198,.1); }
.btn-primary { background: linear-gradient(135deg,#60fcc6,#19ce9b); color: #005e44; border: none; padding: 14px 32px; border-radius: 9999px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all .3s; font-family: inherit; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(96,252,198,.35); }
.btn-primary:disabled { opacity: .6; cursor: not-allowed; transform: none; }
.btn-secondary { background: var(--color-border-soft); color: #e2e8f0; border: 1px solid var(--color-border); padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px; cursor: pointer; transition: all .3s; font-family: inherit; }
.btn-secondary:hover { background: var(--color-border); border-color: rgba(96,252,198,.4); }
.tag { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
.link-btn { background: none; border: none; color: #60fcc6; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; padding: 0; }
.link-btn:hover { color: #60fcc6; text-decoration: underline; }
/* Mobile touch tap highlight removal */
* { -webkit-tap-highlight-color: transparent; }
/* Prevent horizontal overflow */
html, body { overflow-x: hidden; }
/* Better touch target sizing */
@media (max-width: 768px) {
  .btn-primary, .btn-secondary { padding: 13px 24px !important; font-size: 14px !important; }
  .nav-link { padding: 10px 12px; font-size: 15px; }
}
`;

export default function App() {
    const [session, setSession] = useState(undefined); // undefined = loading
    const [toast, setToast] = useState({ show: false, message: "", type: "success" });
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    const showToast = (msg, type = "success") => {
        setToast({ show: true, message: msg, type });
        setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
    };

    useEffect(() => {
        // Cek session yang sudah ada (misal user refresh halaman)
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        // Listen perubahan auth state (login, logout, token refresh, password recovery)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            if (event === "PASSWORD_RECOVERY") {
                setIsPasswordRecovery(true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        // Clear sensitive cached data (API keys, user settings)
        ["karaya_ai_config", "karaya_avatar_color", "karaya_hidden_menus", "karaya_app_name", "karaya_app_tagline"].forEach(k => localStorage.removeItem(k));
        setSession(null);
        showToast("Berhasil logout 👋", "info");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Masih loading session awal
    if (session === undefined) {
        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <style>{globalStyles}</style>
                <div style={{ textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, border: "3px solid rgba(96,252,198,.25)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} />
                    <div style={{ color: "var(--color-muted)", fontSize: 13 }}>Memuat...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif" }}>
            <style>{globalStyles}</style>
            <InstallBanner />
            <Toast {...toast} />
            {isPasswordRecovery
                ? <ResetPasswordPage showToast={showToast} onDone={() => setIsPasswordRecovery(false)} />
                : session
                    ? <Dashboard session={session} onLogout={handleLogout} showToast={showToast} />
                    : <LandingPage showToast={showToast} />
            }
        </div>
    );
}
