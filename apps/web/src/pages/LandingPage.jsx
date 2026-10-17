import { useState, useEffect } from "react";
import { APP_AI_NAME } from "../config/app";
import { PASSWORD_MIN_LENGTH } from "../constants/validation";
import Navbar from "../components/landing/Navbar";
import HeroSection from "../components/landing/HeroSection";
import FeaturesSection from "../components/landing/FeaturesSection";
import AiSection from "../components/landing/AiSection";
import FaqSection from "../components/landing/FaqSection";
import CtaSection from "../components/landing/CtaSection";
import Footer from "../components/landing/Footer";
import SignupModal from "../components/landing/SignupModal";
import LoginModal from "../components/landing/LoginModal";
import ForgotPasswordModal from "../components/landing/ForgotPasswordModal";
import DemoModal from "../components/landing/DemoModal";
import { supabase } from "../lib/supabase";

const LandingPage = ({ showToast }) => {
    const [scrollY, setScrollY] = useState(0);
    const [showSignup, setShowSignup] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showDemo, setShowDemo] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
    const [loginForm, setLoginForm] = useState({ email: "", password: "" });
    const [formErrors, setFormErrors] = useState({});
    const [formStep, setFormStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState([{ role: "ai", text: `Halo! Gue ${APP_AI_NAME} 🌱 Mau cek anggaran belanja dapur, stok kulkas, atau keuangan keluarga hari ini?` }]);
    const [chatInput, setChatInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        const h = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", h, { passive: true });
        return () => window.removeEventListener("scroll", h);
    }, []);

    const handleSignup = async () => {
        // Validasi frontend
        const err = {};
        if (!signupForm.name.trim()) err.name = "Nama wajib diisi";
        if (!signupForm.email.trim()) err.email = "Email wajib diisi";
        else if (!/\S+@\S+\.\S+/.test(signupForm.email)) err.email = "Format email tidak valid";
        if (!signupForm.password) err.password = "Password wajib diisi";
        else if (signupForm.password.length < PASSWORD_MIN_LENGTH) err.password = `Minimal ${PASSWORD_MIN_LENGTH} karakter`;
        if (signupForm.password !== signupForm.confirmPassword) err.confirmPassword = "Password tidak cocok";
        setFormErrors(err);
        if (Object.keys(err).length > 0) return;

        setIsLoading(true);
        const { error } = await supabase.auth.signUp({
            email: signupForm.email,
            password: signupForm.password,
            options: {
                data: { full_name: signupForm.name }, // simpan nama di metadata
            },
        });
        setIsLoading(false);

        if (error) {
            if (error.message.includes("already registered")) {
                setFormErrors({ email: "Email sudah terdaftar, silakan login" });
            } else {
                showToast(error.message, "info");
            }
            return;
        }

        setShowSignup(false);
        setSignupForm({ name: "", email: "", password: "", confirmPassword: "" });
        setFormStep(1);
        showToast("Akun dibuat! Cek email kamu untuk konfirmasi 📧", "info");
    };

    const handleLogin = async () => {
        const err = {};
        if (!loginForm.email.trim()) err.email = "Email wajib diisi";
        if (!loginForm.password) err.password = "Password wajib diisi";
        setFormErrors(err);
        if (Object.keys(err).length > 0) return;

        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: loginForm.email,
            password: loginForm.password,
        });
        setIsLoading(false);

        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                setFormErrors({ password: "Email atau password salah" });
            } else if (error.message.toLowerCase().includes("email not confirmed")) {
                setFormErrors({ email: "Email belum dikonfirmasi, cek inbox kamu" });
            } else {
                showToast(error.message, "info");
            }
            return;
        }

        setShowLogin(false);
        setLoginForm({ email: "", password: "" });
        showToast("Selamat datang kembali! 👋");
        // App.jsx otomatis redirect ke Dashboard via onAuthStateChange
    };

    const handleChat = () => {
        if (!chatInput.trim()) return;
        setChatMessages(p => [...p, { role: "user", text: chatInput.trim() }]);
        setChatInput("");
        setIsTyping(true);
        setTimeout(() => {
            setChatMessages(p => [...p, { role: "ai", text: [
                "Anggaran belanja dapur bulan ini masih aman (terpakai 62%). Susu UHT paling murah di Indomaret Rp 18.500/kotak.",
                "Stok telur & minyak goreng di dapur sisa 1, mau langsung gue masukin ke Daftar Belanja Keluarga?",
                "Transfer uang belanja dari Ayah Rp 5,8 jt sudah masuk ke rekening Ibu dan siap dialokasikan.",
            ][Math.floor(Math.random() * 3)] }]);
            setIsTyping(false);
        }, 1200);
    };

    const closeSignup = () => { setShowSignup(false); setFormErrors({}); setFormStep(1); };
    const closeLogin = () => { setShowLogin(false); setFormErrors({}); };

    return (
        <div style={{ fontFamily: "'Quicksand',-apple-system,sans-serif", background: "var(--bg-app)", color: "var(--color-text)", minHeight: "100vh", overflowX: "hidden" }}>
            <Navbar scrollY={scrollY} onLogin={() => setShowLogin(true)} onSignup={() => setShowSignup(true)} />
            <HeroSection onSignup={() => setShowSignup(true)} onDemo={() => setShowDemo(true)} />
            <FeaturesSection />
            <AiSection chatMessages={chatMessages} chatInput={chatInput} setChatInput={setChatInput} isTyping={isTyping} handleChat={handleChat} />
            <FaqSection />
            <CtaSection onSignup={() => setShowSignup(true)} />
            <Footer />

            <SignupModal
                open={showSignup} onClose={closeSignup}
                form={signupForm} setForm={setSignupForm}
                errors={formErrors} setErrors={setFormErrors} step={formStep} setStep={setFormStep}
                onSubmit={handleSignup} isLoading={isLoading}
                onSwitchToLogin={() => { closeSignup(); setShowLogin(true); }}

            />
            <LoginModal
                open={showLogin} onClose={closeLogin}
                form={loginForm} setForm={setLoginForm}
                errors={formErrors} onSubmit={handleLogin} isLoading={isLoading}
                onSwitchToSignup={() => { closeLogin(); setShowSignup(true); }}
                onForgotPassword={() => { closeLogin(); setShowForgotPassword(true); }}
            />
            <ForgotPasswordModal
                open={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
                onBackToLogin={() => { setShowForgotPassword(false); setShowLogin(true); }}
            />
            <DemoModal open={showDemo} onClose={() => setShowDemo(false)} onSignup={() => setShowSignup(true)} />
        </div>
    );
};

export default LandingPage;
