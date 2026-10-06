import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

/**
 * GET /v1/budgets hanya mengembalikan anggaran SATU bulan (default bulan berjalan), beda dari
 * tabel lama yang diambil sekaligus semua bulan. AnggaranView.jsx butuh rentang bulan (dropdown
 * -12..+12 bulan, lihat AnggaranView.jsx) untuk filter + fitur "salin dari bulan lalu", jadi di
 * sini kita ambil paralel untuk rentang bulan yang sama persis dengan dropdown-nya supaya
 * AnggaranView.jsx tidak perlu diubah sama sekali.
 */
function monthRange() {
    const result = [];
    const now = new Date();
    for (let i = -12; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return result;
}

export function useBudgets() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();
    const months = useMemo(monthRange, []);

    const results = useQueries({
        queries: months.map((month) => ({
            queryKey: ["budgets", activeHouseholdId, month],
            // API mengembalikan category sebagai object {id,name} dan period_start (tanggal), bukan
            // `category`/`month` string datar seperti tabel lama — diratakan di sini supaya
            // AnggaranView.jsx (yang pakai b.category & b.month sebagai string) tidak perlu diubah.
            queryFn: async () => {
                const rows = await unwrap(await api.GET("/v1/budgets", { params: { query: { month } } }));
                return rows.map((b) => ({ ...b, category_id: b.category.id, category: b.category.name, month }));
            },
            enabled: !!activeHouseholdId,
        })),
    });

    // Anggaran pribadi (scope=member, default diri sendiri) — dipakai tab "Pribadi" di
    // AnggaranView.jsx (F5-T5). Query terpisah, tidak mengubah bentuk `budgets` lama sama sekali.
    const personalResults = useQueries({
        queries: months.map((month) => ({
            queryKey: ["budgets-personal", activeHouseholdId, month],
            queryFn: async () => {
                const rows = await unwrap(await api.GET("/v1/budgets", { params: { query: { month, scope: "member" } } }));
                return rows.map((b) => ({ ...b, category_id: b.category.id, category: b.category.name, month }));
            },
            enabled: !!activeHouseholdId,
        })),
    });

    const budgets = results.flatMap((r) => r.data ?? []);
    const budgetsLoading = results.some((r) => r.isLoading);
    const personalBudgets = personalResults.flatMap((r) => r.data ?? []);
    const personalBudgetsLoading = personalResults.some((r) => r.isLoading);
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["budgets", activeHouseholdId] });
        queryClient.invalidateQueries({ queryKey: ["budgets-personal", activeHouseholdId] });
    };

    const addBudget = async (payload) => {
        await unwrap(await api.POST("/v1/budgets", { body: payload }));
        invalidate();
    };

    const editBudget = async (id, payload) => {
        await unwrap(await api.PATCH("/v1/budgets/{id}", { params: { path: { id } }, body: { amount: payload.amount } }));
        invalidate();
    };

    const deleteBudget = async (id) => {
        await unwrap(await api.DELETE("/v1/budgets/{id}", { params: { path: { id } } }));
        invalidate();
    };

    const copyBudgetMonth = async (prevBudgets, targetMonth) => {
        const fromMonth = prevBudgets[0]?.month;
        if (!fromMonth) return;
        await unwrap(await api.POST("/v1/budgets/copy", { body: { from_month: fromMonth, to_month: targetMonth } }));
        invalidate();
    };

    return { budgets, budgetsLoading, personalBudgets, personalBudgetsLoading, addBudget, editBudget, deleteBudget, copyBudgetMonth };
}
