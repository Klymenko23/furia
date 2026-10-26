-- Furia: етап 2 — замовники й рейси (запускати після 0001 і 0002)

-- ============ Замовники ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  contact text not null default '',            -- контактна особа
  phone text not null default '',
  channel text not null default '',            -- Viber, Telegram, пошта, телефон, Della, Lardi
  directions text not null default '',         -- звичні напрямки
  payment_days int,                            -- звична відстрочка
  note text not null default '',
  created_at timestamptz not null default now()
);
create unique index clients_name_uniq on public.clients (lower(trim(name)));

-- ============ Рейси ============
-- stage: request — заявка, loading — завантаження, transit — в дорозі, customs — митниця, unloading — розвантаження,
--        docs — водій надіслав ТТН/CMR, invoiced — рахунок і акт надіслано, originals — оригінали відправлено,
--        awaiting — чекаємо оплату, paid — оплачено, cancelled — скасовано
-- stops: [{ "kind": "load" | "unload", "place": "Вінниця", "country": "UA", "date": "2026-10-28", "address": "…", "note": "…" }]
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  number serial,                               -- внутрішній номер рейсу
  client_id uuid references public.clients(id) on delete set null,
  client_ref text not null default '',         -- номер заявки замовника
  stage text not null default 'request'
    check (stage in ('request','loading','transit','customs','unloading','docs','invoiced','originals','awaiting','paid','cancelled')),
  stops jsonb not null default '[]'::jsonb,
  cargo text not null default '',
  weight_t numeric(7,2),
  pallets text not null default '',
  customs_export text not null default '',
  customs_import text not null default '',
  border text not null default '',
  via_poland boolean not null default false,
  rmpd_number text not null default '',
  tractor_id uuid references public.vehicles(id) on delete set null,
  trailer_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  freight numeric(12,2),
  currency text not null default 'EUR',
  firm_id uuid references public.firms(id) on delete set null,      -- на яку фірму заходять гроші
  payment_form text not null default 'bank' check (payment_form in ('bank', 'cash', 'card')),
  vat boolean not null default false,
  payment_days int,                            -- відстрочка після отримання оригіналів
  driver_pay numeric(12,2),                    -- для схеми «сума за рейс» або ручна сума
  driver_pay_currency text not null default 'EUR',
  daily_country text not null default '',      -- для добових
  driver_advance numeric(12,2),                -- аванс водію в рейс
  driver_advance_currency text not null default 'UAH',
  km int,                                      -- пробіг рейсу
  docs_received_on date,                       -- водій надіслав ТТН/CMR
  invoice_sent_on date,
  tax_invoice_done boolean not null default false,
  originals_sent_on date,
  originals_tracking text not null default '',
  originals_received_on date,                  -- замовник отримав оригінали — від цього рахується строк оплати
  paid_on date,
  paid_amount numeric(12,2),
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_stage_idx on public.trips(stage);
create index trips_tractor_idx on public.trips(tractor_id);
create index trips_driver_idx on public.trips(driver_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger trips_touch before update on public.trips for each row execute function public.touch_updated_at();

-- Витрати тепер можна привʼязати до рейсу
alter table public.expenses
  add constraint expenses_trip_fk foreign key (trip_id) references public.trips(id) on delete set null;
create index if not exists expenses_trip_idx on public.expenses(trip_id);

-- ============ Права ============
alter table public.clients enable row level security;
alter table public.trips enable row level security;

create policy clients_read on public.clients for select using (public.is_office());
create policy clients_write on public.clients for all using (public.can_edit()) with check (public.can_edit());
create policy trips_read on public.trips for select using (public.is_office());
create policy trips_write on public.trips for all using (public.can_edit()) with check (public.can_edit());
