import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setActiveHouseholdId, unwrap } from "../api/client";

/**
 * HouseholdProvider (07-frontend.md §4): memuat /v1/me, menyimpan memberships dan household aktif,
 * dan mensinkronkan ke api/client.js supaya header X-Household-Id ikut setiap request berikutnya.
 * Dipasang di atas <Dashboard> di App.jsx, SETELAH session Supabase ada.
 */
const HouseholdContext = createContext(null);

export function useHousehold() {
    const ctx = useContext(HouseholdContext);
    if (!ctx) throw new Error("useHousehold harus dipakai di dalam <HouseholdProvider>");
    return ctx;
}

export function HouseholdProvider({ children }) {
    const queryClient = useQueryClient();
    const [activeHouseholdId, setActiveHouseholdIdState] = useState(null);

    const meQuery = useQuery({
        queryKey: ["me"],
        queryFn: async () => unwrap(await api.GET("/v1/me")),
        staleTime: 5 * 60_000,
    });

    useEffect(() => {
        if (!meQuery.data) return;
        const preferred =
            meQuery.data.active_household_id &&
            meQuery.data.memberships.some((m) => m.household_id === meQuery.data.active_household_id)
                ? meQuery.data.active_household_id
                : meQuery.data.memberships[0]?.household_id ?? null;
        setActiveHouseholdIdState(preferred);
        setActiveHouseholdId(preferred ?? undefined);
    }, [meQuery.data]);

    const switchHousehold = async (householdId) => {
        setActiveHouseholdIdState(householdId);
        setActiveHouseholdId(householdId);
        await queryClient.invalidateQueries();
        try {
            await unwrap(await api.PATCH("/v1/me/settings", { body: { active_household_id: householdId } }));
        } catch {
            // best-effort: kegagalan simpan preferensi tidak boleh memblokir pemakaian household yang baru dipilih
        }
    };

    const activeMember = useMemo(() => {
        if (!meQuery.data || !activeHouseholdId) return null;
        return meQuery.data.memberships.find((m) => m.household_id === activeHouseholdId) ?? null;
    }, [meQuery.data, activeHouseholdId]);

    const value = useMemo(
        () => ({
            isLoading: meQuery.isLoading,
            isError: meQuery.isError,
            error: meQuery.error,
            me: meQuery.data ?? null,
            memberships: meQuery.data?.memberships ?? [],
            hasHousehold: (meQuery.data?.memberships?.length ?? 0) > 0,
            activeHouseholdId,
            activeMember,
            switchHousehold,
            refetchMe: meQuery.refetch,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [meQuery.isLoading, meQuery.isError, meQuery.error, meQuery.data, activeHouseholdId, activeMember],
    );

    return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}
