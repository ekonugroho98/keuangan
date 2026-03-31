const Modal = ({ open, onClose, children }) => {
    if (!open) return null;
    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                animation: "fadeIn 0.3s",
                overflowY: "auto",
                padding: "20px 0 0",
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: "100%", maxWidth: 480,
                    margin: "0 auto",
                    animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
                    borderRadius: "20px 20px 0 0",
                    overflow: "hidden",
                }}
            >
                {/* Drag handle */}
                <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", background: "transparent" }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,.15)" }} />
                </div>
                {children}
            </div>
        </div>
    );
};

export default Modal;
