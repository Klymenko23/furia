"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "./DataProvider";
import { ConfirmButton, Field, Sheet, dbError } from "./ui";
import { COUNTRIES, CURRENCIES, PAYMENT_FORM_NAME } from "@/lib/constants";
import { fmtPlate, parseNum, todayISO } from "@/lib/utils";
import { PlaceSearch } from "./PlaceSearch";
import { routeKm } from "@/app/(app)/trips/geo";
import type { Stop, Trip } from "@/lib/types";

const emptyStops = (): Stop[] => [
  { kind: "load", place: "", country: "UA", date: todayISO() },
  { kind: "unload", place: "", country: "UA", date: "" },
];

export function TripSheet({ trip, onClose }: { trip?: Trip; onClose: () => void }) {
  const { supabase, vehicles, drivers, firms, clients, reload } = useData();
  const router = useRouter();
  const [clientText, setClientText] = useState(clients.find((c) => c.id === trip?.client_id)?.name ?? "");
  const [clientRef, setClientRef] = useState(trip?.client_ref ?? "");
  const [stops, setStops] = useState<Stop[]>(trip?.stops?.length ? trip.stops : emptyStops());
  const [cargo, setCargo] = useState(trip?.cargo ?? "");
  const [weight, setWeight] = useState(trip?.weight_t != null ? String(trip.weight_t) : "");
  const [pallets, setPallets] = useState(trip?.pallets ?? "");
  const [cExport, setCExport] = useState(trip?.customs_export ?? "");
  const [cImport, setCImport] = useState(trip?.customs_import ?? "");
  const [border, setBorder] = useState(trip?.border ?? "");
  const [viaPL, setViaPL] = useState(trip?.via_poland ?? false);
  const [rmpd, setRmpd] = useState(trip?.rmpd_number ?? "");
  const [tractorId, setTractorId] = useState(trip?.tractor_id ?? "");
  const [trailerId, setTrailerId] = useState(trip?.trailer_id ?? "");
  const [driverId, setDriverId] = useState(trip?.driver_id ?? "");
  const [freight, setFreight] = useState(trip?.freight != null ? String(trip.freight) : "");
  const [currency, setCurrency] = useState(trip?.currency ?? "EUR");
  const [firmId, setFirmId] = useState(trip?.firm_id ?? (firms.filter((f) => !f.archived).length === 1 ? firms[0].id : ""));
  const [payForm, setPayForm] = useState<Trip["payment_form"]>(trip?.payment_form ?? "bank");
  const [vat, setVat] = useState(trip?.vat ?? false);
  const [payDays, setPayDays] = useState(trip?.payment_days != null ? String(trip.payment_days) : "");
  const [driverPay, setDriverPay] = useState(trip?.driver_pay != null ? String(trip.driver_pay) : "");
  const [driverPayCur, setDriverPayCur] = useState(trip?.driver_pay_currency ?? "EUR");
  const [dailyCountry, setDailyCountry] = useState(trip?.daily_country ?? "");
  const [advance, setAdvance] = useState(trip?.driver_advance != null ? String(trip.driver_advance) : "");
  const [advanceCur, setAdvanceCur] = useState(trip?.driver_advance_currency ?? "UAH");
  const [note, setNote] = useState(trip?.note ?? "");
  const [km, setKm] = useState(trip?.km != null ? String(trip.km) : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const tractors = vehicles.filter((v) => v.kind === "tractor" && (!v.archived || v.id === tractorId));
  const trailers = vehicles.filter((v) => v.kind === "trailer" && (!v.archived || v.id === trailerId));
  const activeDrivers = drivers.filter((d) => !d.archived || d.id === driverId);
  const driver = drivers.find((d) => d.id === driverId);

  function setStop(i: number, patch: Partial<Stop>) {
    const next = stops.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setStops(next);
    if (patch.country === "PL") setViaPL(true);
  }
  // Тягач → його звичайний причіп і закріплений водій
  function pickTractor(id: string) {
    setTractorId(id);
    const t = vehicles.find((v) => v.id === id);
    if (t?.default_trailer_id) setTrailerId(t.default_trailer_id);
    const d = drivers.find((x) => !x.archived && x.default_tractor_id === id);
    if (d && !driverId) setDriverId(d.id);
  }
  // Водій → його тягач
  function pickDriver(id: string) {
    setDriverId(id);
    const d = drivers.find((x) => x.id === id);
    if (d?.default_tractor_id && !tractorId) pickTractor(d.default_tractor_id);
  }
  // Замовник зі списку → його звична відстрочка
  function pickClient(name: string) {
    setClientText(name);
    const c = clients.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (c?.payment_days != null && !payDays) setPayDays(String(c.payment_days));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const cleanStops = stops.filter((s) => s.place.trim() || s.date);
    if (!cleanStops.some((s) => s.kind === "load") || !cleanStops.some((s) => s.kind === "unload")) {
      return setErr("Вкажіть хоча б одне завантаження і одне розвантаження.");
    }
    setBusy(true);
    let clientId: string | null = null;
    const name = clientText.trim();
    if (name) {
      const found = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (found) clientId = found.id;
      else {
        const { data, error } = await supabase.from("clients").insert({ name, payment_days: parseNum(payDays) }).select("id").single();
        if (error) { setBusy(false); return setErr(dbError(error)); }
        clientId = data.id;
      }
    }
    // Кілометри по дорогах, якщо всі точки обрані на карті і маршрут змінився
    let kmVal = parseNum(km);
    let routeLine = trip?.route_line ?? null;
    const pts = cleanStops.map((s) => (s.lat != null && s.lon != null ? [s.lat, s.lon] as [number, number] : null));
    const sameRoute = trip && JSON.stringify(trip.stops.map((s) => [s.lat, s.lon])) === JSON.stringify(cleanStops.map((s) => [s.lat, s.lon]));
    if (pts.every(Boolean) && pts.length >= 2 && (!sameRoute || !routeLine)) {
      const r = await routeKm(pts as [number, number][]);
      if (r.km) { kmVal = r.km; routeLine = r.line ?? null; }
    }
    if (pts.some((p) => !p)) routeLine = null;
    const row = {
      km: kmVal, route_line: routeLine,
      client_id: clientId, client_ref: clientRef.trim(),
      stops: cleanStops.map((s) => ({ ...s, place: s.place.trim() })),
      cargo: cargo.trim(), weight_t: parseNum(weight), pallets: pallets.trim(),
      customs_export: cExport.trim(), customs_import: cImport.trim(), border: border.trim(),
      via_poland: viaPL, rmpd_number: rmpd.trim(),
      tractor_id: tractorId || null, trailer_id: trailerId || null, driver_id: driverId || null,
      freight: parseNum(freight), currency, firm_id: firmId || null, payment_form: payForm, vat,
      payment_days: parseNum(payDays),
      driver_pay: parseNum(driverPay), driver_pay_currency: driverPayCur, daily_country: dailyCountry,
      driver_advance: parseNum(advance), driver_advance_currency: advanceCur,
      note: note.trim(),
    };
    const res = trip
      ? await supabase.from("trips").update(row).eq("id", trip.id).select("id").single()
      : await supabase.from("trips").insert(row).select("id").single();
    setBusy(false);
    if (res.error) return setErr(dbError(res.error));
    await reload();
    onClose();
    if (!trip) router.push(`/trips/${res.data.id}`);
  }

  async function remove() {
    const { error } = await supabase.from("trips").delete().eq("id", trip!.id);
    if (error) return setErr(dbError(error));
    await reload();
    onClose();
    router.push("/trips");
  }

  return (
    <Sheet onClose={onClose} label={trip ? "Редагувати рейс" : "Новий рейс"}>
      <h2>{trip ? `Рейс №${trip.number}` : "Новий рейс"}</h2>
      <form className="form" onSubmit={save}>
        <div className="fields">
          <Field label="Замовник" htmlFor="t-client" hint="Новий додасться в базу замовників сам">
            <input id="t-client" list="t-client-list" autoComplete="off" value={clientText} onChange={(e) => pickClient(e.target.value)} />
            <datalist id="t-client-list">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </Field>
          <Field label="Номер заявки замовника" htmlFor="t-ref">
            <input id="t-ref" value={clientRef} onChange={(e) => setClientRef(e.target.value)} />
          </Field>
        </div>

        <Field label="Маршрут">
          <div className="stops">
            {stops.map((s, i) => (
              <div key={i} className="stop">
                <div className="seg" role="group" aria-label={`Точка ${i + 1}`}>
                  <button type="button" aria-pressed={s.kind === "load"} onClick={() => setStop(i, { kind: "load" })}>Завантаження</button>
                  <button type="button" aria-pressed={s.kind === "unload"} onClick={() => setStop(i, { kind: "unload" })}>Розвантаження</button>
                </div>
                <div className="stop-row">
                  <PlaceSearch value={s.place} hasPoint={s.lat != null}
                    onText={(v) => setStop(i, { place: v, lat: undefined, lon: undefined })}
                    onPick={(p) => setStop(i, { place: p.place, lat: p.lat, lon: p.lon, ...(COUNTRIES.some(([k]) => k === p.country) ? { country: p.country } : {}) })} />
                  <select aria-label="Країна" value={s.country} onChange={(e) => setStop(i, { country: e.target.value })}>
                    {COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                  <input aria-label="Дата" type="date" value={s.date} onChange={(e) => setStop(i, { date: e.target.value })} />
                  {stops.length > 2 && <button type="button" className="btn ghost sm" aria-label="Прибрати точку" onClick={() => setStops(stops.filter((_, j) => j !== i))}>×</button>}
                </div>
              </div>
            ))}
            <div className="row">
              <button type="button" className="btn sm" onClick={() => setStops([...stops.slice(0, -1), { kind: "load", place: "", country: "UA", date: "" }, stops[stops.length - 1]])}>+ Завантаження</button>
              <button type="button" className="btn sm" onClick={() => setStops([...stops, { kind: "unload", place: "", country: stops[stops.length - 1]?.country ?? "UA", date: "" }])}>+ Розвантаження</button>
            </div>
          </div>
        </Field>

        <div className="fields">
          <Field label="Кілометри" htmlFor="t-km" hint={stops.every((x) => x.lat != null) ? "Порахуються по дорогах при збереженні" : "Оберіть точки на карті — порахую сам, або впишіть"}>
            <input id="t-km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
          </Field>
          <Field label="Вантаж" htmlFor="t-cargo"><input id="t-cargo" placeholder="Запчастини, картопля…" value={cargo} onChange={(e) => setCargo(e.target.value)} /></Field>
          <Field label="Вага, т" htmlFor="t-w"><input id="t-w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
          <Field label="Палети" htmlFor="t-pal"><input id="t-pal" placeholder="13 (1,2×1)" value={pallets} onChange={(e) => setPallets(e.target.value)} /></Field>
          <Field label="Митниця відправлення" htmlFor="t-cex"><input id="t-cex" placeholder="Замитнення на місці" value={cExport} onChange={(e) => setCExport(e.target.value)} /></Field>
          <Field label="Митниця призначення" htmlFor="t-cim"><input id="t-cim" placeholder="Малинська" value={cImport} onChange={(e) => setCImport(e.target.value)} /></Field>
          <Field label="Кордон" htmlFor="t-border"><input id="t-border" placeholder="Ягодин – Дорогуськ" value={border} onChange={(e) => setBorder(e.target.value)} /></Field>
        </div>

        <label className="check"><input type="checkbox" checked={viaPL} onChange={(e) => setViaPL(e.target.checked)} /> Рейс по Польщі або через Польщу (потрібен RMPD)</label>
        {viaPL && (
          <Field label="Номер RMPD" htmlFor="t-rmpd" hint="Без нього рейс не перейде в «В дорозі»">
            <input id="t-rmpd" value={rmpd} onChange={(e) => setRmpd(e.target.value)} />
          </Field>
        )}

        <div className="fields">
          <Field label="Тягач" htmlFor="t-tractor">
            <select id="t-tractor" value={tractorId} onChange={(e) => pickTractor(e.target.value)}>
              <option value="">— не обрано —</option>
              {tractors.map((v) => <option key={v.id} value={v.id}>{fmtPlate(v.plate)} {v.make}</option>)}
            </select>
          </Field>
          <Field label="Причіп" htmlFor="t-trailer">
            <select id="t-trailer" value={trailerId} onChange={(e) => setTrailerId(e.target.value)}>
              <option value="">— без причепа —</option>
              {trailers.map((v) => <option key={v.id} value={v.id}>{fmtPlate(v.plate)} {v.make}</option>)}
            </select>
          </Field>
          <Field label="Водій" htmlFor="t-driver">
            <select id="t-driver" value={driverId} onChange={(e) => pickDriver(e.target.value)}>
              <option value="">— не обрано —</option>
              {activeDrivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </Field>
        </div>

        <div className="fields">
          <Field label="Фрахт" htmlFor="t-freight">
            <div className="money-in">
              <input id="t-freight" inputMode="decimal" placeholder="1900" value={freight} onChange={(e) => setFreight(e.target.value)} />
              <select aria-label="Валюта фрахту" value={currency} onChange={(e) => { setCurrency(e.target.value); if (!driverPay) setDriverPayCur(e.target.value); }}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
          </Field>
          <Field label="Форма оплати" htmlFor="t-payform">
            <select id="t-payform" value={payForm} onChange={(e) => setPayForm(e.target.value as Trip["payment_form"])}>
              {(Object.keys(PAYMENT_FORM_NAME) as Trip["payment_form"][]).map((k) => <option key={k} value={k}>{PAYMENT_FORM_NAME[k]}</option>)}
            </select>
          </Field>
          {payForm !== "cash" && (
            <Field label="На яку фірму" htmlFor="t-firm" hint={firms.length ? undefined : "Фірми додаються в Налаштуваннях"}>
              <select id="t-firm" value={firmId} onChange={(e) => setFirmId(e.target.value)}>
                <option value="">— не вказано —</option>
                {firms.filter((f) => !f.archived || f.id === firmId).map((f) => <option key={f.id} value={f.id}>{f.name}{f.fee_percent ? ` (${f.fee_percent}%)` : ""}</option>)}
              </select>
            </Field>
          )}
          <Field label="Відстрочка, днів" htmlFor="t-days" hint="Після отримання оригіналів">
            <input id="t-days" inputMode="numeric" placeholder="30" value={payDays} onChange={(e) => setPayDays(e.target.value)} />
          </Field>
        </div>
        {payForm === "bank" && <label className="check"><input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} /> З ПДВ (потрібна податкова накладна)</label>}

        <div className="fields">
          <Field label="Водію за рейс" htmlFor="t-dpay" hint={driver?.pay_scheme === "per_trip" ? "Сума за цей рейс" : "Залиште порожнім — порахується за схемою водія"}>
            <div className="money-in">
              <input id="t-dpay" inputMode="decimal" value={driverPay} onChange={(e) => setDriverPay(e.target.value)} />
              <select aria-label="Валюта" value={driverPayCur} onChange={(e) => setDriverPayCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
          </Field>
          {driver?.pay_scheme === "percent_daily" && (
            <Field label="Добові за країною" htmlFor="t-daily">
              <select id="t-daily" value={dailyCountry} onChange={(e) => setDailyCountry(e.target.value)}>
                <option value="">— оберіть —</option>
                {COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </Field>
          )}
          <Field label="Аванс водію" htmlFor="t-adv">
            <div className="money-in">
              <input id="t-adv" inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} />
              <select aria-label="Валюта авансу" value={advanceCur} onChange={(e) => setAdvanceCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
          </Field>
          <Field label="Нотатки" htmlFor="t-note" wide><textarea id="t-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>

        {err && <div className="error" role="alert">{err}</div>}
        <div className="row end">
          {trip && <ConfirmButton label="Видалити рейс" onConfirm={remove} />}
          <button type="button" className="btn ghost" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Зберігаю…" : "Зберегти"}</button>
        </div>
      </form>
    </Sheet>
  );
}
