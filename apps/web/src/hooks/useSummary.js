import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

/**
 * GET /v1/summary (Fase 5, scope=household|member|account) — belum dikonsumsi di frontend
 * sebelumnya. Dipakai bersama <ScopeSwitcher> untuk menampilkan ringkasan per-anggota/per-akun
 * TAMBAHAN di samping kartu household-wide yang sudah ada (arsitektur lama tetap dipertahankan,
 * lihat catatan di useTransactions.js).
 */
export function useSummary({ period = "this_month", scope = "household", member, account } = {}) {
    const { activeHouseholdId } = useHousehold();

    const query = useQuery({
        queryKey: ["summary", activeHouseholdId, period, scope, member, account],
        queryFn: async () =>
            unwrap(
                await api.GET("/v1/summary", {
                    params: { query: { period, scope, member: member || undefined, account: account || undefined } },
                }),
            ),
        enabled: !!activeHouseholdId && (scope === "household" || !!member || !!account),
    });

    return { summary: query.data ?? null, summaryLoading: query.isLoading, summaryError: query.error };
}
