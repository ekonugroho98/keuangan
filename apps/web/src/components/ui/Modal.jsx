import { useState, useEffect } from "react";

const useIsDesktop = () => {
    const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 640);
    useEffect(() => {
        const handler = () => setIsDesktop(window.innerWidth >= 640);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);
    return isDesktop;
};

const Modal = ({ open, onClose, children }) => {
    const isDesktop = useIsDesktop();

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && onClose) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                display: "flex",
                alignItems: isDesktop ? "center" : "flex-end",
                justifyContent: "center",
                background: "rgba(31, 41, 34, 0.65)", backdropFilter: "blur(8px)",
                animation: "fadeIn 0.25s",
                overflowY: "auto",
                padding: isDesktop ? 20 : "20px 0 0",
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: isDesktop ? 460 : 480,
                    margin: isDesktop ? "auto" : "0 auto",
                    animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1)",
                    borderRadius: isDesktop ? 20 : "20px 20px 0 0",
                    overflow: "hidden",
                    /* Shadow on desktop untuk depth */
                    boxShadow: isDesktop ? "0 24px 64px rgba(31, 41, 34, 0.35)" : "none",
                }}
            >
                {/* Drag handle (mobile only) */}
                {!isDesktop && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", background: "transparent" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,.25)" }} />
                    </div>
                )}
                {/* Pass isDesktop ke children via render prop pattern */}
                {typeof children === "function" ? children({ isDesktop }) : children}
            </div>
        </div>
    );
};

export default Modal;
