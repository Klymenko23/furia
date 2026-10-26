"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useData } from "@/components/DataProvider";
import { ExpenseRows, useExpenses } from "@/components/Expenses";
import { StageBadge } from "@/components/TripBits";
import { TripSheet } from "@/components/TripSheet";
import { ConfirmButton, Plate, dbError } from "@/components/ui";
import { countryName, PAYMENT_FORM_NAME, STAGES, stageIndex, stageLabel } from "@/lib/constants";
import { hasNegative, type Sums } from "@/lib/sums";
import { driverPay, overdueDays, paymentDue, routeText, stageBlocker, tripDays, tripMoney } from "@/lib/trips";
import { dueText, fmtDate, money, moneyMulti, nDays, parseNum, todayISO, vehicleTitle } from "@/lib/utils";
import type { Stage, Trip } from "@/lib/types";

/** Що автоматично заповнити, коли рейс переходить на етап */
function autoFill(t: Trip, next: Stage): Partial<Trip> {
  const today = todayISO();
  if (next === "docs" && !t.docs_received_on) return { docs_received_on: today };
  if (next === "invoiced" && !t.invoice_sent_on) return { invoice_sent_on: today };
  if (next === "originals" && !t.originals_sent_on) return { originals_sent_on: today };
  if (next === "paid") return { paid_on: t.paid_on ?? today, paid_amount: t.paid_amount ?? t.freight };
  return {};
}

