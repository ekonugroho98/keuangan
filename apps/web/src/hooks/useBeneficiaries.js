import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

/** F-A "untuk siapa" (10-fitur-opsional-keluarga.md §3) — hanya aktif kalau features.beneficiary.enabled. */
export function useBeneficiaries(enabled = true) {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["beneficiaries", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/beneficiaries")),
        enabled: !!activeHouseholdId && enabled,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["beneficiaries", activeHouseholdId] });

    const addBeneficiary = async ({ name, kind, aliases }) => {
        const result = await unwrap(await api.POST("/v1/beneficiaries", { body: { name, kind: kind || "other", aliases: aliases || [] } }));
        invalidate();
        return result;
    };

    return { beneficiaries: query.data ?? [], beneficiariesLoading: query.isLoading, addBeneficiary };
}
