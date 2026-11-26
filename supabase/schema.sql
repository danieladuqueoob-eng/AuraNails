create extension if not exists pgcrypto;

create table if not exists public.manicurists (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  specialty text not null check (char_length(trim(specialty)) between 2 and 100),
  work_start_time time not null default '09:00',
  work_end_time time not null default '18:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint manicurists_work_hours_check check (work_start_time < work_end_time)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  manicurist_id uuid not null references public.manicurists (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text not null default '' check (char_length(description) <= 300),
  duration_minutes integer not null check (duration_minutes in (30, 60, 90, 120)),
  price numeric(10, 2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  manicurist_id uuid not null references public.manicurists (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  booked_service_name text not null check (char_length(booked_service_name) between 2 and 100),
  booked_price numeric(10, 2) not null check (booked_price >= 0),
  client_name text not null check (char_length(trim(client_name)) between 2 and 120),
  client_email text not null check (char_length(client_email) <= 254),
  client_phone text not null check (char_length(trim(client_phone)) between 5 and 40),
  design_notes text not null default '' check (char_length(design_notes) <= 1000),
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmada', 'rechazada')),
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint appointments_time_check check (start_time < end_time),
  constraint appointments_email_check check (client_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create index if not exists services_manicurist_active_idx
  on public.services (manicurist_id, is_active);
create index if not exists appointments_manicurist_date_time_idx
  on public.appointments (manicurist_id, appointment_date, start_time);
create index if not exists appointments_service_idx on public.appointments (service_id);

alter table public.manicurists enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "Public can view active manicurists" on public.manicurists;
create policy "Public can view active manicurists"
  on public.manicurists for select
  using (is_active or id = (select auth.uid()));

drop policy if exists "Manicurists can create their profile" on public.manicurists;
create policy "Manicurists can create their profile"
  on public.manicurists for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Manicurists can update their profile" on public.manicurists;
create policy "Manicurists can update their profile"
  on public.manicurists for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Public can view active services" on public.services;
create policy "Public can view active services"
  on public.services for select
  using (
    is_active and exists (
      select 1 from public.manicurists m
      where m.id = services.manicurist_id and m.is_active
    )
  );

drop policy if exists "Manicurists can manage their services" on public.services;
create policy "Manicurists can manage their services"
  on public.services for all to authenticated
  using (manicurist_id = (select auth.uid()))
  with check (manicurist_id = (select auth.uid()));

drop policy if exists "Anyone can request an appointment" on public.appointments;
create policy "Anyone can request an appointment"
  on public.appointments for insert to anon, authenticated
  with check (true);

drop policy if exists "Manicurists can view their appointments" on public.appointments;
create policy "Manicurists can view their appointments"
  on public.appointments for select to authenticated
  using (manicurist_id = (select auth.uid()));

drop policy if exists "Manicurists can update their appointments" on public.appointments;
create policy "Manicurists can update their appointments"
  on public.appointments for update to authenticated
  using (manicurist_id = (select auth.uid()))
  with check (manicurist_id = (select auth.uid()));

drop policy if exists "Manicurists can delete their appointments" on public.appointments;
create policy "Manicurists can delete their appointments"
  on public.appointments for delete to authenticated
  using (manicurist_id = (select auth.uid()));

create or replace function public.validate_appointment_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  service_duration integer;
  service_name text;
  service_price numeric(10, 2);
  work_start time;
  work_end time;
begin
  select s.duration_minutes, s.name, s.price, m.work_start_time, m.work_end_time
    into service_duration, service_name, service_price, work_start, work_end
  from public.services s
  join public.manicurists m on m.id = s.manicurist_id
  where s.id = new.service_id
    and s.manicurist_id = new.manicurist_id
    and s.is_active
    and m.is_active;

  if not found then
    raise exception 'El servicio o la manicurista ya no están disponibles.';
  end if;
  if new.appointment_date < current_date then
    raise exception 'No se pueden solicitar citas en fechas pasadas.';
  end if;
  if new.start_time < work_start or new.start_time >= work_end
    or new.start_time + make_interval(mins => service_duration) > work_end then
    raise exception 'La cita queda fuera del horario de atención.';
  end if;
  if mod(extract(epoch from (new.start_time - work_start))::integer, 1800) <> 0 then
    raise exception 'La hora debe comenzar en un bloque de 30 minutos.';
  end if;

  new.end_time := new.start_time + make_interval(mins => service_duration);
  new.booked_service_name := service_name;
  new.booked_price := service_price;
  new.status := 'pendiente';
  new.confirmation_sent_at := null;

  perform pg_advisory_xact_lock(
    hashtext(new.manicurist_id::text),
    hashtext(new.appointment_date::text)
  );

  if exists (
    select 1
    from public.appointments a
    where a.manicurist_id = new.manicurist_id
      and a.appointment_date = new.appointment_date
      and a.status in ('pendiente', 'confirmada')
      and new.start_time < a.end_time
      and new.end_time > a.start_time
  ) then
    raise exception 'Ese horario acaba de ser reservado. Elige otro bloque.';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_validate_request on public.appointments;
create trigger appointments_validate_request
  before insert on public.appointments
  for each row execute function public.validate_appointment_request();

create or replace function public.get_busy_times(p_manicurist_id uuid, p_date date)
returns table (start_time time, end_time time)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.start_time, a.end_time
  from public.appointments a
  where a.manicurist_id = p_manicurist_id
    and a.appointment_date = p_date
    and a.status in ('pendiente', 'confirmada')
  order by a.start_time;
$$;

revoke all on function public.get_busy_times(uuid, date) from public;
grant execute on function public.get_busy_times(uuid, date) to anon, authenticated;

revoke all on public.manicurists, public.services, public.appointments from anon, authenticated;
grant select on public.manicurists, public.services to anon;
grant select, insert, update on public.manicurists to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant insert on public.appointments to anon;
