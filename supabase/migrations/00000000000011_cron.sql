-- 0011: pg_cron (03-database.md §10). Dibungkus guard karena ekstensi hanya tersedia di beberapa image/plan.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
exception when insufficient_privilege then
  raise notice 'pg_cron tidak bisa diaktifkan oleh role saat ini; jadwalkan manual lewat Dashboard > Database > Cron';
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('run-due-recurrings', '5 17 * * *', $cron$select run_due_recurrings(null, null)$cron$);
    perform cron.schedule('cleanup-idempotency', '15 17 * * *', $cron$delete from idempotency_keys where expires_at < now()$cron$);
    perform cron.schedule('cleanup-rate-limits', '20 17 * * *', $cron$delete from rate_limit_counters where window_start < now() - interval '2 days'$cron$);
    perform cron.schedule('expire-invitations', '25 17 * * *', $cron$update household_invitations set status='expired' where status='pending' and expires_at < now()$cron$);
  else
    raise notice 'pg_cron tidak terpasang; jadwal dilewati. Aktifkan manual lalu jalankan ulang blok ini.';
  end if;
end $$;
