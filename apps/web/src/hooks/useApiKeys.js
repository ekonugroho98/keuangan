import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function useApiKeys() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["api-keys", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/api-keys")),
        enabled: !!activeHouseholdId,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["api-keys", activeHouseholdId] });

    const createApiKey = async ({ name, scope, member, expires_in_days }) => {
        const result = await unwrap(
            await api.POST("/v1/api-keys", { body: { name, scope, member: member || undefined, expires_in_days: expires_in_days || undefined } }),
        );
        invalidate();
        return result;
    };

    const revokeApiKey = async (id) => {
        await unwrap(await api.DELETE("/v1/api-keys/{id}", { params: { path: { id } } }));
        invalidate();
    };

    const rotateApiKey = async (id) => {
        const result = await unwrap(await api.POST("/v1/api-keys/{id}/rotate", { params: { path: { id } } }));
        invalidate();
        return result;
    };

    return { apiKeys: query.data ?? [], apiKeysLoading: query.isLoading, createApiKey, revokeApiKey, rotateApiKey };
}
