-- Run once in the Supabase SQL Editor to remove the Google Calendar feature
-- from the database. Safe to re-run (everything uses IF EXISTS).

drop trigger if exists sync_google_calendar_event_trigger on public.appointments;
drop function if exists public.call_sync_google_calendar_event();

alter table public.appointments
  drop column if exists google_event_id_student,
  drop column if exists google_event_id_faculty;

drop table if exists public.google_calendar_accounts;

-- The pg_net extension is left installed in case anything else uses it.
