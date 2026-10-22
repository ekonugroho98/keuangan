import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

/** F-C Rekonsiliasi Mutasi Bank (10-fitur-opsional-keluarga.md §5). */
export function useReconciliation(enabled = true, accountId = undefined) {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const importsQuery = useQuery({
        queryKey: ["reconciliation-imports", activeHouseholdId, accountId || "all"],
        queryFn: async () => {
            const res = await unwrap(
                await api.GET("/v1/reconciliation/imports", {
                    params: accountId ? { query: { account_id: accountId } } : {},
                })
            );
            return res?.data ?? [];
        },
        enabled: !!activeHouseholdId && enabled,
    });

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ["reconciliation-imports", activeHouseholdId] });
        queryClient.invalidateQueries({ queryKey: ["reconciliation-detail", activeHouseholdId] });
    };

    const importStatement = async (payload) => {
        const result = await unwrap(await api.POST("/v1/reconciliation/imports", { body: payload }));
        invalidateAll();
        return result;
    };

    const scanStatementImage = async ({ image_base64, mime_type }) => {
        return unwrap(await api.POST("/v1/reconciliation/scan", { body: { image_base64, mime_type } }));
    };

    const confirmLine = async (lineId, transactionId) => {
        const res = await unwrap(
            await api.POST("/v1/reconciliation/lines/{id}/confirm", {
                params: { path: { id: lineId } },
                body: { transaction_id: transactionId },
            })
        );
        invalidateAll();
        return res;
    };

    const acceptLine = async (lineId, body = {}) => {
        const res = await unwrap(
            await api.POST("/v1/reconciliation/lines/{id}/accept", {
                params: { path: { id: lineId } },
                body,
            })
        );
        invalidateAll();
        queryClient.invalidateQueries({ queryKey: ["transactions", activeHouseholdId] });
        queryClient.invalidateQueries({ queryKey: ["accounts", activeHouseholdId] });
        queryClient.invalidateQueries({ queryKey: ["summary", activeHouseholdId] });
        return res;
    };

    const ignoreLine = async (lineId) => {
        const res = await unwrap(
            await api.POST("/v1/reconciliation/lines/{id}/ignore", {
                params: { path: { id: lineId } },
            })
        );
        invalidateAll();
        return res;
    };

    return {
        imports: importsQuery.data ?? [],
        importsLoading: importsQuery.isLoading,
        importStatement,
        scanStatementImage,
        confirmLine,
        acceptLine,
        ignoreLine,
        refreshImports: invalidateAll,
    };
}

export function useReconciliationDetail(importId, enabled = true) {
    const { activeHouseholdId } = useHousehold();
    const query = useQuery({
        queryKey: ["reconciliation-detail", activeHouseholdId, importId],
        queryFn: async () =>
            unwrap(
                await api.GET("/v1/reconciliation/imports/{id}", {
                    params: { path: { id: importId } },
                })
            ),
        enabled: !!activeHouseholdId && !!importId && enabled,
    });

    return {
        detail: query.data ?? null,
        detailLoading: query.isLoading,
        refetchDetail: query.refetch,
    };
}
