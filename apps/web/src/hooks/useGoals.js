import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function useGoals() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["goals", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/goals")),
        enabled: !!activeHouseholdId,
    });

    const goals = query.data ?? [];
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["goals", activeHouseholdId] });
    const invalidateMoney = () => {
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["summary"] });
    };

    const addGoal = async (payload) => {
        const result = await unwrap(await api.POST("/v1/goals", { body: payload }));
        invalidate();
        return result;
    };

    const editGoal = async (id, payload) => {
        const result = await unwrap(await api.PATCH("/v1/goals/{id}", { params: { path: { id } }, body: payload }));
        invalidate();
        return result;
    };

    const deleteGoal = async (id) => {
        await unwrap(await api.DELETE("/v1/goals/{id}", { params: { path: { id } } }));
        invalidate();
    };

    const topupGoal = async (goalId, goal, amount, accountName) => {
        const result = await unwrap(
            await api.POST("/v1/goals/{id}/contributions", {
                params: { path: { id: goalId } },
                body: { amount, account: accountName || null },
            }),
        );
        invalidate();
        if (accountName) invalidateMoney();
        return result;
    };

    return { goals, goalsLoading: query.isLoading, addGoal, editGoal, deleteGoal, topupGoal };
}
