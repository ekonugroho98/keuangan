import { useState, useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Toast from "./components/ui/Toast";
import { supabase } from "./lib/supabase";
import InstallBanner from "./components/ui/InstallBanner";

const globalStyles = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: var(--bg-app, #0a0a10);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: "ss01","cv11";
  letter-spacing: -0.01em;
}
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--scrollbar-bg, #0a0a10); }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, #60fcc6); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-primary-deep, #19ce9b); }
::selection { background: var(--color-primary-soft); color: var(--color-text); }
input::placeholder, textarea::placeholder { color: var(--color-subtle, #6d6b76); }
input, select, textarea { color: var(--color-text); background: var(--bg-surface-low); font-family: inherit; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
@keyframes pulse { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
@keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes shimmer { from { left: -100%; } to { left: 200%; } }
@keyframes aurora { 0% { transform: translate(-5%,-5%) rotate(0deg); } 50% { transform: translate(5%,5%) rotate(180deg); } 100% { transform: translate(-5%,-5%) rotate(360deg); } }
@keyframes glow-pulse { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
@keyframes count-up { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* ═══ Typography Utilities ═══ */
.gradient-text { background: linear-gradient(135deg,#60fcc6,#19ce9b,#60fcc6,#4FC3F7); background-size: 200% 200%; animation: gradient 4s ease infinite; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-feature-settings: "tnum", "zero"; letter-spacing: -0.02em; }
.num-tight { font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
.eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: var(--color-subtle); }
.display-hero { font-size: clamp(44px, 6vw, 80px); font-weight: 900; line-height: 1; letter-spacing: -0.04em; }
.display-lg { font-size: clamp(32px, 4vw, 48px); font-weight: 800; line-height: 1.05; letter-spacing: -0.03em; }
.display-md { font-size: clamp(22px, 2.4vw, 32px); font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; }

/* ═══ Bento Card System ═══ */
.bento {
  background: var(--bg-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--r-md, 20px);
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: transform .3s cubic-bezier(.2,.8,.2,1), border-color .3s, box-shadow .3s;
}
.bento:hover { border-color: var(--color-border); }
.bento-hover:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--color-border); }
.bento-glow { position: relative; }
.bento-glow::before {
  content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1px;
  background: linear-gradient(135deg, rgba(96,252,198,.4), transparent 40%, transparent 60%, rgba(96,252,198,.2));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none; opacity: .6;
}
.bento-hero {
  background:
    radial-gradient(600px 300px at 20% 0%, rgba(96,252,198,.12), transparent 60%),
    radial-gradient(400px 300px at 100% 100%, rgba(79,195,247,.08), transparent 60%),
    var(--bg-elevated, var(--bg-surface));
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg, 28px);
  box-shadow: var(--shadow-md), var(--shadow-inset);
  position: relative;
  overflow: hidden;
}
.bento-hero::after {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.1), transparent);
  pointer-events: none;
}

/* ═══ Chips / Pills ═══ */
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px; font-size: 11px; font-weight: 700; letter-spacing: .3px; }
.chip-mint { background: var(--color-primary-soft); color: var(--color-primary); border: 1px solid var(--color-primary-soft); }
.chip-red { background: var(--color-expense-soft); color: var(--color-expense); border: 1px solid var(--color-expense-soft); }
.chip-blue { background: var(--color-transfer-soft); color: var(--color-transfer); border: 1px solid var(--color-transfer-soft); }
.chip-amber { background: var(--color-amber-soft); color: var(--color-amber); border: 1px solid var(--color-amber-soft); }
.chip-ghost { background: var(--color-border-soft); color: var(--color-muted); border: 1px solid var(--color-border-soft); }

/* ═══ Buttons ═══ */
.nav-link { color: var(--color-muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: all .25s; padding: 8px 14px; border-radius: 10px; cursor: pointer; border: none; background: none; font-family: inherit; letter-spacing: -0.01em; }
.nav-link:hover { color: var(--color-text); background: var(--color-primary-soft); }
.btn-primary {
  background: linear-gradient(135deg,#60fcc6,#19ce9b);
  color: #003828; border: none;
  padding: 14px 32px; border-radius: 9999px;
  font-weight: 700; font-size: 15px; cursor: pointer;
  transition: all .3s cubic-bezier(.2,.8,.2,1);
  font-family: inherit; letter-spacing: -0.01em;
  box-shadow: 0 4px 16px rgba(96,252,198,.2), inset 0 1px 0 rgba(255,255,255,.3);
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(96,252,198,.4), inset 0 1px 0 rgba(255,255,255,.4); }
.btn-primary:active { transform: translateY(0); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-secondary {
  background: var(--bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  padding: 14px 32px; border-radius: 9999px;
  font-weight: 600; font-size: 15px; cursor: pointer;
  transition: all .25s; font-family: inherit;
  letter-spacing: -0.01em;
  backdrop-filter: blur(16px);
}
.btn-secondary:hover { background: var(--bg-surface-hover); border-color: var(--color-border-strong); }
.btn-ghost {
  background: transparent; color: var(--color-muted);
  border: 1px solid var(--color-border-soft);
  padding: 10px 18px; border-radius: 9999px;
  font-weight: 600; font-size: 13px; cursor: pointer;
  transition: all .2s; font-family: inherit;
}
.btn-ghost:hover { color: var(--color-text); background: var(--bg-surface-hover); border-color: var(--color-border); }
.tag { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
.link-btn { background: none; border: none; color: var(--color-primary); cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; padding: 0; transition: opacity .2s; }
.link-btn:hover { opacity: .75; text-decoration: underline; }

/* ═══ Focus ring ═══ */
button:focus-visible, a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; border-radius: 4px; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px var(--color-primary-soft); }

/* ═══ Divider ═══ */
.div-soft { height: 1px; background: linear-gradient(90deg, transparent, var(--color-border), transparent); }

/* ═══ Cross-view typography nudges — inherited by all 12 dashboard views ═══ */
h1, h2, h3, h4 { letter-spacing: -.02em; }
h2 { font-weight: 800; }
h3 { font-weight: 700; }
/* Any element showing money in Rp format gets tabular nums */
[class*="num-"], .mono { font-variant-numeric: tabular-nums; }

/* ═══════════════════════════════════════════════════════════════
 * AURORA GLASS SYSTEM
 * Layered moving aurora + grain texture + frosted bento surfaces
 * ═══════════════════════════════════════════════════════════════ */

/* Animated aurora mesh — fixed behind everything */
@keyframes aurora-drift-1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%,-4%) scale(1.08); } }
@keyframes aurora-drift-2 { 0%,100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-7%,5%) scale(1); } }
@keyframes aurora-drift-3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(4%,6%) scale(1.12); } }
@keyframes aurora-drift-4 { 0%,100% { transform: translate(0,0) scale(1.05); } 50% { transform: translate(-5%,-6%) scale(1); } }

