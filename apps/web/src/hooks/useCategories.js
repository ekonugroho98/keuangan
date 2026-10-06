import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";
import { allCategories } from "../constants/categories";

const DEFAULT_NAMES = new Set(allCategories.map((n) => n.toLowerCase()));

/**
 * Backend (03-database.md §3.5) sekarang menyimpan SEMUA kategori per household — termasuk 14
 * kategori "default" yang dulu hardcode di constants/categories.js plus 5 kategori sistem
 * (Transfer, Koreksi Saldo, dst., tidak bisa dihapus/diubah tipenya). KategoriView lama
 * menggabungkan `categoryIcons` hardcode + `customCategories` dari DB; supaya tidak tampil dobel
 * dan kategori sistem tidak muncul di UI manajemen kategori, `customCategories` di sini HANYA
 * berisi kategori dari API yang namanya BUKAN salah satu default hardcode dan BUKAN is_system.
 */
export function useCategories() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["categories", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/categories", { params: { query: { type: "all" } } })),
        enabled: !!activeHouseholdId,
    });

    const allFromApi = query.data ?? [];
    const customCategories = allFromApi.filter(
        (c) => !c.is_system && !DEFAULT_NAMES.has(c.name.toLowerCase()),
    );
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories", activeHouseholdId] });

    const addCategory = async (form) => {
        await unwrap(
            await api.POST("/v1/categories", {
                body: { name: form.name.trim(), type: form.type, icon: form.icon, color: form.color },
            }),
        );
        invalidate();
    };

    const editCategory = async (id, form) => {
        await unwrap(
            await api.PATCH("/v1/categories/{id}", {
                params: { path: { id } },
                body: { name: form.name.trim(), icon: form.icon, color: form.color },
            }),
        );
        invalidate();
    };

    const deleteCategory = async (id) => {
        await unwrap(await api.DELETE("/v1/categories/{id}", { params: { path: { id } } }));
        invalidate();
    };

    return {
        customCategories,
        allCategoriesFromApi: allFromApi,
        categoriesLoading: query.isLoading,
        addCategory,
        editCategory,
        deleteCategory,
    };
}
