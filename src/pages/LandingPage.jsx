import { useState, useEffect } from "react";
import Navbar from "../components/landing/Navbar";
import HeroSection from "../components/landing/HeroSection";
import FeaturesSection from "../components/landing/FeaturesSection";
import AiSection from "../components/landing/AiSection";
import PricingSection from "../components/landing/PricingSection";
import FaqSection from "../components/landing/FaqSection";
import CtaSection from "../components/landing/CtaSection";
import Footer from "../components/landing/Footer";
import SignupModal from "../components/landing/SignupModal";
import LoginModal from "../components/landing/LoginModal";
import DemoModal from "../components/landing/DemoModal";
import { supabase } from "../lib/supabase";

const LandingPage = ({ showToast }) => {
    const [scrollY, setScrollY] = useState(0);
    const [showSignup, setShowSignup] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showDemo, setShowDemo] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
    const [loginForm, setLoginForm] = useState({ email: "", password: "" });
    const [formErrors, setFormErrors] = useState({});
    const [formStep, setFormStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState([{ role: "ai", text: "Halo! Gue Karaya AI 👋 Tanya apa aja soal keuangan lu!" }]);
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
        else if (signupForm.password.length < 8) err.password = "Minimal 8 karakter";
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
            setChatMessages(p => [...p, { role: "ai", text: ["Coba rule 50/30/20 buat budgeting.", "Spending pattern lu naik 15% di hiburan.", "Berdasarkan analisis, lu bisa hemat 30% di Food."][Math.floor(Math.random() * 3)] }]);
            setIsTyping(false);
        }, 1500);
    };

    const openSignupWithPlan = (plan) => { setSelectedPlan(plan); setShowSignup(true); };
    const closeSignup = () => { setShowSignup(false); setFormErrors({}); setFormStep(1); };
    const closeLogin = () => { setShowLogin(false); setFormErrors({}); };

    return (
        <div style={{ fontFamily: "'Inter',-apple-system,sans-serif", background: "#0e0e15", color: "#e2e8f0", minHeight: "100vh", overflowX: "hidden" }}>
            <Navbar scrollY={scrollY} onLogin={() => setShowLogin(true)} onSignup={() => setShowSignup(true)} />
            <HeroSection onSignup={() => setShowSignup(true)} onDemo={() => setShowDemo(true)} />
            <FeaturesSection />
            <AiSection chatMessages={chatMessages} chatInput={chatInput} setChatInput={setChatInput} isTyping={isTyping} handleChat={handleChat} />
            <PricingSection onSelectPlan={openSignupWithPlan} />
            <FaqSection />
            <CtaSection onSignup={() => setShowSignup(true)} />
            <Footer />

            <SignupModal
                open={showSignup} onClose={closeSignup}
                form={signupForm} setForm={setSignupForm}
                errors={formErrors} setErrors={setFormErrors} step={formStep} setStep={setFormStep}
                onSubmit={handleSignup} isLoading={isLoading}
                onSwitchToLogin={() => { closeSignup(); setShowLogin(true); }}
                selectedPlan={selectedPlan}
            />
            <LoginModal
                open={showLogin} onClose={closeLogin}
                form={loginForm} setForm={setLoginForm}
                errors={formErrors} onSubmit={handleLogin} isLoading={isLoading}
                onSwitchToSignup={() => { closeLogin(); setShowSignup(true); }}
            />
            <DemoModal open={showDemo} onClose={() => setShowDemo(false)} onSignup={() => setShowSignup(true)} />
        </div>
    );
};

export default LandingPage;
