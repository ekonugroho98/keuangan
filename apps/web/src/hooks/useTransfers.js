import { useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";

export function useTransfers() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const addTransfer = async ({ amount, from_account, to_account, date, note, receipt_url }) => {
        const result = await unwrap(
            await api.POST("/v1/transfers", {
                body: {
                    amount,
                    from_account,
                    to_account,
                    date,
                    note,
                    receipt_url: receipt_url || undefined,
                },
            }),
        );
        queryClient.invalidateQueries({ queryKey: ["transactions", activeHouseholdId] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["summary"] });
        return result;
    };

    return { addTransfer };
}
