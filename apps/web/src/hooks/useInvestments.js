import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";
import { useMembers } from "./useMembers";

const DEFAULT_ICONS = {
    reksa_dana: "📊", saham: "📈", emas: "🥇", crypto: "₿",
    deposito: "🏦", properti: "🏠", obligasi: "📜", lainnya: "💼",
};
const DEFAULT_COLORS = {
    reksa_dana: "#839B7A", saham: "#46634E", emas: "#D9A74A", crypto: "#f97316",
    deposito: "#4FC3F7", properti: "#C87D55", obligasi: "#ec4899", lainnya: "#7D513B",
};

function normalizeInvestment(inv, members) {
    const type = inv.type || "lainnya";
    let owner = inv.owner ?? null;
    if (!owner && inv.owner_member_id) {
        const matched = members.find((m) => m.id === inv.owner_member_id);
        owner = { member_id: inv.owner_member_id, display_name: matched?.display_name || inv.owner_display_name || null };
    } else if (owner && !owner.display_name && owner.member_id) {
        const matched = members.find((m) => m.id === owner.member_id);
        if (matched?.display_name) owner = { ...owner, display_name: matched.display_name };
    }
    return {
        ...inv,
        buy_price: Number(inv.buy_price) || 0,
        current_value: Number(inv.current_value) || 0,
        quantity: inv.quantity != null && inv.quantity !== "" ? Number(inv.quantity) : null,
        icon: inv.icon || DEFAULT_ICONS[type] || "📊",
        color: inv.color || DEFAULT_COLORS[type] || "#839B7A",
        owner,
    };
}

export function useInvestments() {
    const { activeHouseholdId } = useHousehold();
    const { members } = useMembers();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["investments", activeHouseholdId],
        queryFn: async () => unwrap(await api.GET("/v1/investments")),
        enabled: !!activeHouseholdId,
    });

    const investments = (query.data ?? []).map((inv) => normalizeInvestment(inv, members));
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["investments", activeHouseholdId] });

    const addInvestment = async (payload) => {
        const result = await unwrap(await api.POST("/v1/investments", { body: payload }));
        invalidate();
        return result;
    };

    const editInvestment = async (id, payload) => {
        const result = await unwrap(await api.PATCH("/v1/investments/{id}", { params: { path: { id } }, body: payload }));
        invalidate();
        return result;
    };

    const deleteInvestment = async (id) => {
        await unwrap(await api.DELETE("/v1/investments/{id}", { params: { path: { id } } }));
        invalidate();
    };

    return { investments, investmentsLoading: query.isLoading, addInvestment, editInvestment, deleteInvestment };
}
