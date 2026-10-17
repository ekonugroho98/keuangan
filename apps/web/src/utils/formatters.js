export const fmtRp = (n) => `Rp ${(Number(n) || 0).toLocaleString("id")}`;

export const fmtDate = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("id", { day: "2-digit", month: "short", year: "numeric" });
};
