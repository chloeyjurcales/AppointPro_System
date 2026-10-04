-- Lets each notification remember who sent it, so the app can show the
-- sender's real name and profile picture. Safe to run more than once.
alter table public.notifications
  add column if not exists sender_id uuid references public.profiles(id) on delete set null;
