-- Furia: початкова схема бази даних (етап 1: автопарк, водії, документи, витрати)
-- Запускати один раз: Supabase → SQL Editor → вставити весь файл → Run

-- ============ Ролі та користувачі ============
-- owner — власник, dispatcher — диспетчер, accountant — бухгалтер, driver — водій
create type public.app_role as enum ('owner', 'dispatcher', 'accountant', 'driver');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'dispatcher',
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Профіль створюється автоматично, коли власник додає користувача.
-- Перший користувач у базі стає власником.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  first_user boolean := not exists (select 1 from public.profiles);
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    case when first_user then 'owner'::public.app_role
         else coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'dispatcher') end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

-- Офіс: власник, диспетчер, бухгалтер — бачать усе
create or replace function public.is_office()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('owner', 'dispatcher', 'accountant'), false)
$$;

-- Хто може змінювати довідники: власник і диспетчер
create or replace function public.can_edit()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('owner', 'dispatcher'), false)
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'owner', false)
$$;

-- ============ Фірми власника (ФОП, ТОВ, ПП) ============
-- tax_mode: fop3 — ФОП 3 група без ПДВ, vat — платник ПДВ, no_vat — без ПДВ, other — інше
create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'fop' check (kind in ('fop', 'tov', 'pp', 'other')),
  tax_mode text not null default 'fop3' check (tax_mode in ('fop3', 'vat', 'no_vat', 'other')),
  fee_percent numeric(5,2) not null default 0,   -- відсоток за проведення грошей через цю фірму
  code text not null default '',                 -- ЄДРПОУ або ІПН
  iban text not null default '',
  note text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ Автопарк: тягачі та причепи ============
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('tractor', 'trailer')),
  plate text not null check (length(trim(plate)) > 0),
  make text not null default '',                 -- DAF, Schmitz Cargobull…
  model text not null default '',                -- XF 106…
  year int,
  vin text not null default '',
  body_type text not null default '',            -- для причепа: тент, реф, ізотерм…
  volume_m3 numeric(6,1),
  capacity_t numeric(6,2),
  firm_id uuid references public.firms(id) on delete set null,          -- на кого оформлена
  default_trailer_id uuid references public.vehicles(id) on delete set null, -- «звичайний причеп» тягача
  status text not null default 'free' check (status in ('free', 'trip', 'repair')),
  mileage int,                                   -- пробіг, км
  wialon_unit text not null default '',          -- обʼєкт у Wialon (на потім)
  note text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index vehicles_plate_uniq on public.vehicles (upper(replace(plate, ' ', ''))) where not archived;

-- ============ Водії ============
-- pay_scheme: percent — % від фрахту, percent_daily — % + добові, salary — ставка на місяць, per_trip — сума за рейс
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null default '',
  messenger text not null default '',            -- Viber / Telegram, як зручно звʼязатися
  default_tractor_id uuid references public.vehicles(id) on delete set null,
  pay_scheme text not null default 'percent' check (pay_scheme in ('percent', 'percent_daily', 'salary', 'per_trip')),
  pay_percent numeric(5,2),
  salary numeric(12,2),
  salary_currency text not null default 'UAH',
  profile_id uuid references public.profiles(id) on delete set null,   -- вхід у систему (на потім)
  note text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Добові по країнах (налаштування фірми)
create table public.daily_rates (
  country text primary key,                      -- код країни: UA, PL, DE…
  amount numeric(10,2) not null,
  currency text not null default 'EUR'
);

-- ============ Документи з термінами ============
-- Стосуються машини, водія або фірми. doc_type — ключ із lib/constants.ts (або «other» зі своєю назвою).
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete cascade,
  firm_id uuid references public.firms(id) on delete cascade,
  doc_type text not null,
  title text not null default '',                -- своя назва, якщо doc_type = other
  number text not null default '',
  expires_on date,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (num_nonnulls(vehicle_id, driver_id, firm_id) = 1)
);
create index documents_expires_idx on public.documents(expires_on);

-- ============ Витрати ============
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null default '',             -- звична категорія витрат у цього постачальника
  phone text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create unique index suppliers_name_uniq on public.suppliers (lower(trim(name)));

-- paid_by: firm — з рахунку фірми, cash — готівка офісу, driver — водій зі своїх, fuel_card — паливна картка
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'UAH',
  category text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  trip_id uuid,                                  -- рейс (зʼявиться на етапі 2)
  paid_by text not null default 'firm' check (paid_by in ('firm', 'cash', 'driver', 'fuel_card')),
  mileage int,                                   -- пробіг на момент заміни (колеса, запчастини)
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses(spent_on);
create index expenses_vehicle_idx on public.expenses(vehicle_id);

-- ============ Права доступу ============
alter table public.profiles enable row level security;
alter table public.firms enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.daily_rates enable row level security;
alter table public.documents enable row level security;
alter table public.suppliers enable row level security;
alter table public.expenses enable row level security;

-- Профілі: кожен бачить себе, офіс бачить усіх; змінює ролі лише власник (через сервер)
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_office());

-- Довідники: офіс читає, власник і диспетчер змінюють
create policy firms_read on public.firms for select using (public.is_office());
create policy firms_write on public.firms for all using (public.is_owner()) with check (public.is_owner());

create policy vehicles_read on public.vehicles for select using (public.is_office());
create policy vehicles_write on public.vehicles for all using (public.can_edit()) with check (public.can_edit());

create policy drivers_read on public.drivers for select using (public.is_office());
create policy drivers_write on public.drivers for all using (public.can_edit()) with check (public.can_edit());

create policy daily_rates_read on public.daily_rates for select using (public.is_office());
create policy daily_rates_write on public.daily_rates for all using (public.is_owner()) with check (public.is_owner());

create policy documents_read on public.documents for select using (public.is_office());
create policy documents_write on public.documents for all using (public.can_edit()) with check (public.can_edit());

-- Постачальники й витрати: увесь офіс може додавати (бухгалтер теж)
create policy suppliers_read on public.suppliers for select using (public.is_office());
create policy suppliers_write on public.suppliers for all using (public.is_office()) with check (public.is_office());

create policy expenses_read on public.expenses for select using (public.is_office());
create policy expenses_write on public.expenses for all using (public.is_office()) with check (public.is_office());
