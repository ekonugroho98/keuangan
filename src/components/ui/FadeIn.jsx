import useInView from "../../hooks/useInView";

const FadeIn = ({ children, delay = 0, direction = "up" }) => {
    const [ref, inView] = useInView();
    const transforms = {
        up: "translateY(40px)", down: "translateY(-40px)",
        left: "translateX(40px)", right: "translateX(-40px)", none: "none",
    };
    return (
        <div ref={ref} style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "none" : transforms[direction],
            transition: `all 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
        }}>
            {children}
        </div>
    );
};

export default FadeIn;
