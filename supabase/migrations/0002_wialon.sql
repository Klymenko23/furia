-- Furia: підключення Wialon (запускати після 0001_init.sql)
-- Токен зберігається лише тут і читається тільки сервером (ключ service_role).
-- Жодна роль у застосунку не може прочитати цю таблицю напряму.

create table public.integrations (
  key text primary key,                 -- 'wialon'
  base_url text not null default '',    -- напр. https://megagps.net
  token text not null default '',
  user_name text not null default '',   -- під ким виданий токен (для показу)
  updated_at timestamptz not null default now()
);

alter table public.integrations enable row level security;
-- Політик немає навмисно: доступ лише з сервера.
