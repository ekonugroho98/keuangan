import { useState, useEffect } from "react";
import useInView from "../../hooks/useInView";

/**
 * CountUp — animates 0 → end once the element scrolls into view.
 * Prop signature preserved: { end, suffix }
 * Adds num-tight / mono typography for consistency with money values.
 */
const CountUp = ({ end, suffix = "" }) => {
    const [val, setVal] = useState(0);
    const [ref, inView] = useInView();

    useEffect(() => {
        if (!inView) return;
        let s = 0;
        const t = setInterval(() => {
            s++;
            setVal(s);
            if (s >= end) clearInterval(t);
        }, 2000 / end);
        return () => clearInterval(t);
    }, [inView, end]);

    return (
        <span
            ref={ref}
            className="num-tight mono"
            style={{
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-.02em",
                display: "inline-block",
            }}
        >
            {val.toLocaleString()}
            {suffix}
        </span>
    );
};

export default CountUp;
