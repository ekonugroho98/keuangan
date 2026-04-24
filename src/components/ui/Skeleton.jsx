/**
 * Skeleton — shimmer placeholder blocks for loading states.
 *
 * Default export : <Skeleton />           — atomic shimmer block
 * Named exports  : <BentoSkeleton />      — full bento-card shape
 *                  <DashboardSkeleton />  — mimics DasborView bento grid
 *
 * Uses a masked gradient sweep (see <style> block) so it respects the
 * current theme surface tokens instead of forcing a fixed color.
 */

const SHIMMER_CSS = `
@keyframes skeleton-shimmer {
    0%   { background-position: -220% 0; }
    100% { background-position: 220% 0; }
}
@keyframes skeleton-pulse {
    0%, 100% { opacity: .7; }
    50%      { opacity: 1; }
}
.sk-shimmer {
    position: relative;
    overflow: hidden;
    background: var(--bg-surface-low, rgba(255,255,255,.04));
    background-image: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255,255,255,.06) 45%,
        rgba(96,252,198,.08) 50%,
        rgba(255,255,255,.06) 55%,
        transparent 100%
    );
    background-size: 220% 100%;
    background-repeat: no-repeat;
    animation: skeleton-shimmer 1.8s cubic-bezier(.45,.05,.25,1) infinite;
}
.sk-card {
    border-radius: 20px;
    border: 1px solid var(--glass-border, rgba(255,255,255,.06));
    background: var(--glass-1, rgba(255,255,255,.03));
    backdrop-filter: var(--glass-blur, blur(14px));
    -webkit-backdrop-filter: var(--glass-blur, blur(14px));
    box-shadow: var(--glass-highlight, inset 0 1px 0 rgba(255,255,255,.04));
    padding: 22px 24px;
    position: relative;
    overflow: hidden;
    animation: skeleton-pulse 2.4s ease-in-out infinite;
}
`;

/** Atomic shimmer block. */
const Skeleton = ({
    width = "100%",
    height = 14,
    radius = 8,
    style = {},
    className = "",
}) => (
    <span
        className={`sk-shimmer ${className}`}
        style={{
            display: "block",
            width,
            height,
            borderRadius: radius,
            ...style,
        }}
    />
);

/** Card-shaped skeleton matching the bento layout. */
export const BentoSkeleton = ({
    lines = 2,
    showHeader = true,
    minHeight = 140,
    style = {},
}) => (
    <div className="sk-card" style={{ minHeight, ...style }}>
        {showHeader && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    <Skeleton width="32%" height={9} radius={99} />
                    <Skeleton width="58%" height={14} radius={6} />
                </div>
                <Skeleton width={52} height={20} radius={99} />
            </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton width="70%" height={28} radius={8} />
            {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
                <Skeleton
                    key={i}
                    width={`${90 - i * 14}%`}
                    height={10}
                    radius={6}
                />
            ))}
        </div>
    </div>
);

/** Dashboard-shaped skeleton that mimics DasborView bento grid. */
export const DashboardSkeleton = () => (
    <>
        <style>{SHIMMER_CSS}</style>
        <div
            style={{
                minHeight: "100vh",
                background: "var(--bg-app)",
                padding: "clamp(14px, 3vw, 28px)",
                animation: "fadeIn .3s ease",
            }}
        >
            {/* Header bar skeleton */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24,
                    gap: 12,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <Skeleton width={36} height={36} radius={10} />
                    <Skeleton width="min(180px, 40%)" height={20} radius={6} />
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <Skeleton width={120} height={36} radius={9999} />
                    <Skeleton width={36} height={36} radius={10} />
                </div>
            </div>

            {/* Bento grid skeleton */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(12, 1fr)",
                    gridAutoRows: "minmax(92px, auto)",
                    gap: 14,
                }}
            >
                {/* Hero */}
                <BentoSkeleton
                    lines={3}
                    minHeight={240}
                    style={{ gridColumn: "span 8", gridRow: "span 2", borderRadius: 28 }}
                />
                {/* Ring */}
                <BentoSkeleton
                    lines={2}
                    minHeight={112}
                    style={{ gridColumn: "span 4" }}
                />
                {/* Target mini */}
                <BentoSkeleton
                    lines={2}
                    minHeight={112}
                    style={{ gridColumn: "span 4" }}
                />
                {/* Income / Expense / Net */}
                {Array.from({ length: 3 }).map((_, i) => (
                    <BentoSkeleton
                        key={i}
                        lines={2}
                        minHeight={132}
                        style={{ gridColumn: "span 4" }}
                    />
                ))}
                {/* Accounts wide */}
                <BentoSkeleton
                    lines={1}
                    minHeight={170}
                    style={{ gridColumn: "span 12" }}
                />
                {/* Chart wide */}
                <BentoSkeleton
                    lines={5}
                    minHeight={260}
                    style={{ gridColumn: "span 8", gridRow: "span 2" }}
                />
                {/* Recent TX tall */}
                <BentoSkeleton
                    lines={6}
                    minHeight={260}
                    style={{ gridColumn: "span 4", gridRow: "span 2" }}
                />
                {/* Cats */}
                <BentoSkeleton
                    lines={4}
                    minHeight={180}
                    style={{ gridColumn: "span 5" }}
                />
                {/* Goals */}
                <BentoSkeleton
                    lines={3}
                    minHeight={180}
                    style={{ gridColumn: "span 4" }}
                />
                {/* Debts */}
                <BentoSkeleton
                    lines={2}
                    minHeight={180}
                    style={{ gridColumn: "span 3" }}
                />
                {/* Health */}
                <BentoSkeleton
                    lines={3}
                    minHeight={160}
                    style={{ gridColumn: "span 12" }}
                />
            </div>

            {/* Responsive collapse — match DasborView breakpoints */}
            <style>{`
                @media (max-width: 1100px) {
                    .sk-card[style*="span 8"] { grid-column: span 12 !important; }
                }
                @media (max-width: 720px) {
                    .sk-card { grid-column: span 12 !important; grid-row: auto !important; }
                }
            `}</style>
        </div>
    </>
);

export default Skeleton;
