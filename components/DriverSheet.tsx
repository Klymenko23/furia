"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "./DataProvider";
import { ConfirmButton, Field, Sheet, dbError } from "./ui";
import { CURRENCIES, PAY_SCHEME_NAME } from "@/lib/constants";
import { fmtPlate, parseNum } from "@/lib/utils";
import type { Driver, PayScheme } from "@/lib/types";

export function DriverSheet({ driver, onClose }: { driver?: Driver; onClose: () => void }) {
  const { supabase, vehicles, reload } = useData();
  const router = useRouter();
  const [name, setName] = useState(driver?.full_name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [messenger, setMessenger] = useState(driver?.messenger ?? "");
  const [tractorId, setTractorId] = useState(driver?.default_tractor_id ?? "");
  const [scheme, setScheme] = useState<PayScheme>(driver?.pay_scheme ?? "percent");
  const [percent, setPercent] = useState(driver?.pay_percent != null ? String(driver.pay_percent) : "20");
  const [salary, setSalary] = useState(driver?.salary != null ? String(driver.salary) : "");
  const [cur, setCur] = useState(driver?.salary_currency ?? "UAH");
  const [note, setNote] = useState(driver?.note ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const usesPercent = scheme === "percent" || scheme === "percent_daily";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Вкажіть прізвище та імʼя.");
    setBusy(true);
    const row = {
      full_name: name.trim(), phone: phone.trim(), messenger: messenger.trim(),
      default_tractor_id: tractorId || null, pay_scheme: scheme,
      pay_percent: usesPercent ? parseNum(percent) : null,
      salary: scheme === "salary" ? parseNum(salary) : null, salary_currency: cur, note: note.trim(),
    };
    const res = driver
      ? await supabase.from("drivers").update(row).eq("id", driver.id).select("id").single()
      : await supabase.from("drivers").insert(row).select("id").single();
    setBusy(false);
    if (res.error) return setErr(dbError(res.error));
    await reload();
    onClose();
    if (!driver) router.push(`/drivers/${res.data.id}`);
  }

  async function archive() {
    const { error } = await supabase.from("drivers").update({ archived: !driver!.archived }).eq("id", driver!.id);
    if (error) return setErr(dbError(error));
    await reload();
    onClose();
  }

  return (
    <Sheet onClose={onClose} label={driver ? "Редагувати водія" : "Новий водій"}>
      <h2>{driver ? driver.full_name : "Новий водій"}</h2>
      <form className="form" onSubmit={save}>
        <div className="fields">
          <Field label="Прізвище та імʼя" htmlFor="d-name" wide>
            <input id="d-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Телефон" htmlFor="d-phone">
            <input id="d-phone" type="tel" inputMode="tel" placeholder="+380…" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Мессенджер" htmlFor="d-msg">
            <select id="d-msg" value={messenger} onChange={(e) => setMessenger(e.target.value)}>
              <option value="">— не вказано —</option>
              <option>Viber</option><option>Telegram</option><option>WhatsApp</option><option>Тільки дзвінки</option>
            </select>
          </Field>
          <Field label="Звичайний тягач" htmlFor="d-tractor" wide>
            <select id="d-tractor" value={tractorId} onChange={(e) => setTractorId(e.target.value)}>
              <option value="">— не закріплений —</option>
              {vehicles.filter((v) => v.kind === "tractor" && !v.archived).map((v) => <option key={v.id} value={v.id}>{fmtPlate(v.plate)} {v.make} {v.model}</option>)}
            </select>
          </Field>
          <Field label="Схема оплати" htmlFor="d-scheme" wide>
            <select id="d-scheme" value={scheme} onChange={(e) => setScheme(e.target.value as PayScheme)}>
              {(Object.keys(PAY_SCHEME_NAME) as PayScheme[]).map((k) => <option key={k} value={k}>{PAY_SCHEME_NAME[k]}</option>)}
            </select>
          </Field>
          {usesPercent && (
            <Field label="Відсоток від фрахту" htmlFor="d-pct" hint={scheme === "percent_daily" ? "Добові по країнах задаються в Налаштуваннях" : undefined}>
              <div className="seg" role="group" aria-label="Швидкий вибір відсотка">
                {["15", "20"].map((p) => <button key={p} type="button" aria-pressed={percent === p} onClick={() => setPercent(p)}>{p}%</button>)}
                <input id="d-pct" inputMode="decimal" aria-label="Свій відсоток" value={percent} onChange={(e) => setPercent(e.target.value)} style={{ width: 70, minHeight: 34, padding: "4px 8px" }} />
              </div>
            </Field>
          )}
          {scheme === "salary" && (
            <Field label="Ставка на місяць" htmlFor="d-sal">
              <div className="money-in">
                <input id="d-sal" inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} />
                <select aria-label="Валюта" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
            </Field>
          )}
          {scheme === "per_trip" && <div className="note field wide">Суму водію вказуєте в кожному рейсі окремо.</div>}
          <Field label="Нотатки" htmlFor="d-note" wide>
            <textarea id="d-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row end">
          {driver && <ConfirmButton label={driver.archived ? "Повернути з архіву" : "Звільнений, в архів"} onConfirm={archive} className="btn ghost sm" />}
          <button type="button" className="btn ghost" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Зберігаю…" : "Зберегти"}</button>
        </div>
      </form>
    </Sheet>
  );
}
