import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function useHouseholdInfo() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["household-current", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/households/current")),
        enabled: !!activeHouseholdId,
    });

    const updateHouseholdInfo = async (patch) => {
        const result = await unwrap(await api.PATCH("/v1/households/current", { body: patch }));
        queryClient.invalidateQueries({ queryKey: ["household-current", activeHouseholdId] });
        queryClient.invalidateQueries({ queryKey: ["me"] });
        return result;
    };

    return { household: query.data ?? null, householdLoading: query.isLoading, updateHouseholdInfo };
}
