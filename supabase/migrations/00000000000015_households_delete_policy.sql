-- Fase 4 (F4-T5): "Hapus akun" di Sidebar butuh DELETE /v1/me, yang menghapus household milik
-- actor (cascade ke semua tabel domain lewat household_id on delete cascade). Tabel households
-- sebelumnya hanya punya policy select+update, belum ada delete — tanpa ini owner tidak bisa
-- menghapus household miliknya sendiri lewat role `authenticated`.
create policy households_delete on households for delete using (member_role_in(id) = 'owner');
