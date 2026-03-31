import { useState, useEffect, useRef } from "react";

const useInView = (threshold = 0.15) => {
    const [inView, setInView] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setInView(true); obs.unobserve(el); } },
            { threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return [ref, inView];
};

export default useInView;
