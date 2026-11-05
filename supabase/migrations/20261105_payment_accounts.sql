-- Offline bank / UPI payment accounts + proof-of-payment for committee verification.
-- Service role only (app uses createAdminClient).

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  account_name text not null,
  account_number text not null,
  ifsc text not null,
  bank_name text,
  upi_id text,
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active account (partial unique index on constant).
create unique index if not exists idx_payment_accounts_one_active
  on public.payment_accounts ((1))
  where active;

create index if not exists idx_payment_accounts_sort
  on public.payment_accounts (sort_order, label);

create table if not exists public.offline_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('registration', 'donation')),
  registration_id uuid references public.event_registrations (id) on delete cascade,
  donation_id uuid references public.donations (id) on delete cascade,
  account_id uuid not null references public.alumni_accounts (id) on delete restrict,
  payment_account_id uuid references public.payment_accounts (id) on delete set null,
  amount_paise integer not null check (amount_paise >= 100),
  utr text,
  screenshot_path text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.alumni_accounts (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offline_proof_source_xor check (
    (source_type = 'registration' and registration_id is not null and donation_id is null)
    or (source_type = 'donation' and donation_id is not null and registration_id is null)
  )
);

create index if not exists idx_offline_proofs_status_created
  on public.offline_payment_proofs (status, created_at desc);

create index if not exists idx_offline_proofs_registration
  on public.offline_payment_proofs (registration_id)
  where registration_id is not null;

create index if not exists idx_offline_proofs_donation
  on public.offline_payment_proofs (donation_id)
  where donation_id is not null;

alter table public.payment_accounts enable row level security;
alter table public.offline_payment_proofs enable row level security;

revoke all on table public.payment_accounts from anon, authenticated;
revoke all on table public.offline_payment_proofs from anon, authenticated;
grant all on table public.payment_accounts to service_role;
grant all on table public.offline_payment_proofs to service_role;

-- Private bucket for payment screenshots (create in Dashboard if insert denied).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  4000000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
