import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

/** F-D (10-fitur-opsional-keluarga.md §6) — hanya aktif kalau features.shopping_stock.enabled;
 * kalau mati, GET /v1/shopping balas 403 feature_disabled dan query ini diam (enabled:false lewat caller). */
export function useShopping(enabled = true) {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["shopping", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/shopping", { params: { query: { status: "needed" } } })),
        enabled: !!activeHouseholdId && enabled,
    });

    const boughtQuery = useQuery({
        queryKey: ["shopping", activeHouseholdId, "bought"],
        queryFn: async () => unwrap(await api.GET("/v1/shopping", { params: { query: { status: "bought" } } })),
        enabled: !!activeHouseholdId && enabled,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["shopping", activeHouseholdId] });

    const addItem = async ({ name, qty_text, notes }) => {
        const result = await unwrap(await api.POST("/v1/shopping", { body: { name, qty_text: qty_text || undefined, notes: notes || "" } }));
        invalidate();
        return result;
    };

    const updateItem = async (id, payload) => {
        const result = await unwrap(await api.PATCH("/v1/shopping/{id}", { params: { path: { id } }, body: payload }));
        invalidate();
        return result;
    };

    const markBought = async (id) => {
        await unwrap(await api.PATCH("/v1/shopping/{id}", { params: { path: { id } }, body: { status: "bought" } }));
        invalidate();
    };

    const markNeeded = async (id) => {
        await unwrap(await api.PATCH("/v1/shopping/{id}", { params: { path: { id } }, body: { status: "needed" } }));
        invalidate();
    };

    const deleteItem = async (id) => {
        await unwrap(await api.DELETE("/v1/shopping/{id}", { params: { path: { id } } }));
        invalidate();
    };

    return {
        needed: query.data ?? [],
        bought: boughtQuery.data ?? [],
        shoppingLoading: query.isLoading,
        addItem, updateItem, markBought, markNeeded, deleteItem,
    };
}

export function useShoppingSuggestions(enabled = true) {
    const { activeHouseholdId } = useHousehold();
    const query = useQuery({
        queryKey: ["shopping-suggestions", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/shopping/suggestions")),
        enabled: !!activeHouseholdId && enabled,
    });
    return { suggestions: query.data ?? [] };
}

/** Perbandingan harga antar toko dari riwayat struk household (GET /v1/prices/compare, per satuan). */
export async function comparePrices(q, days = 180) {
    return unwrap(await api.GET("/v1/prices/compare", { params: { query: { q, days } } }));
}

/** Koreksi manual: item struk ini = produk itu (POST /v1/prices/aliases). */
export async function mergeProducts(item, sameAs) {
    return unwrap(await api.POST("/v1/prices/aliases", { body: { item, same_as: sameAs } }));
}
