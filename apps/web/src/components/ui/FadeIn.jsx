import useInView from "../../hooks/useInView";

const FadeIn = ({ children, delay = 0, direction = "up" }) => {
    const [ref, inView] = useInView();
    const transforms = {
        up: "translate3d(0, 24px, 0)",
        down: "translate3d(0, -24px, 0)",
        left: "translate3d(24px, 0, 0)",
        right: "translate3d(-24px, 0, 0)",
        none: "translate3d(0, 0, 0)",
    };
    return (
        <div
            ref={ref}
            style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translate3d(0, 0, 0)" : transforms[direction],
                transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
            }}
        >
            {children}
        </div>
    );
};

export default FadeIn;
