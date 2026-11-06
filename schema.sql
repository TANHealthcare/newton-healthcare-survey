-- TAN Healthcare • Newton County needs assessment
-- Run in a new Supabase project using the SQL Editor, before deploying the Edge Function.
-- Responses are NOT publicly readable or insertable; only the server function writes them.
-- Keep contact details in a separate table for voluntary follow-ups.

create table if not exists public.newton_survey_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists public.newton_survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  zip_code text not null check (zip_code ~ '^[0-9]{5}$'),
  age_group text not null,
  gender text not null,
  audience jsonb not null default '[]'::jsonb,
  services jsonb not null default '[]'::jsonb,
  services_other text not null default '',
  specialists jsonb not null default '[]'::jsonb,
  specialists_other text not null default '',
  barriers jsonb not null default '[]'::jsonb,
  barriers_other text not null default '',
  care_location text not null default '',
  travel_time text not null default '',
  delayed_care text not null default '',
  ideal_features jsonb not null default '[]'::jsonb,
  ideal_other text not null default '',
  telehealth_comfort text not null default '',
  priorities jsonb not null default '[]'::jsonb,
  priorities_other text not null default '',
  comments text not null default '',
  source text not null default '',
  staff_assisted boolean not null default false
);

create table if not exists public.newton_survey_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  consent boolean not null check (consent = true)
);

create index if not exists newton_survey_responses_zip on public.newton_survey_responses(zip_code);
create index if not exists newton_survey_responses_date on public.newton_survey_responses(created_at desc);

alter table public.newton_survey_staff enable row level security;
alter table public.newton_survey_responses enable row level security;
alter table public.newton_survey_contacts enable row level security;

-- Only approved authenticated staff should be able to SELECT. There is deliberately
-- no anonymous INSERT/UPDATE/DELETE grant on the private data tables.
revoke all on public.newton_survey_staff, public.newton_survey_responses, public.newton_survey_contacts from anon, authenticated;
grant select on public.newton_survey_staff, public.newton_survey_responses, public.newton_survey_contacts to authenticated;
grant all on public.newton_survey_staff, public.newton_survey_responses, public.newton_survey_contacts to service_role;

-- Staff list is edited only from Supabase SQL Editor / a privileged admin account.
-- Users can verify only their own inclusion in the list.
create policy "survey staff may view their own access"
  on public.newton_survey_staff for select to authenticated
  using (user_id = (select auth.uid()));

-- Explicit staff allow-list: not every authenticated Supabase user is an admin.
create policy "approved survey staff may read survey responses"
  on public.newton_survey_responses for select to authenticated
  using (exists (select 1 from public.newton_survey_staff
    where user_id = (select auth.uid())));

create policy "approved survey staff may read contact requests"
  on public.newton_survey_contacts for select to authenticated
  using (exists (select 1 from public.newton_survey_staff
    where user_id = (select auth.uid())));

-- Atomic write from an Edge Function using the server-side secret key.
-- No direct public insert or query policies exist for either private data table.
create or replace function public.store_newton_survey(
  p_response jsonb,
  p_contact jsonb default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.newton_survey_responses (
    zip_code,age_group,gender,audience,services,services_other,
    specialists,specialists_other,barriers,barriers_other,
    care_location,travel_time,delayed_care,ideal_features,ideal_other,
    telehealth_comfort,priorities,priorities_other,comments,source,staff_assisted
  ) values (
    p_response->>'zip_code',p_response->>'age_group',p_response->>'gender',
    coalesce(p_response->'audience','[]'::jsonb),
    coalesce(p_response->'services','[]'::jsonb),coalesce(p_response->>'services_other',''),
    coalesce(p_response->'specialists','[]'::jsonb),coalesce(p_response->>'specialists_other',''),
    coalesce(p_response->'barriers','[]'::jsonb),coalesce(p_response->>'barriers_other',''),
    coalesce(p_response->>'care_location',''),coalesce(p_response->>'travel_time',''),
    coalesce(p_response->>'delayed_care',''),coalesce(p_response->'ideal_features','[]'::jsonb),
    coalesce(p_response->>'ideal_other',''),coalesce(p_response->>'telehealth_comfort',''),
    coalesce(p_response->'priorities','[]'::jsonb),coalesce(p_response->>'priorities_other',''),
    coalesce(p_response->>'comments',''),coalesce(p_response->>'source',''),
    coalesce((p_response->>'staff_assisted')::boolean,false)
  ) returning id into v_id;

  if p_contact is not null then
    insert into public.newton_survey_contacts (name,phone,email,consent)
    values (
      coalesce(p_contact->>'name',''),coalesce(p_contact->>'phone',''),
      coalesce(p_contact->>'email',''),true
    );
  end if;
  return v_id;
end;$$;

revoke all on function public.store_newton_survey(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.store_newton_survey(jsonb,jsonb) to service_role;

-- AFTER creating a survey staff member in Supabase Auth, separately run:
-- insert into public.newton_survey_staff (user_id)
-- values ('AUTH-USER-UUID-FROM-SUPABASE-DASHBOARD');
-- Do not put credentials, staff IDs, or secret keys into GitHub files.
