import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function useMembers() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["members", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/members")),
        enabled: !!activeHouseholdId,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["members", activeHouseholdId] });

    const updateMember = async (id, patch) => {
        const result = await unwrap(await api.PATCH("/v1/members/{id}", { params: { path: { id } }, body: patch }));
        invalidate();
        return result;
    };

    const removeMember = async (id, reassignToMemberId) => {
        await unwrap(
            await api.DELETE("/v1/members/{id}", {
                params: { path: { id }, query: reassignToMemberId ? { reassign_to_member_id: reassignToMemberId } : {} },
            }),
        );
        invalidate();
    };

    const leaveHousehold = async (reassignToMemberId) => {
        await unwrap(
            await api.POST("/v1/members/me/leave", {
                params: { query: reassignToMemberId ? { reassign_to_member_id: reassignToMemberId } : {} },
            }),
        );
        queryClient.invalidateQueries({ queryKey: ["me"] });
    };

    return { members: query.data ?? [], membersLoading: query.isLoading, updateMember, removeMember, leaveHousehold };
}
