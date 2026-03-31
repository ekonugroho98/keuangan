import { useState, useRef } from "react";

const GlowCard = ({ children, glowColor = "rgba(99,102,241,0.15)", onClick, style: xs = {} }) => {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [hover, setHover] = useState(false);
    const ref = useRef(null);
    return (
        <div
            ref={ref}
            onMouseMove={e => { const r = ref.current.getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={onClick}
            style={{
                position: "relative", overflow: "hidden",
                background: "rgba(15,15,30,0.6)", backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20,
                transition: "transform 0.3s, box-shadow 0.3s",
                transform: hover ? "translateY(-4px)" : "none",
                boxShadow: hover ? `0 20px 40px ${glowColor}` : "0 4px 20px rgba(0,0,0,0.2)",
                ...xs,
            }}
        >
            {hover && (
                <div style={{
                    position: "absolute", top: pos.y - 150, left: pos.x - 150,
                    width: 300, height: 300,
                    background: `radial-gradient(circle, ${glowColor}, transparent 70%)`,
                    pointerEvents: "none", zIndex: 0,
                }} />
            )}
            <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
        </div>
    );
};

export default GlowCard;
