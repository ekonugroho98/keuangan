import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function usePiutang() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["piutang", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/piutang")),
        enabled: !!activeHouseholdId,
    });

    const piutang = query.data ?? [];
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["piutang", activeHouseholdId] });
    const invalidateMoney = () => {
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["summary"] });
    };

    const addPiutang = async (payload) => {
        const { total, remaining, from_account, ...rest } = payload;
        const opening_received = remaining !== undefined ? total - remaining : 0;
        const result = await unwrap(
            await api.POST("/v1/piutang", { body: { ...rest, total, opening_received, from_account: from_account || undefined } }),
        );
        invalidate();
        if (from_account) invalidateMoney();
        return result;
    };

    const editPiutang = async (id, payload) => {
        const result = await unwrap(await api.PATCH("/v1/piutang/{id}", { params: { path: { id } }, body: payload }));
        invalidate();
        return result;
    };

    const deletePiutang = async (id) => {
        await unwrap(await api.DELETE("/v1/piutang/{id}", { params: { path: { id } } }));
        invalidate();
    };

    const terimaPiutang = async (item, amount, accountName) => {
        const result = await unwrap(
            await api.POST("/v1/piutang/{id}/receipts", {
                params: { path: { id: item.id } },
                body: { amount, account: accountName },
            }),
        );
        invalidate();
        invalidateMoney();
        return result;
    };

    return { piutang, piutangLoading: query.isLoading, addPiutang, editPiutang, deletePiutang, terimaPiutang };
}
