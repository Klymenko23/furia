-- Furia: пошук вантажів у Lardi-Trans і пуш-сповіщення (запускати після 0004)

-- ============ Пуш-підписки (кожен пристрій користувача) ============
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text not null default '',
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_own on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ Збережені пошуки Lardi ============
create table if not exists public.lardi_watches (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  from_text text not null,                 -- як ввів користувач: «Одеса»
  from_town_id bigint,                     -- id міста в довіднику Lardi (якщо знайдено)
  from_country text not null default 'UA',
  to_text text not null,
  to_town_id bigint,
  to_country text not null default 'UA',
  radius_km int not null default 30,
  active boolean not null default true,
  last_checked_at timestamptz,
  last_error text not null default '',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.lardi_watches enable row level security;
create policy lardi_watches_read on public.lardi_watches for select using (public.is_office());
create policy lardi_watches_write on public.lardi_watches for all using (public.can_edit()) with check (public.can_edit());

-- Знайдені вантажі (щоб не надсилати один і той самий двічі)
create table if not exists public.lardi_found (
  watch_id uuid not null references public.lardi_watches(id) on delete cascade,
  proposal_id text not null,
  data jsonb not null default '{}'::jsonb,
  found_at timestamptz not null default now(),
  primary key (watch_id, proposal_id)
);
create index if not exists lardi_found_time_idx on public.lardi_found(found_at desc);
alter table public.lardi_found enable row level security;
create policy lardi_found_read on public.lardi_found for select using (public.is_office());

-- ============ Розклад: кожні 5 хвилин (Lardi) і щодня о 9:00 (терміни документів, оплати) ============
-- Секрет генерується тут і лишається тільки в базі.
insert into public.integrations (key, token)
values ('cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('furia-cron') where exists (select 1 from cron.job where jobname = 'furia-cron');
select cron.schedule('furia-cron', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://furia-self.vercel.app/api/cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select token from public.integrations where key = 'cron'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$$);
