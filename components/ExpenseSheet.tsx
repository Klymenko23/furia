"use client";

import { useState } from "react";
import { useData } from "./DataProvider";
import { ConfirmButton, Field, Sheet, dbError } from "./ui";
import { CATEGORIES, CURRENCIES, PAID_BY_NAME } from "@/lib/constants";
import { fmtPlate, parseNum, todayISO } from "@/lib/utils";
import type { Expense, PaidBy } from "@/lib/types";

/** Поля, які можна підставити заздалегідь (напр. з картки машини), або вся витрата для редагування */
export type ExpenseDraft = Partial<Expense>;

export function ExpenseSheet({ draft, onClose, onSaved }: { draft: ExpenseDraft; onClose: () => void; onSaved: () => void }) {
  const { supabase, vehicles, drivers, suppliers } = useData();
  const editing = !!draft.id;
  const [cat, setCat] = useState(draft.category ?? "");
  const [amount, setAmount] = useState(draft.amount != null ? String(draft.amount) : "");
  const [currency, setCurrency] = useState(draft.currency ?? "UAH");
  const [date, setDate] = useState(draft.spent_on ?? todayISO());
  const [vehicleId, setVehicleId] = useState(draft.vehicle_id ?? "");
  const [driverId, setDriverId] = useState(draft.driver_id ?? "");
  const [supplierText, setSupplierText] = useState(suppliers.find((s) => s.id === draft.supplier_id)?.name ?? "");
  const [paidBy, setPaidBy] = useState<PaidBy>(draft.paid_by ?? "firm");
  const [mileage, setMileage] = useState(draft.mileage != null ? String(draft.mileage) : "");
  const [note, setNote] = useState(draft.note ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const category = CATEGORIES.find((c) => c.key === cat);
  const active = vehicles.filter((v) => !v.archived || v.id === vehicleId);
  const activeDrivers = drivers.filter((d) => !d.archived || d.id === driverId);

  // Обрали водія — підставляємо його звичайний тягач, якщо машину ще не вказано
  function pickDriver(id: string) {
    setDriverId(id);
    const d = drivers.find((x) => x.id === id);
    if (d?.default_tractor_id && !vehicleId) setVehicleId(d.default_tractor_id);
  }
  // Постачальник зі списку — підказуємо його звичну категорію
  function pickSupplier(name: string) {
    setSupplierText(name);
    const s = suppliers.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (s?.category && !cat) setCat(s.category);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const sum = parseNum(amount);
    if (!cat) return setErr("Оберіть категорію.");
    if (!sum || sum <= 0) return setErr("Вкажіть суму більше нуля.");
    setBusy(true);

    // Новий постачальник додається в довідник сам
    let supplierId: string | null = null;
    const name = supplierText.trim();
    if (name) {
      const found = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (found) supplierId = found.id;
      else {
        const { data, error } = await supabase.from("suppliers").insert({ name, category: cat }).select("id").single();
        if (error) { setBusy(false); return setErr(dbError(error)); }
        supplierId = data.id;
      }
    }

    const row = {
      category: cat, amount: sum, currency, spent_on: date,
      vehicle_id: vehicleId || null, driver_id: driverId || null, supplier_id: supplierId,
      paid_by: paidBy, mileage: category?.mileage ? parseNum(mileage) : null, note: note.trim(),
    };
    const { error } = editing
      ? await supabase.from("expenses").update(row).eq("id", draft.id!)
      : await supabase.from("expenses").insert(row);
    setBusy(false);
    if (error) return setErr(dbError(error));
    onSaved();
  }

  async function remove() {
    const { error } = await supabase.from("expenses").delete().eq("id", draft.id!);
    if (error) return setErr(dbError(error));
    onSaved();
  }

  return (
    <Sheet onClose={onClose} label={editing ? "Витрата" : "Нова витрата"}>
      <h2>{editing ? "Витрата" : "Нова витрата"}</h2>
      <form className="form" onSubmit={save}>
        <Field label="Категорія">
          <div className="seg" role="group" aria-label="Категорія">
            {CATEGORIES.map((c) => (
              <button key={c.key} type="button" aria-pressed={cat === c.key} onClick={() => setCat(c.key)}>
                <span aria-hidden="true">{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="fields">
          <Field label="Сума" htmlFor="ex-sum">
            <div className="money-in">
              <input id="ex-sum" inputMode="decimal" autoComplete="off" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select aria-label="Валюта" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Дата" htmlFor="ex-date">
            <input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Машина" htmlFor="ex-veh">
            <select id="ex-veh" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">— без машини —</option>
              {active.map((v) => <option key={v.id} value={v.id}>{fmtPlate(v.plate)} · {v.kind === "tractor" ? "тягач" : "причіп"} {v.make}</option>)}
            </select>
          </Field>
          <Field label="Водій" htmlFor="ex-drv">
            <select id="ex-drv" value={driverId} onChange={(e) => pickDriver(e.target.value)}>
              <option value="">— без водія —</option>
              {activeDrivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </Field>
          <Field label="Магазин або постачальник" htmlFor="ex-sup" hint="Новий додасться в довідник сам">
            <input id="ex-sup" list="ex-sup-list" autoComplete="off" placeholder="WOG, ОККО, СТО «Мотор»…" value={supplierText} onChange={(e) => pickSupplier(e.target.value)} />
            <datalist id="ex-sup-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          </Field>
          <Field label="Хто платив" htmlFor="ex-paid">
            <select id="ex-paid" value={paidBy} onChange={(e) => setPaidBy(e.target.value as PaidBy)}>
              {(Object.keys(PAID_BY_NAME) as PaidBy[]).map((k) => <option key={k} value={k}>{PAID_BY_NAME[k]}</option>)}
            </select>
          </Field>
          {category?.mileage && (
            <Field label="Пробіг на момент заміни, км" htmlFor="ex-km" hint="Щоб бачити, скільки прослужила шина чи деталь">
              <input id="ex-km" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} />
            </Field>
          )}
          <Field label="Коментар" htmlFor="ex-note" wide>
            <input id="ex-note" placeholder="Напр.: 2 шини на задню вісь причепа" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        {paidBy === "driver" && <div className="note">Ця сума додасться до розрахунку з водієм, коли зʼявиться розділ зарплати.</div>}
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row end">
          {editing && <ConfirmButton label="Видалити" onConfirm={remove} />}
          <button type="button" className="btn ghost" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Зберігаю…" : "Зберегти"}</button>
        </div>
      </form>
    </Sheet>
  );
}
