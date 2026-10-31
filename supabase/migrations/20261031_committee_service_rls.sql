-- Ensure service_role can read/write even if BYPASSRLS is unavailable for the key in use.
grant all on table public.committee_members to service_role;

drop policy if exists committee_members_service_all on public.committee_members;
create policy committee_members_service_all
  on public.committee_members
  for all
  to service_role
  using (true)
  with check (true);
