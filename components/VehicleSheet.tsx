"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "./DataProvider";
import { ConfirmButton, Field, Sheet, dbError } from "./ui";
import { UnitPicker } from "./Wialon";
import { BODY_TYPES, KIND_NAME, STATUS_NAME } from "@/lib/constants";
import { fmtPlate, parseNum } from "@/lib/utils";
import type { Vehicle, VehicleKind, VehicleStatus } from "@/lib/types";

export function VehicleSheet({ vehicle, kind: kind0, onClose }: { vehicle?: Vehicle; kind?: VehicleKind; onClose: () => void }) {
  const { supabase, vehicles, firms, reload } = useData();
  const router = useRouter();
  const [kind, setKind] = useState<VehicleKind>(vehicle?.kind ?? kind0 ?? "tractor");
  const [plate, setPlate] = useState(vehicle?.plate ?? "");
  const [make, setMake] = useState(vehicle?.make ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : "");
  const [vin, setVin] = useState(vehicle?.vin ?? "");
  const [body, setBody] = useState(vehicle?.body_type ?? "");
  const [volume, setVolume] = useState(vehicle?.volume_m3 != null ? String(vehicle.volume_m3) : "");
  const [capacity, setCapacity] = useState(vehicle?.capacity_t != null ? String(vehicle.capacity_t) : "");
  const [firmId, setFirmId] = useState(vehicle?.firm_id ?? "");
  const [trailerId, setTrailerId] = useState(vehicle?.default_trailer_id ?? "");
  const [status, setStatus] = useState<VehicleStatus>(vehicle?.status ?? "free");
  const [mileage, setMileage] = useState(vehicle?.mileage != null ? String(vehicle.mileage) : "");
  const [wialon, setWialon] = useState(vehicle?.wialon_unit ?? "");
  const [note, setNote] = useState(vehicle?.note ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const trailers = vehicles.filter((v) => v.kind === "trailer" && !v.archived);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!plate.trim()) return setErr("Вкажіть держномер.");
    setBusy(true);
    const row = {
      kind, plate: plate.replace(/\s+/g, "").toUpperCase(), make: make.trim(), model: model.trim(),
      year: parseNum(year), vin: vin.trim().toUpperCase(), body_type: body,
      volume_m3: parseNum(volume), capacity_t: parseNum(capacity), firm_id: firmId || null,
      default_trailer_id: kind === "tractor" ? trailerId || null : null,
      status, mileage: parseNum(mileage), wialon_unit: wialon.trim(), note: note.trim(),
    };
    const res = vehicle
      ? await supabase.from("vehicles").update(row).eq("id", vehicle.id).select("id").single()
      : await supabase.from("vehicles").insert(row).select("id").single();
    setBusy(false);
    if (res.error) return setErr(dbError(res.error));
    await reload();
    onClose();
    if (!vehicle) router.push(`/fleet/${res.data.id}`);
  }

  async function archive() {
    const { error } = await supabase.from("vehicles").update({ archived: !vehicle!.archived }).eq("id", vehicle!.id);
    if (error) return setErr(dbError(error));
    await reload();
    onClose();
  }

  return (
    <Sheet onClose={onClose} label={vehicle ? "Редагувати машину" : "Нова машина"}>
      <h2>{vehicle ? `${KIND_NAME[kind]} ${fmtPlate(vehicle.plate)}` : "Нова машина"}</h2>
      <form className="form" onSubmit={save}>
        {!vehicle && (
          <div className="seg" role="group" aria-label="Тип">
            {(["tractor", "trailer"] as VehicleKind[]).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_NAME[k]}</button>
            ))}
          </div>
        )}
        <div className="fields">
          <Field label="Держномер" htmlFor="v-plate">
            <input id="v-plate" autoCapitalize="characters" autoComplete="off" placeholder="СВ 8065 ЕН" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </Field>
          <Field label="Марка" htmlFor="v-make">
            <input id="v-make" placeholder={kind === "tractor" ? "DAF" : "Schmitz Cargobull"} value={make} onChange={(e) => setMake(e.target.value)} />
          </Field>
          <Field label="Модель" htmlFor="v-model">
            <input id="v-model" placeholder={kind === "tractor" ? "XF 106" : "S.CS"} value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="Рік" htmlFor="v-year">
            <input id="v-year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          {kind === "trailer" && (
            <>
              <Field label="Тип кузова" htmlFor="v-body">
                <select id="v-body" value={body} onChange={(e) => setBody(e.target.value)}>
                  <option value="">— не вказано —</option>
                  {BODY_TYPES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Обсяг, м³" htmlFor="v-vol">
                <input id="v-vol" inputMode="decimal" placeholder="86" value={volume} onChange={(e) => setVolume(e.target.value)} />
              </Field>
              <Field label="Вантажопідйомність, т" htmlFor="v-cap">
                <input id="v-cap" inputMode="decimal" placeholder="24" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </Field>
            </>
          )}
          {kind === "tractor" && (
            <Field label="Звичайний причіп" htmlFor="v-trailer" hint="Підставиться в рейс сам, але його можна змінити">
              <select id="v-trailer" value={trailerId} onChange={(e) => setTrailerId(e.target.value)}>
                <option value="">— без причепа —</option>
                {trailers.map((t) => <option key={t.id} value={t.id}>{fmtPlate(t.plate)} {t.make}</option>)}
              </select>
            </Field>
          )}
          <Field label="Стан" htmlFor="v-status">
            <select id="v-status" value={status} onChange={(e) => setStatus(e.target.value as VehicleStatus)}>
              {(Object.keys(STATUS_NAME) as VehicleStatus[]).map((s) => <option key={s} value={s}>{STATUS_NAME[s]}</option>)}
            </select>
          </Field>
          <Field label="Пробіг, км" htmlFor="v-km">
            <input id="v-km" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          </Field>
          <Field label="На яку фірму оформлена" htmlFor="v-firm" hint={firms.length ? undefined : "Фірми додаються в Налаштуваннях"}>
            <select id="v-firm" value={firmId} onChange={(e) => setFirmId(e.target.value)}>
              <option value="">— не вказано —</option>
              {firms.filter((f) => !f.archived).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="VIN" htmlFor="v-vin">
            <input id="v-vin" autoCapitalize="characters" value={vin} onChange={(e) => setVin(e.target.value)} />
          </Field>
          {kind === "tractor" && (
            <UnitPicker value={wialon} onChange={setWialon} />
          )}
          <Field label="Нотатки" htmlFor="v-note" wide>
            <textarea id="v-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row end">
          {vehicle && <ConfirmButton label={vehicle.archived ? "Повернути з архіву" : "В архів"} onConfirm={archive} className="btn ghost sm" />}
          <button type="button" className="btn ghost" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Зберігаю…" : "Зберегти"}</button>
        </div>
      </form>
    </Sheet>
  );
}
