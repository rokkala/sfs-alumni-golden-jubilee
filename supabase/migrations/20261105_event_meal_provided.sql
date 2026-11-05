-- Explicit lunch/dinner provided flags (₹0 can still mean free meal for reporting).
alter table public.event_catalog
  add column if not exists lunch_provided boolean not null default false;

alter table public.event_catalog
  add column if not exists dinner_provided boolean not null default false;

-- Backfill: priced meals are treated as provided.
update public.event_catalog
set lunch_provided = true
where lunch_provided = false
  and (
    coalesce(lunch_paise, 0) > 0
    or coalesce(lunch_nonveg_paise, 0) > 0
  );

update public.event_catalog
set dinner_provided = true
where dinner_provided = false
  and (
    coalesce(dinner_paise, 0) > 0
    or coalesce(dinner_nonveg_paise, 0) > 0
  );

comment on column public.event_catalog.lunch_provided is
  'When true, registration collects lunch + veg/non-veg even if lunch rates are ₹0.';
comment on column public.event_catalog.dinner_provided is
  'When true, registration collects dinner + veg/non-veg even if dinner rates are ₹0.';
