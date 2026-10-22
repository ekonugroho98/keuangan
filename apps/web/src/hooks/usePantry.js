import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

const LOCATIONS = [
    { value: "fridge", label: "Kulkas", icon: "🧊" },
    { value: "freezer", label: "Freezer", icon: "❄️" },
    { value: "shelf", label: "Lemari & Dapur", icon: "🗄️" },
    { value: "other", label: "Rumah Lainnya", icon: "📦" },
];
export { LOCATIONS };

/** F-D (10-fitur-opsional-keluarga.md §6). */
export function usePantry(enabled = true) {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["pantry", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/pantry")),
        enabled: !!activeHouseholdId && enabled,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pantry", activeHouseholdId] });

    const addItem = async (payload) => {
        const result = await unwrap(await api.POST("/v1/pantry", { body: payload }));
        invalidate();
        return result;
    };

    const updateItem = async (id, payload) => {
        const result = await unwrap(await api.PATCH("/v1/pantry/{id}", { params: { path: { id } }, body: payload }));
        invalidate();
        return result;
    };

    const deleteItem = async (id) => {
        await unwrap(await api.DELETE("/v1/pantry/{id}", { params: { path: { id } } }));
        invalidate();
    };

    const addMovement = async (id, { delta, reason, note }) => {
        const result = await unwrap(await api.POST("/v1/pantry/{id}/movements", { params: { path: { id } }, body: { delta, reason, note: note || "" } }));
        invalidate();
        return result;
    };

    const syncPurchases = async (period = "this_month") => {
        const result = await unwrap(await api.POST("/v1/pantry/sync-purchases", { body: { period } }));
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["pantry-expiring", activeHouseholdId] });
        return result;
    };

    return { items: query.data ?? [], pantryLoading: query.isLoading, addItem, updateItem, deleteItem, addMovement, syncPurchases };
}

export function usePantryExpiring(withinDays = 3, enabled = true) {
    const { activeHouseholdId } = useHousehold();
    const query = useQuery({
        queryKey: ["pantry-expiring", activeHouseholdId, withinDays],
        queryFn: async () => unwrap(await api.GET("/v1/pantry/expiring", { params: { query: { within_days: withinDays } } })),
        enabled: !!activeHouseholdId && enabled,
    });
    return { expired: query.data?.expired ?? [], expiring: query.data?.expiring ?? [] };
}
