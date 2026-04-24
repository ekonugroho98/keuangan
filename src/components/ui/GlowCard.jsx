/**
 * @deprecated Replaced by .bento-glow utility class in globalStyles (App.jsx).
 * Preserved as a pass-through shim so any lingering imports in third-party
 * code don't break the build. Remove this file once no imports remain.
 */
const GlowCard = ({ children, style }) => (
    <div className="bento bento-glow" style={style}>{children}</div>
);

export default GlowCard;
