-- Per-guest registration fee (accompanying attendees beyond the alumnus).
alter table public.event_catalog
  add column if not exists guest_fee_paise integer not null default 0;

alter table public.event_catalog drop constraint if exists event_catalog_guest_fee_paise_check;
alter table public.event_catalog
  add constraint event_catalog_guest_fee_paise_check check (guest_fee_paise >= 0);
