-- Стартові дані: перша машина та водій. Запускати після 0001_init.sql (один раз).
-- Дати документів не заповнені: їх вносять у картці машини або водія.

with tr as (
  insert into public.vehicles (kind, plate, make, body_type)
  values ('trailer', 'СВ1494XF', 'Schmitz Cargobull', '')
  returning id
), tk as (
  insert into public.vehicles (kind, plate, make, model, default_trailer_id)
  select 'tractor', 'СВ8065ЕН', 'DAF', 'XF 106', id from tr
  returning id
)
insert into public.drivers (full_name, default_tractor_id, pay_scheme)
select 'Клименко Константин', id, 'percent' from tk;
