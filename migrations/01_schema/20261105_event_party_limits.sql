-- Min/max party size (people attending) per event. Min may be 0.
alter table public.event_catalog
  add column if not exists party_min integer not null default 1,
  add column if not exists party_max integer not null default 20;

alter table public.event_catalog drop constraint if exists event_catalog_party_min_check;
alter table public.event_catalog drop constraint if exists event_catalog_party_max_check;
alter table public.event_catalog drop constraint if exists event_catalog_party_bounds_check;

alter table public.event_catalog
  add constraint event_catalog_party_min_check check (party_min >= 0),
  add constraint event_catalog_party_max_check check (party_max >= 0),
  add constraint event_catalog_party_bounds_check check (party_min <= party_max);
