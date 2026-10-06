import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function useInvitations() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["invitations", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/invitations")),
        enabled: !!activeHouseholdId,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["invitations", activeHouseholdId] });

    const createInvitation = async ({ email, role, display_name_suggestion }) => {
        const result = await unwrap(
            await api.POST("/v1/invitations", { body: { email: email || undefined, role, display_name_suggestion: display_name_suggestion || undefined } }),
        );
        invalidate();
        return result;
    };

    const revokeInvitation = async (id) => {
        await unwrap(await api.DELETE("/v1/invitations/{id}", { params: { path: { id } } }));
        invalidate();
    };

    return { invitations: query.data ?? [], invitationsLoading: query.isLoading, createInvitation, revokeInvitation };
}

/** Tanpa household aktif — dipakai JoinHouseholdPage (preview publik + accept). */
export async function previewInvitationApi(code) {
    return unwrap(await api.GET("/v1/invitations/{code}", { params: { path: { code } } }));
}

export async function acceptInvitationApi(code, { display_name, mode }) {
    return unwrap(await api.POST("/v1/invitations/{code}/accept", { params: { path: { code } }, body: { display_name, mode } }));
}