.aurora-layer {
  position: fixed; inset: -10%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  filter: blur(72px) saturate(140%);
}
.aurora-layer::before,
.aurora-layer::after,
.aurora-layer > span { content: ""; position: absolute; border-radius: 50%; will-change: transform; }
.aurora-layer::before {
  top: -10%; left: -10%; width: 65%; height: 65%;
  background: radial-gradient(circle, var(--aurora-1), transparent 60%);
  animation: aurora-drift-1 22s ease-in-out infinite;
}
.aurora-layer::after {
  bottom: -15%; right: -12%; width: 70%; height: 70%;
  background: radial-gradient(circle, var(--aurora-2), transparent 60%);
  animation: aurora-drift-2 26s ease-in-out infinite;
}
.aurora-blob-3 {
  top: 25%; left: 35%; width: 55%; height: 55%;
  background: radial-gradient(circle, var(--aurora-3), transparent 60%);
  animation: aurora-drift-3 30s ease-in-out infinite;
}
.aurora-blob-4 {
  bottom: 15%; left: -12%; width: 48%; height: 48%;
  background: radial-gradient(circle, var(--aurora-4), transparent 60%);
  animation: aurora-drift-4 34s ease-in-out infinite;
}
/* Light mode: blend aurora into the warm grey bg for richer mixing */
[data-theme="light"] .aurora-layer { mix-blend-mode: multiply; filter: blur(80px) saturate(150%); }
[data-theme="light"] .grain-layer { mix-blend-mode: multiply; }

/* Grain texture layer — sits on top of aurora but below content */
.grain-layer {
  position: fixed; inset: 0; z-index: 0;
  pointer-events: none;
  opacity: var(--grain-opacity, .025);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

/* ═══ Glass Card System ═══ */
.glass {
  background: var(--glass-1, rgba(22,22,30,.55));
  backdrop-filter: var(--glass-blur, saturate(180%) blur(28px));
  -webkit-backdrop-filter: var(--glass-blur, saturate(180%) blur(28px));
  border: 1px solid var(--glass-border, rgba(255,255,255,.08));
  box-shadow: var(--glass-highlight, inset 0 1px 0 rgba(255,255,255,.08)), 0 2px 8px rgba(0,0,0,.15);
  border-radius: var(--r-md, 20px);
  position: relative;
  overflow: hidden;
}
.glass-sm { backdrop-filter: var(--glass-blur-sm); -webkit-backdrop-filter: var(--glass-blur-sm); }
.glass-hero {
  background: var(--glass-hero);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-highlight), 0 8px 32px rgba(0,0,0,.25);
  border-radius: var(--r-lg, 28px);
  position: relative;
  overflow: hidden;
}
.glass-hero::before,
.bento-glow::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
  background: linear-gradient(135deg, rgba(96,252,198,.55), rgba(167,139,250,.15) 30%, transparent 55%, transparent 70%, rgba(79,195,247,.3));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none;
}
.glass-hero::after {
  content: ""; position: absolute; top: 0; left: 8%; right: 8%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent);
  pointer-events: none;
}

