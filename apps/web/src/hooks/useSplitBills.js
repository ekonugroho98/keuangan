import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function useSplitBills() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["split-bills", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/split-bills")),
        enabled: !!activeHouseholdId,
    });

    const splitBills = query.data ?? [];
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["split-bills", activeHouseholdId] });

    const addSplitBill = async (payload) => {
        const result = await unwrap(await api.POST("/v1/split-bills", { body: payload }));
        invalidate();
        return result;
    };

    const deleteSplitBill = async (id) => {
        await unwrap(await api.DELETE("/v1/split-bills/{id}", { params: { path: { id } } }));
        invalidate();
    };

    const toggleMemberPaid = async (memberId, paid) => {
        const bill = splitBills.find((b) => (b.members || []).some((m) => m.id === memberId));
        if (!bill) return;
        await unwrap(
            await api.PATCH("/v1/split-bills/{id}/members/{member_id}", {
                params: { path: { id: bill.id, member_id: memberId } },
                body: { paid },
            }),
        );
        invalidate();
    };

    return { splitBills, splitBillsLoading: query.isLoading, addSplitBill, deleteSplitBill, toggleMemberPaid };
}
