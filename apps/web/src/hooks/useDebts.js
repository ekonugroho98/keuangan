import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function useDebts() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["debts", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/debts", { params: { query: { status: "all" } } })),
        enabled: !!activeHouseholdId,
    });

    const debts = query.data ?? [];
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["debts", activeHouseholdId] });
    const invalidateMoney = () => {
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["summary"] });
    };

    const addDebt = async (payload) => {
        const result = await unwrap(await api.POST("/v1/debts", { body: payload }));
        invalidate();
        return result;
    };

    const editDebt = async (id, payload) => {
        const result = await unwrap(await api.PATCH("/v1/debts/{id}", { params: { path: { id } }, body: payload }));
        invalidate();
        return result;
    };

    const deleteDebt = async (id) => {
        await unwrap(await api.DELETE("/v1/debts/{id}", { params: { path: { id } } }));
        invalidate();
    };

    const payDebt = async (debt, amount, accountName) => {
        const result = await unwrap(
            await api.POST("/v1/debts/{id}/payments", {
                params: { path: { id: debt.id } },
                body: { amount, account: accountName },
            }),
        );
        invalidate();
        invalidateMoney();
        return result;
    };

    return { debts, debtsLoading: query.isLoading, addDebt, editDebt, deleteDebt, payDebt };
}
