import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

/**
 * Pengganti akses langsung ke tabel accounts lewat Supabase client di Dashboard.jsx (07-frontend.md §3).
 * Bentuk balik `{ accounts, ... }` dipertahankan supaya Dashboard.jsx dan views lama butuh
 * perubahan minimal; field baru (owner, visibility, can_view, can_post) ikut tersedia untuk
 * komponen Fase 5 nanti.
 */
export function useAccounts() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["accounts", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/accounts", { params: { query: {} } })),
        enabled: !!activeHouseholdId,
    });

    const accounts = query.data?.data ?? [];
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["accounts", activeHouseholdId] });
    const invalidateMoney = () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["summary"] });
    };

    const addAccount = async ({ name, type, balance, owner, visibility, aliases }) => {
        const result = await unwrap(
            await api.POST("/v1/accounts", {
                body: {
                    name, type, opening_balance: parseInt(balance) || 0,
                    owner: owner ?? "me", visibility: visibility ?? "shared", aliases: aliases ?? [],
                },
            }),
        );
        invalidate();
        return result;
    };

    const updateAccount = async (id, patch) => {
        const result = await unwrap(await api.PATCH("/v1/accounts/{id}", { params: { path: { id } }, body: patch }));
        invalidate();
        return result;
    };

    const adjustBalance = async (accountId, newBalance) => {
        const result = await unwrap(
            await api.POST("/v1/accounts/{id}/adjust-balance", { params: { path: { id: accountId } }, body: { new_balance: newBalance } }),
        );
        invalidateMoney();
        return result;
    };

    return {
        accounts,
        accountsLoading: query.isLoading,
        totals: query.data?.totals ?? { visible_balance: 0, hidden_private_accounts: 0 },
        refetchAccounts: invalidate,
        addAccount,
        updateAccount,
        adjustBalance,
    };
}