/* Override .bento (existing bento grid) to glass */
.bento {
  background: var(--glass-1);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-highlight), 0 2px 8px rgba(0,0,0,.12);
}
.bento-hero {
  background: var(--glass-hero) !important;
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border) !important;
  box-shadow: var(--glass-highlight), 0 12px 40px rgba(0,0,0,.3) !important;
}

/* Ensure page content sits above aurora */
.aurora-content { position: relative; z-index: 1; }

/* ═══════════════════════════════════════════════════════════════
 * AUTO-GLASS — any inline style using --bg-surface (but not the
 * -low/-hover variants for inputs) gets backdrop-filter + edge.
 * This turns all 12 dashboard views into frosted glass with zero
 * per-file refactor needed.
 * ═══════════════════════════════════════════════════════════════ */
[style*="var(--bg-surface)"]:not([style*="--bg-surface-low"]):not([style*="--bg-surface-hover"]):not([style*="--bg-surface-high"]) {
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-highlight), 0 2px 10px rgba(0,0,0,.08);
}

/* Sidebar glass variant */
.glass-sidebar {
  background: var(--glass-sidebar) !important;
  backdrop-filter: var(--glass-blur) !important;
  -webkit-backdrop-filter: var(--glass-blur) !important;
  border-right: 1px solid var(--glass-border) !important;
}

/* Mobile touch tap highlight removal */
* { -webkit-tap-highlight-color: transparent; }
/* Prevent horizontal overflow */
html, body { overflow-x: hidden; width: 100%; max-width: 100vw; }

/* ═══════════════════════════════════════════════════════════════
 * MOBILE-FIRST SAFEGUARDS
 *  - Touch targets ≥ 44px
 *  - All cards fluid width, no rigid min-widths that cause overflow
 *  - Horizontal carousels snap & pad for thumb-friendly scrolling
 *  - Chips & buttons shrink gracefully
 * ═══════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .btn-primary, .btn-secondary { padding: 13px 24px !important; font-size: 14px !important; min-height: 44px; }
  .nav-link { padding: 10px 12px; font-size: 15px; }
  .bento, .glass, .glass-hero, .bento-hero { padding: 18px 18px !important; border-radius: 18px !important; }
  .chip { padding: 4px 10px !important; font-size: 10px !important; }
  /* Bento grid auto-stack */
  [class^="b-"], [class*=" b-"] { grid-column: span 6 !important; }
  /* Safe horizontal scroll: snap + padding for fat thumb */
  [style*="overflowX"] { scroll-padding: 0 14px; -webkit-overflow-scrolling: touch; }
  /* Auto-shrink any card with minWidth set */
  [style*="minWidth: 200"], [style*="minWidth: 210"], [style*="minWidth: 220"], [style*="minWidth: 260"], [style*="minWidth: 280"] {
    min-width: 78vw !important;
    max-width: 85vw;
  }
  /* Hero net-worth typography scaling */
  .hero-number { font-size: clamp(36px, 11vw, 56px) !important; }
  /* Reduce backdrop blur on mobile for perf */
  .glass, .bento, .glass-hero, .bento-hero, .glass-sidebar {
    backdrop-filter: saturate(160%) blur(16px) !important;
    -webkit-backdrop-filter: saturate(160%) blur(16px) !important;
  }
}
@media (max-width: 480px) {
  .display-hero { font-size: clamp(32px, 9vw, 44px) !important; }
  .bento, .glass, .glass-hero, .bento-hero { padding: 16px 16px !important; border-radius: 16px !important; }
}

/* Minimum touch target on buttons globally */
button { min-height: 36px; }
@media (max-width: 768px) {
  button { min-height: 42px; }
  button[aria-label], button[title] { min-height: 36px; } /* Icon-only buttons exempt */
}

/* Safe area insets on notched phones */
@supports (padding: env(safe-area-inset-bottom)) {
  body { padding-bottom: env(safe-area-inset-bottom); }
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
        <div style={{ fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif", position: "relative", minHeight: "100vh" }}>
            <style>{globalStyles}</style>
            {/* Aurora + grain — fixed layers behind everything */}
            <div className="aurora-layer" aria-hidden="true">
                <span className="aurora-blob-3" />
                <span className="aurora-blob-4" />
            </div>
            <div className="grain-layer" aria-hidden="true" />
            <div className="aurora-content">
                <InstallBanner />
                <Toast {...toast} />
                {isPasswordRecovery
                    ? <ResetPasswordPage showToast={showToast} onDone={() => setIsPasswordRecovery(false)} />
                    : session
                        ? <Dashboard session={session} onLogout={handleLogout} showToast={showToast} />
                        : <LandingPage showToast={showToast} />
                }
            </div>
        </div>
    );
}
