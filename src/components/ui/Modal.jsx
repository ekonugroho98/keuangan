const Modal = ({ open, onClose, children }) => {
    if (!open) return null;
    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                animation: "fadeIn 0.3s",
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ width: "100%", maxWidth: 480, margin: "0 16px", animation: "scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}
            >
                {children}
            </div>
        </div>
    );
};

export default Modal;
