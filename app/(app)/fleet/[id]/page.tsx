"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useData } from "@/components/DataProvider";
import { DocList } from "@/components/Docs";
import { ExpenseRows, sumByCurrency, useExpenses } from "@/components/Expenses";
import { Plate, StatusBadge } from "@/components/ui";
import { VehicleSheet } from "@/components/VehicleSheet";
import { LivePosition } from "@/components/Wialon";
import { StageBadge } from "@/components/TripBits";
import { driverPay, routeText, tripDates, tripMoney } from "@/lib/trips";
import { hasNegative, mergeSums, type Sums } from "@/lib/sums";
import { catLabel, KIND_NAME } from "@/lib/constants";
import { fmtPlate, monthStart, money, moneyMulti, vehicleTitle } from "@/lib/utils";

export default function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { vehicles, drivers, firms, trips, rates, canEdit, loaded, addExpense } = useData();
  const [edit, setEdit] = useState(false);
  const v = vehicles.find((x) => x.id === id);
  const all = useExpenses({ vehicle_id: id });

  if (!v) return <div className="empty">{loaded ? "Машину не знайдено." : "Завантажую…"}</div>;

  const trailer = vehicles.find((t) => t.id === v.default_trailer_id);
  const tractor = v.kind === "trailer" ? vehicles.find((t) => t.default_trailer_id === v.id) : null;
  const driverList = drivers.filter((d) => !d.archived && d.default_tractor_id === v.id);
  const firm = firms.find((f) => f.id === v.firm_id);
  const now = new Date();
  const month = all?.filter((e) => e.spent_on >= monthStart(now.getFullYear(), now.getMonth())) ?? [];
  // Витрати по категоріях за весь час (по основній валюті кожної категорії — показуємо суми по валютах)
  const byCat: Record<string, Record<string, number>> = {};
  for (const e of all ?? []) {
    byCat[e.category] ??= {};
    byCat[e.category][e.currency] = (byCat[e.category][e.currency] ?? 0) + Number(e.amount);
  }

  return (
    <>
      <Link href="/fleet" className="back">← Автопарк</Link>
      <div className="page-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="row"><Plate value={v.plate} lg /><StatusBadge status={v.status} />{v.archived && <span className="badge none">в архіві</span>}</div>
          <h1>{vehicleTitle(v)}</h1>
          <p>{KIND_NAME[v.kind]}{v.year ? `, ${v.year} р.` : ""}{v.kind === "trailer" && v.body_type ? ` · ${v.body_type}` : ""}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => addExpense({ vehicle_id: v.id, driver_id: driverList[0]?.id })}>+ Витрата</button>
          {canEdit && <button className="btn" onClick={() => setEdit(true)}>Редагувати</button>}
        </div>
      </div>

      <div className="cols">
        <section className="card" aria-labelledby="h-info">
          <h2 className="sec" id="h-info">Дані</h2>
          <dl className="kv">
            {v.kind === "tractor" && <><dt>Причіп</dt><dd>{trailer ? <Link href={`/fleet/${trailer.id}`}>{fmtPlate(trailer.plate)} {trailer.make}</Link> : "—"}</dd></>}
            {v.kind === "trailer" && <><dt>Тягач</dt><dd>{tractor ? <Link href={`/fleet/${tractor.id}`}>{fmtPlate(tractor.plate)} {tractor.make}</Link> : "—"}</dd></>}
            {v.kind === "tractor" && <><dt>Водій</dt><dd>{driverList.length ? driverList.map((d, i) => <span key={d.id}>{i > 0 && ", "}<Link href={`/drivers/${d.id}`}>{d.full_name}</Link></span>) : "—"}</dd></>}
            {v.kind === "trailer" && <><dt>Обсяг / вага</dt><dd>{[v.volume_m3 && `${v.volume_m3} м³`, v.capacity_t && `${v.capacity_t} т`].filter(Boolean).join(" · ") || "—"}</dd></>}
            <dt>Пробіг</dt><dd>{v.mileage ? `${v.mileage.toLocaleString("uk-UA")} км` : "—"}</dd>
            <dt>Фірма</dt><dd>{firm?.name ?? "—"}</dd>
            <dt>VIN</dt><dd style={{ fontFamily: "var(--f-mono)", fontSize: 13 }}>{v.vin || "—"}</dd>
            {v.kind === "tractor" && <><dt>Wialon</dt><dd>{v.wialon_unit ? "привʼязано" : "не привʼязано: оберіть обʼєкт у «Редагувати»"}</dd></>}
            {v.note && <><dt>Нотатки</dt><dd style={{ whiteSpace: "pre-line", fontWeight: 400 }}>{v.note}</dd></>}
          </dl>
        </section>
        <DocList subject={{ kind: v.kind, id: v.id }} />
      </div>

      {v.kind === "tractor" && v.wialon_unit && <LivePosition unitId={v.wialon_unit} />}

      {(() => {
        const mine = trips.filter((t) => t.stage !== "cancelled" && (t.tractor_id === v.id || t.trailer_id === v.id));
        if (!mine.length) return null;
        const ms = monthStart(now.getFullYear(), now.getMonth());
        const profitOf = (t: (typeof mine)[number]) => tripMoney(t, firms.find((f) => f.id === t.firm_id), driverPay(t, drivers.find((d) => d.id === t.driver_id), rates), (all ?? []).filter((e) => e.trip_id === t.id)).profit;
        const monthTrips = mine.filter((t) => (tripDates(t).end ?? "") >= ms);
        // Прибуток машини за місяць: прибуток рейсів мінус витрати машини поза рейсами (колеса, ремонт, страховки)
        const offTrip: Sums = {};
        for (const e of month.filter((e) => !e.trip_id)) offTrip[e.currency] = (offTrip[e.currency] ?? 0) - Number(e.amount);
        const monthProfit = mergeSums(...monthTrips.map(profitOf), offTrip);
        return (
          <section className="card" aria-labelledby="h-trips">
            <div className="sec-head">
              <h2 className="sec" id="h-trips">Рейси</h2>
              {v.kind === "tractor" && <span className="small muted">прибуток цього місяця: <b className={hasNegative(monthProfit) ? "neg" : "pos"}>{moneyMulti(monthProfit)}</b></span>}
            </div>
            <div className="list">
              {mine.slice(0, 20).map((t) => {
                const p = profitOf(t);
                return (
                  <Link key={t.id} href={`/trips/${t.id}`} className="li">
                    <div className="li-main"><span className="li-title">№{t.number} · {routeText(t)}</span><span className="li-sub">{t.freight != null ? money(t.freight, t.currency) : ""}</span></div>
                    <div className="li-end"><b className={hasNegative(p) ? "neg" : "pos"}>{moneyMulti(p)}</b><StageBadge stage={t.stage} /></div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })()}

      <section className="card" aria-labelledby="h-exp">
        <div className="sec-head">
          <h2 className="sec" id="h-exp">Витрати</h2>
          <span className="muted small">цього місяця: <b style={{ color: "var(--ink)" }}>{moneyMulti(sumByCurrency(month))}</b></span>
        </div>
        {all && Object.keys(byCat).length > 0 && (
          <div className="row small" style={{ gap: 6 }}>
            {Object.entries(byCat).map(([k, sums]) => (
              <span key={k} className="badge none">{catLabel(k)}: {Object.entries(sums).map(([c, s]) => money(s, c)).join(" + ")}</span>
            ))}
          </div>
        )}
        {all ? <ExpenseRows rows={all.slice(0, 50)} hideVehicle /> : <div className="empty">Завантажую…</div>}
      </section>
      {edit && <VehicleSheet vehicle={v} onClose={() => setEdit(false)} />}
    </>
  );
}
