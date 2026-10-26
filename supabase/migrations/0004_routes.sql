-- Furia: маршрут рейсу на карті (запускати після 0003_trips.sql)
-- Координати точок зберігаються в trips.stops (lat, lon), тут — лінія маршруту по дорогах для карти.
alter table public.trips add column if not exists route_line jsonb;

-- Гривні для безготівки: курс НБУ на дату і податок фірми
alter table public.trips add column if not exists fx_rate numeric(12,4);
alter table public.trips add column if not exists fx_date date;
alter table public.firms add column if not exists tax_percent numeric(5,2) not null default 0;
