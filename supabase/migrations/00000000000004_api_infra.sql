-- 0004: infrastruktur API key, idempotency, rate limit, audit log (03-database.md §3.15-3.19)

create table api_keys (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  member_id      uuid not null references household_members(id),
  name           text not null check (length(name) between 1 and 60),
  key_prefix     text not null,
  key_hash       bytea not null unique,
  scope          api_key_scope not null default 'write',
  expires_at     timestamptz,
  last_used_at   timestamptz,
  last_used_ip   inet,
  revoked_at     timestamptz,
  created_by     uuid not null references household_members(id),
  created_at     timestamptz not null default now()
);
create index api_keys_prefix_idx on api_keys (key_prefix) where revoked_at is null;
comment on table api_keys is 'Kunci jangka panjang untuk agent. Full key hanya dikembalikan sekali saat POST /v1/api-keys.';

create table idempotency_keys (
  credential_type  credential_type not null,
  credential_id    uuid not null,
  key              text not null check (length(key) between 1 and 128),
  request_hash     bytea not null,
  status           text not null check (status in ('in_progress','completed')),
  response_status  int,
  response_body    jsonb,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '24 hours',
  primary key (credential_type, credential_id, key)
);
create index idempotency_expires_idx on idempotency_keys (expires_at);

create table rate_limit_counters (
  api_key_id    uuid not null references api_keys(id) on delete cascade,
  window_kind   text not null check (window_kind in ('minute','day')),
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (api_key_id, window_kind, window_start)
);

create table audit_log (
  id               bigserial primary key,
  household_id     uuid references households(id) on delete cascade,
  actor_member_id  uuid references household_members(id),
  credential_type  credential_type not null,
  api_key_id       uuid references api_keys(id) on delete set null,
  request_id       text not null,
  idempotency_key  text,
  action           text not null,
  resource_type    text,
  resource_id      uuid,
  http_status      int not null,
  payload          jsonb,
  ip               inet,
  user_agent       text,
  created_at       timestamptz not null default now()
);
create index audit_log_household_time_idx on audit_log (household_id, created_at desc);
create index audit_log_api_key_idx on audit_log (api_key_id, created_at desc) where api_key_id is not null;

create table migration_issues (
  id          bigserial primary key,
  phase       text not null,
  table_name  text not null,
  row_id      uuid,
  issue       text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
