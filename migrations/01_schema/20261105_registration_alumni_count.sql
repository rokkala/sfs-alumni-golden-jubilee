-- How many alumni (people) vs accompanying guests in a registration.
-- number_of_guests remains total attending (people + guests).
alter table public.event_registrations
  add column if not exists alumni_count integer not null default 1;

alter table public.event_registrations drop constraint if exists event_registrations_alumni_count_check;
alter table public.event_registrations
  add constraint event_registrations_alumni_count_check check (alumni_count >= 0);
