"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { sumByCurrency, useExpenses } from "@/components/Expenses";
import { addSum, hasNegative, mergeSums, type Sums } from "@/lib/sums";
import { driverPay, routeText, tripDates } from "@/lib/trips";
import { MON_N, monthEnd, monthStart, money, moneyMulti, payText } from "@/lib/utils";

export default function SalaryPage() {
  const { drivers, trips, rates, loaded, tripsReady } = useData();
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const from = monthStart(y, m), to = monthEnd(y, m);
  const own = useExpenses({ from, to });

  function shift(n: number) { const d = new Date(y, m + n, 1); setY(d.getFullYear()); setM(d.getMonth()); }

  if (loaded && !tripsReady) return <div className="note">Спершу виконайте в Supabase файл <b>0003_trips.sql</b>.</div>;

  // Рейс належить місяцю, у якому він закінчився (остання дата розвантаження)
  const monthTrips = trips.filter((t) => {
    if (t.stage === "cancelled") return false;
    const end = tripDates(t).end;
    return end && end >= from && end <= to;
  });

  const rows = drivers.filter((d) => !d.archived || monthTrips.some((t) => t.driver_id === d.id)).map((d) => {
    const mine = monthTrips.filter((t) => t.driver_id === d.id);
    const earned: Sums = {};
    const perTrip = mine.map((t) => {
      const p = driverPay(t, d, rates);
      for (const [c, v] of Object.entries(p.sums)) addSum(earned, c, v);
      return { t, p };
    });
    if (d.pay_scheme === "salary" && d.salary) addSum(earned, d.salary_currency, Number(d.salary));
    const reimburse = sumByCurrency((own ?? []).filter((e) => e.driver_id === d.id && e.paid_by === "driver"));
    const advances: Sums = {};
    for (const t of mine) if (t.driver_advance) addSum(advances, t.driver_advance_currency, -Number(t.driver_advance));
    const total = mergeSums(earned, reimburse, advances);
    return { d, perTrip, earned, reimburse, advances, total };
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Зарплата водіїв</h1>
          <p>За схемою кожного водія: відсоток, добові, ставка або сума за рейс. Плюс його витрати зі своїх, мінус аванси.</p>
        </div>
        <div className="month-nav">
          <button className="btn sm" onClick={() => shift(-1)} aria-label="Попередній місяць">‹</button>
          <b>{MON_N[m]} {y}</b>
          <button className="btn sm" onClick={() => shift(1)} aria-label="Наступний місяць">›</button>
        </div>
      </div>

      {rows.length === 0 && <div className="empty">{loaded ? "Немає водіїв." : "Завантажую…"}</div>}
      {rows.map(({ d, perTrip, earned, reimburse, advances, total }) => (
        <section key={d.id} className="card" aria-labelledby={`sal-${d.id}`}>
          <div className="sec-head">
            <h2 className="sec" id={`sal-${d.id}`}><Link href={`/drivers/${d.id}`} style={{ textDecoration: "none" }}>{d.full_name}</Link></h2>
            <span className="muted small">{payText(d)}</span>
          </div>
          {perTrip.length > 0 && (
            <div className="list">
              {perTrip.map(({ t, p }) => (
                <Link key={t.id} href={`/trips/${t.id}`} className="li">
                  <div className="li-main">
                    <span className="li-title">№{t.number} · {routeText(t)}</span>
                    <span className="li-sub">{[t.freight != null && `фрахт ${money(t.freight, t.currency)}`, ...p.lines].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="li-end"><b>{moneyMulti(p.sums)}</b></div>
                </Link>
              ))}
            </div>
          )}
          {perTrip.length === 0 && d.pay_scheme !== "salary" && <div className="muted small">Рейсів, що закінчились цього місяця, немає.</div>}
          <div className="money-tbl">
            <div className="r"><span>Заробив{d.pay_scheme === "salary" ? " (ставка)" : ""}</span><b>{moneyMulti(earned)}</b></div>
            {Object.keys(reimburse).length > 0 && <div className="r"><span>Повернути витрати зі своїх</span><b>{moneyMulti(reimburse)}</b></div>}
            {Object.keys(advances).length > 0 && <div className="r"><span>Мінус аванси в рейси</span><b className="neg">{moneyMulti(advances)}</b></div>}
            <div className="r total"><span>До виплати</span><b className={hasNegative(total) ? "neg" : ""}>{moneyMulti(total)}</b></div>
          </div>
        </section>
      ))}
    </>
  );
}
