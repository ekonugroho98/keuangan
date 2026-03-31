import { useState, useEffect } from "react";
import useInView from "../../hooks/useInView";

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
    return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

export default CountUp;