export default function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { trips, vehicles, drivers, firms, clients, rates, supabase, reload, canEdit, loaded, addExpense } = useData();
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState("");
  const expenses = useExpenses({ trip_id: id });
  const t = trips.find((x) => x.id === id);
  if (!t) return <div className="empty">{loaded ? "Рейс не знайдено." : "Завантажую…"}</div>;

  const tractor = vehicles.find((v) => v.id === t.tractor_id);
  const trailer = vehicles.find((v) => v.id === t.trailer_id);
  const driver = drivers.find((d) => d.id === t.driver_id);
  const firm = firms.find((f) => f.id === t.firm_id);
  const client = clients.find((c) => c.id === t.client_id);
  const pay = driverPay(t, driver, rates);
  const m = tripMoney(t, firm, pay, expenses ?? []);
  const idx = stageIndex(t.stage);
  const next = t.stage === "cancelled" || t.stage === "paid" ? null : STAGES[idx + 1]?.key ?? null;
  const due = paymentDue(t);
  const od = overdueDays(t);
  const days = tripDays(t);

  async function patch(p: Partial<Trip>) {
    setErr("");
    const { error } = await supabase.from("trips").update(p).eq("id", t!.id);
    if (error) return setErr(dbError(error));
    await reload();
  }
  async function go(stage: Stage) {
    const b = stageBlocker(t!, stage);
    if (b && stageIndex(stage) > idx) return setErr(b);
    await patch({ stage, ...autoFill(t!, stage) });
  }
  const neg = (s: Sums) => moneyMulti(Object.fromEntries(Object.entries(s).map(([c, v]) => [c, -v])));

  return (
    <>
      <Link href="/trips" className="back">← Рейси</Link>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 8 }}><StageBadge stage={t.stage} />{od > 0 && <span className="badge late">оплата прострочена {nDays(od)}</span>}</div>
          <h1 style={{ marginTop: 8 }}>№{t.number} · {routeText(t)}</h1>
          <p>{[client?.name, t.client_ref && `заявка ${t.client_ref}`, t.cargo].filter(Boolean).join(" · ")}</p>
        </div>
        {canEdit && <button className="btn" onClick={() => setEdit(true)}>Редагувати</button>}
      </div>

      {t.stage !== "cancelled" && (
        <section className="card" aria-label="Етапи рейсу">
          <div className="stepper" aria-hidden="true">
            {STAGES.map((s, i) => <span key={s.key} className={i < idx ? "done" : i === idx ? "cur" : ""}>{s.short}</span>)}
          </div>
          {canEdit && (
            <div className="row">
              {next && <button className="btn primary" onClick={() => go(next)}>Далі: {stageLabel(next)}</button>}
              <select aria-label="Перейти на етап" value={t.stage} onChange={(e) => go(e.target.value as Stage)} style={{ width: "auto", flex: "1 1 180px" }}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <ConfirmButton label="Скасувати рейс" className="btn ghost sm" onConfirm={() => patch({ stage: "cancelled" })} />
            </div>
          )}
          {err && <div className="error" role="alert">{err}</div>}
        </section>
      )}
      {t.stage === "cancelled" && canEdit && (
        <div className="note row" style={{ justifyContent: "space-between" }}>Рейс скасовано.<button className="btn sm" onClick={() => patch({ stage: "request" })}>Відновити</button></div>
      )}

      <div className="cols">
        <section className="card" aria-labelledby="h-route">
          <h2 className="sec" id="h-route">Маршрут{days ? <span className="muted"> · {nDays(days)}</span> : null}</h2>
          <div className="route">
            {t.stops.map((s, i) => (
              <div key={i} className={`pt ${s.kind}`}>
                <span className="dot" aria-hidden="true" />
                <div><b>{s.place || countryName(s.country)}</b><div className="muted small">{s.kind === "load" ? "Завантаження" : "Розвантаження"} · {countryName(s.country)}</div></div>
                <span className="small">{s.date ? fmtDate(s.date) : "дата ?"}</span>
              </div>
            ))}
          </div>
          <dl className="kv">
            {(t.weight_t || t.pallets) && <><dt>Вага / палети</dt><dd>{[t.weight_t && `${t.weight_t} т`, t.pallets && `${t.pallets} палет`].filter(Boolean).join(" · ")}</dd></>}
            {t.customs_export && <><dt>Митниця відправлення</dt><dd>{t.customs_export}</dd></>}
            {t.customs_import && <><dt>Митниця призначення</dt><dd>{t.customs_import}</dd></>}
            {t.border && <><dt>Кордон</dt><dd>{t.border}</dd></>}
            {t.via_poland && <><dt>RMPD</dt><dd>{t.rmpd_number || <span className="neg">номер не внесено</span>}</dd></>}
            <dt>Тягач</dt><dd>{tractor ? <Link href={`/fleet/${tractor.id}`} className="row" style={{ gap: 8, textDecoration: "none" }}><Plate value={tractor.plate} />{vehicleTitle(tractor)}</Link> : "—"}</dd>
            <dt>Причіп</dt><dd>{trailer ? <Link href={`/fleet/${trailer.id}`} className="row" style={{ gap: 8, textDecoration: "none" }}><Plate value={trailer.plate} />{vehicleTitle(trailer)}</Link> : "—"}</dd>
            <dt>Водій</dt><dd>{driver ? <Link href={`/drivers/${driver.id}`}>{driver.full_name}</Link> : "—"}</dd>
            {t.note && <><dt>Нотатки</dt><dd style={{ whiteSpace: "pre-line", fontWeight: 400 }}>{t.note}</dd></>}
          </dl>
        </section>

        <section className="card" aria-labelledby="h-money">
          <h2 className="sec" id="h-money">Гроші</h2>
          <div className="money-tbl">
            <div className="r"><span>Фрахт · {PAYMENT_FORM_NAME[t.payment_form].toLowerCase()}{t.vat ? ", з ПДВ" : ""}</span><b>{t.freight != null ? money(t.freight, t.currency) : "не вказано"}</b></div>
            {firm && <div className="r"><span className="muted">Фірма</span><b>{firm.name}</b></div>}
            {Object.keys(m.fee).length > 0 && <div className="r"><span>Відсоток за проведення {m.feePercent}%</span><b className="neg">{neg(m.fee)}</b></div>}
            <div className="r"><span>Водію{pay.lines.length ? <span className="muted small"> · {pay.lines.join(", ")}</span> : null}</span><b className={Object.keys(m.driver).length ? "neg" : ""}>{Object.keys(m.driver).length ? neg(m.driver) : "—"}</b></div>
            <div className="r"><span>Витрати рейсу</span><b className={Object.keys(m.expenses).length ? "neg" : ""}>{Object.keys(m.expenses).length ? neg(m.expenses) : "—"}</b></div>
            <div className="r total"><span>Прибуток</span><b className={hasNegative(m.profit) ? "neg" : "pos"}>{moneyMulti(m.profit)}</b></div>
            {t.driver_advance != null && <div className="r small"><span className="muted">Аванс водію (врахується в зарплаті)</span><b>{money(t.driver_advance, t.driver_advance_currency)}</b></div>}
            <div className="muted small">Податки не враховані: їх рахує бухгалтер.</div>
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="h-docs">
        <h2 className="sec" id="h-docs">Документи й оплата</h2>
        <div className="docsteps">
          <DocStep done={!!t.docs_received_on} title="Водій надіслав ТТН / CMR">
            <DateIn value={t.docs_received_on} disabled={!canEdit} onChange={(v) => patch({ docs_received_on: v })} />
          </DocStep>
          <DocStep done={!!t.invoice_sent_on} title="Рахунок і акт надіслано замовнику">
            <DateIn value={t.invoice_sent_on} disabled={!canEdit} onChange={(v) => patch({ invoice_sent_on: v })} />
          </DocStep>
          {t.vat && (
            <DocStep done={t.tax_invoice_done} title="Податкова накладна зареєстрована">
              <label className="check"><input type="checkbox" checked={t.tax_invoice_done} disabled={!canEdit} onChange={(e) => patch({ tax_invoice_done: e.target.checked })} /> зареєстровано</label>
            </DocStep>
          )}
          <DocStep done={!!t.originals_sent_on} title="Оригінали відправлено поштою">
            <div className="row">
              <DateIn value={t.originals_sent_on} disabled={!canEdit} onChange={(v) => patch({ originals_sent_on: v })} />
              <TextIn value={t.originals_tracking} placeholder="ТТН Нової пошти" disabled={!canEdit} onSave={(v) => patch({ originals_tracking: v })} />
            </div>
          </DocStep>
          <DocStep done={!!t.originals_received_on} title="Замовник отримав оригінали">
            <DateIn value={t.originals_received_on} disabled={!canEdit} onChange={(v) => patch({ originals_received_on: v })} />
            {t.payment_days != null && <span className="muted small">Відстрочка {nDays(t.payment_days)}{due ? ` → оплата до ${fmtDate(due, true)} (${dueText(due)})` : ""}</span>}
          </DocStep>
          <DocStep done={!!t.paid_on} title="Оплату отримано">
            <div className="row">
              <DateIn value={t.paid_on} disabled={!canEdit} onChange={(v) => patch({ paid_on: v, ...(v && t.stage !== "paid" ? { stage: "paid" as Stage, paid_amount: t.paid_amount ?? t.freight } : {}) })} />
              <TextIn value={t.paid_amount != null ? String(t.paid_amount) : ""} placeholder={`Сума, ${t.currency}`} inputMode="decimal" disabled={!canEdit} onSave={(v) => patch({ paid_amount: parseNum(v) })} />
            </div>
          </DocStep>
        </div>
      </section>

      <section className="card" aria-labelledby="h-exp">
        <div className="sec-head">
          <h2 className="sec" id="h-exp">Витрати рейсу</h2>
          <button className="btn sm" onClick={() => addExpense({ trip_id: t.id, vehicle_id: t.tractor_id ?? undefined, driver_id: t.driver_id ?? undefined })}>+ Витрата</button>
        </div>
        {expenses ? <ExpenseRows rows={expenses} /> : <div className="empty">Завантажую…</div>}
      </section>

      {edit && <TripSheet trip={t} onClose={() => setEdit(false)} />}
    </>
  );
}

function DocStep({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="docstep">
      <span className={`ok ${done ? "on" : ""}`} aria-label={done ? "виконано" : "не виконано"}>{done ? "✓" : ""}</span>
      <div className="body"><b>{title}</b>{children}</div>
    </div>
  );
}

function DateIn({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  return <input type="date" aria-label="Дата" value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} style={{ maxWidth: 200 }} />;
}

/** Поле, що зберігається, коли з нього виходиш */
function TextIn({ value, onSave, placeholder, inputMode, disabled }: { value: string; onSave: (v: string) => void; placeholder?: string; inputMode?: "decimal" | "text"; disabled?: boolean }) {
  const [v, setV] = useState(value);
  return (
    <input aria-label={placeholder} placeholder={placeholder} inputMode={inputMode} value={v} disabled={disabled}
      onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v.trim())} />
  );
}
