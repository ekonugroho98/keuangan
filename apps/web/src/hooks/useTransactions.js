import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../api/client";
import { useHousehold } from "../auth/HouseholdProvider";
import { categoryIcons } from "../constants/categories";

function flatten(tx) {
    return {
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        date: tx.date,
        note: tx.note,
        category: tx.category?.name,
        icon: tx.category?.icon || categoryIcons[tx.category?.name] || "📦",
        account_name: tx.account?.name,
        to_account_name: tx.to_account?.name,
        recorded_by: tx.recorded_by,
        source: tx.source,
        created_at: tx.created_at,
    };
}

/**
 * DasborView/LaporanView/PrediksiView menghitung agregat (bulan-ke-bulan, grafik, dsb.) langsung
 * dari seluruh riwayat transaksi di client (lihat DasborView.jsx) — bukan dari endpoint ringkasan
 * periode. GET /v1/transactions baru dipaginasi cursor (05-api.md §4.5), jadi di sini kita tarik
 * semua halaman sekaligus saat mount supaya bentuk `transactions` tetap array datar seperti dulu
 * dan view-view itu tidak perlu diubah.
 */
export function useTransactions() {
    const { activeHouseholdId } = useHousehold();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["transactions", activeHouseholdId],
        queryFn: async () => {
            const all = [];
            let cursor;
            do {
                const page = await unwrap(
                    await api.GET("/v1/transactions", { params: { query: { limit: 200, cursor } } }),
                );
                all.push(...page.data);
                cursor = page.has_more ? page.next_cursor : undefined;
            } while (cursor);
            return all;
        },
        enabled: !!activeHouseholdId,
    });

    const transactions = (query.data ?? []).map(flatten);
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["transactions", activeHouseholdId] });
    const invalidateMoney = () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["summary"] });
    };

    const addTx = async ({ type, amount, category, note, account, date }) => {
        const result = await unwrap(
            await api.POST("/v1/transactions", { body: { type, amount, category, note, account, date } }),
        );
        invalidateMoney();
        return { transaction: flatten(result.transaction), account: result.account };
    };

    const addMultipleTx = async (items, accountName, date) => {
        const result = await unwrap(
            await api.POST("/v1/transactions/batch", {
                body: { account: accountName, date, items: items.map((i) => ({ amount: i.amount, category: i.category, note: i.note })) },
            }),
        );
        invalidateMoney();
        return { transactions: result.transactions.map(flatten), account: result.account };
    };

    const editTx = async (id, { type, amount, category, note, account, date }) => {
        const result = await unwrap(
            await api.PATCH("/v1/transactions/{id}", { params: { path: { id } }, body: { type, amount, category, note, account, date } }),
        );
        invalidateMoney();
        return flatten(result);
    };

    const deleteTx = async (id) => {
        await unwrap(await api.DELETE("/v1/transactions/{id}", { params: { path: { id } } }));
        invalidateMoney();
    };

    return { transactions, transactionsLoading: query.isLoading, addTx, addMultipleTx, editTx, deleteTx };
}
