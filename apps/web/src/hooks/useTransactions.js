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
        qty: tx.qty ?? null,
        unit_price: tx.unit_price ?? null,
        discount: tx.discount ?? 0,
        normal_unit_price: tx.normal_unit_price ?? null,
        total_size_label: tx.total_size_label ?? null,
        category: tx.category?.name,
        icon: tx.category?.icon || categoryIcons[tx.category?.name] || "📦",
        beneficiary: tx.beneficiary?.name ?? null, // F-A, 10-fitur-opsional-keluarga.md §3 — null = bersama
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
        queryClient.invalidateQueries({ queryKey: ["shopping"] });
        queryClient.invalidateQueries({ queryKey: ["prices"] });
    };

    const addTx = async ({ type, amount, category, note, account, date, beneficiary }) => {
        const result = await unwrap(
            // beneficiary HANYA dikirim kalau terisi (F-A, feature opsional) — field yang tidak
            // pernah disentuh harus tidak ada di body sama sekali, bukan string kosong, supaya
            // household yang belum mengaktifkan fitur ini tidak pernah memicu gate 400 di backend.
            await api.POST("/v1/transactions", { body: { type, amount, category, note, account, date, beneficiary: beneficiary || undefined } }),
        );
        invalidateMoney();
        return { transaction: flatten(result.transaction), account: result.account };
    };

    const addMultipleTx = async (items, accountName, date) => {
        const result = await unwrap(
            await api.POST("/v1/transactions/batch", {
                body: {
                    account: accountName,
                    date,
                    items: items.map((i) => ({
                        amount: i.amount,
                        qty: i.qty && Number(i.qty) > 0 ? Number(i.qty) : undefined,
                        discount: i.discount && Number(i.discount) > 0 ? Math.round(Number(i.discount)) : undefined,
                        category: i.category,
                        note: i.note,
                    })),
                },
            }),
        );
        invalidateMoney();
        return { transactions: result.transactions.map(flatten), account: result.account };
    };

    const editTx = async (id, { type, amount, category, note, account, date, beneficiary }) => {
        const body = {};
        if (type !== undefined) body.type = type;
        if (amount !== undefined) body.amount = amount;
        if (category !== undefined) body.category = category;
        if (note !== undefined) body.note = note;
        if (account !== undefined) body.account = account;
        if (date !== undefined) body.date = date;
        // `beneficiary` key HARUS tidak ada sama sekali di objek yang dioper kalau caller tidak
        // ikut mengirimnya (household belum aktifkan F-A) — beda dari string kosong ("" = user
        // sengaja pilih "Bersama" di form, yang justru WAJIB jadi beneficiary_id:null eksplisit
        // supaya backend tahu ini "kosongkan", bukan "jangan disentuh"). Caller (Dashboard.jsx)
        // yang memutuskan: hanya spread `beneficiary` ke argumen ini kalau fitur aktif.
        if (beneficiary !== undefined) {
            if (beneficiary) body.beneficiary = beneficiary;
            else body.beneficiary_id = null;
        }
        const result = await unwrap(
            await api.PATCH("/v1/transactions/{id}", { params: { path: { id } }, body }),
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
