import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";
import { incomeCategories } from "../constants/categories";

// `icon` ikut lewat di `rest` tapi recurring_transactions tidak punya kolom icon (ikon di UI
// berasal dari kategori) — zod di apps/api mengabaikan field tak dikenal, jadi aman dibiarkan.
function toApiPayload({ account_name, category, ...rest }) {
    return { ...rest, category, account: account_name || undefined };
}

export function useRecurrings() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["recurrings", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/recurrings")),
        enabled: !!activeHouseholdId,
    });

    const recurrings = (query.data ?? []).map((r) => ({
        ...r,
        category: r.category?.name ?? r.category,
        account_name: r.account?.name ?? r.account_name,
    }));
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["recurrings", activeHouseholdId] });

    const addRecurring = async (form) => {
        const type = incomeCategories.includes(form.category) ? "income" : "expense";
        const result = await unwrap(await api.POST("/v1/recurrings", { body: { ...toApiPayload(form), type } }));
        invalidate();
        return result;
    };

    const editRecurring = async (id, form) => {
        const result = await unwrap(await api.PATCH("/v1/recurrings/{id}", { params: { path: { id } }, body: toApiPayload(form) }));
        invalidate();
        return result;
    };

    const deleteRecurring = async (id) => {
        await unwrap(await api.DELETE("/v1/recurrings/{id}", { params: { path: { id } } }));
        invalidate();
    };

    /**
     * pg_cron belum aktif di produksi sampai Fase 5 (F5-T7), jadi dasbor masih memanggil endpoint
     * ini sekali saat mount sebagai fallback — sama seperti edge function auto-recurrings lama.
     */
    const runDueRecurrings = async () => {
        const result = await unwrap(await api.POST("/v1/recurrings/run", { body: {} }));
        if (result.executed > 0) {
            invalidate();
            queryClient.invalidateQueries({ queryKey: ["accounts"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            queryClient.invalidateQueries({ queryKey: ["debts"] });
            queryClient.invalidateQueries({ queryKey: ["summary"] });
        }
        return result;
    };

    return { recurrings, recurringsLoading: query.isLoading, addRecurring, editRecurring, deleteRecurring, runDueRecurrings };
}
