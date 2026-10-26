"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { StageBadge } from "@/components/TripBits";
import { TripSheet } from "@/components/TripSheet";
import { Plate } from "@/components/ui";
import { STAGES } from "@/lib/constants";
import { addSum, type Sums } from "@/lib/sums";
import { overdueDays, routeText, tripDates } from "@/lib/trips";
import { fmtDate, money, moneyMulti, nDays } from "@/lib/utils";
import type { Stage, Trip } from "@/lib/types";

type Filter = "active" | "money" | "all" | Stage;
const ACTIVE: Stage[] = ["request", "loading", "transit", "customs", "unloading", "docs"];
const MONEY: Stage[] = ["invoiced", "originals", "awaiting"];

export default function TripsPage() {
  const { trips, vehicles, clients, canEdit, loaded, tripsReady } = useData();
  const [filter, setFilter] = useState<Filter>("active");
  const [add, setAdd] = useState(false);

  const match = (t: Trip) =>
    filter === "all" ? true : filter === "active" ? ACTIVE.includes(t.stage) : filter === "money" ? MONEY.includes(t.stage) : t.stage === filter;
  const list = trips.filter(match);
  const waiting: Sums = {};
  for (const t of trips) if (MONEY.includes(t.stage) && t.freight != null) addSum(waiting, t.currency, Number(t.freight) - Number(t.paid_amount ?? 0));
  const overdue = trips.filter((t) => overdueDays(t) > 0);

  if (loaded && !tripsReady) {
    return (
      <div className="note">
        У базі ще немає таблиць для рейсів. Виконайте в Supabase файл <b>0003_trips.sql</b> (SQL Editor → Run) і оновіть сторінку.
      </div>
    );
  }

  const chips: [Filter, string, number][] = [
    ["active", "У роботі", trips.filter((t) => ACTIVE.includes(t.stage)).length],
    ["money", "Чекаємо гроші", trips.filter((t) => MONEY.includes(t.stage)).length],
    ...STAGES.filter((s) => !["paid"].includes(s.key)).map((s) => [s.key, s.label, trips.filter((t) => t.stage === s.key).length] as [Filter, string, number]),
    ["paid", "Оплачено", trips.filter((t) => t.stage === "paid").length],
    ["all", "Усі", trips.length],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Рейси</h1>
          <p>Від заявки до оплати. Рейс не закриється, поки не пройде всі етапи.</p>
        </div>
        {canEdit && <button className="btn primary" onClick={() => setAdd(true)}>+ Рейс</button>}
      </div>

      <div className="stats">
        <div className="stat"><span className="k">У роботі</span><span className="v">{trips.filter((t) => ACTIVE.includes(t.stage)).length}</span><span className="s">рейсів зараз</span></div>
        <div className="stat"><span className="k">Чекаємо оплату</span><span className="v">{moneyMulti(waiting)}</span><span className="s">рахунки виставлено</span></div>
        <div className={`stat ${overdue.length ? "alert" : ""}`}><span className="k">Прострочена оплата</span><span className="v">{overdue.length}</span><span className="s">{overdue.length ? "нагадайте замовникам" : "все вчасно"}</span></div>
      </div>

      <div className="chips" role="group" aria-label="Фільтр за етапом">
        {chips.filter(([k, , n]) => n > 0 || k === "active" || k === filter).map(([k, label, n]) => (
          <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}<span className="n">{n}</span></button>
        ))}
      </div>

      <section className="card">
        {list.length === 0 ? (
          <div className="empty">
            {loaded ? (filter === "active" ? "Немає рейсів у роботі." : "Тут порожньо.") : "Завантажую…"}
            {loaded && canEdit && trips.length === 0 && <button className="btn primary sm" onClick={() => setAdd(true)}>Додати перший рейс</button>}
          </div>
        ) : (
          <div className="list">
            {list.map((t) => {
              const v = vehicles.find((x) => x.id === t.tractor_id);
              const c = clients.find((x) => x.id === t.client_id);
              const { start, end } = tripDates(t);
              const od = overdueDays(t);
              return (
                <Link key={t.id} href={`/trips/${t.id}`} className="li">
                  <div className="li-main">
                    <span className="li-title">№{t.number} · {routeText(t)}</span>
                    <span className="li-sub">{[c?.name, t.cargo, start && (end && end !== start ? `${fmtDate(start)} – ${fmtDate(end)}` : fmtDate(start))].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="li-end">
                    {t.freight != null && <b>{money(t.freight, t.currency)}</b>}
                    <StageBadge stage={t.stage} />
                    {od > 0 && <span className="badge late">оплата −{nDays(od)}</span>}
                    {v && <Plate value={v.plate} />}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      {add && <TripSheet onClose={() => setAdd(false)} />}
    </>
  );
}
