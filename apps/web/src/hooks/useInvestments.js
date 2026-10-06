import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function useInvestments() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["investments", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/investments")),
        enabled: !!activeHouseholdId,
    });

    const investments = query.data ?? [];
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["investments", activeHouseholdId] });

    const addInvestment = async (payload) => {
        const result = await unwrap(await api.POST("/v1/investments", { body: payload }));
        invalidate();
        return result;
    };

    const editInvestment = async (id, payload) => {
        const result = await unwrap(await api.PATCH("/v1/investments/{id}", { params: { path: { id } }, body: payload }));
        invalidate();
        return result;
    };

    const deleteInvestment = async (id) => {
        await unwrap(await api.DELETE("/v1/investments/{id}", { params: { path: { id } } }));
        invalidate();
    };

    return { investments, investmentsLoading: query.isLoading, addInvestment, editInvestment, deleteInvestment };
}
