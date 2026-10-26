"use client";

import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { ExpenseRows, sumByCurrency, useExpenses } from "@/components/Expenses";
import { DueBadge, Plate, StatusBadge } from "@/components/ui";
import { docLabel, WARN_DAYS } from "@/lib/constants";
import { daysUntil, monthStart, moneyMulti, vehicleTitle } from "@/lib/utils";

export default function Overview() {
  const { me, vehicles, drivers, firms, docs, loaded } = useData();
  const now = new Date();
  const month = useExpenses({ from: monthStart(now.getFullYear(), now.getMonth()) });

  // Терміни, що закінчуються протягом 30 днів або вже минули
  const soon = docs
    .filter((d) => d.expires_on && daysUntil(d.expires_on) <= WARN_DAYS)
    .sort((a, b) => a.expires_on!.localeCompare(b.expires_on!));
  const late = soon.filter((d) => daysUntil(d.expires_on!) < 0).length;
  const owner = (d: (typeof docs)[number]) => {
    if (d.vehicle_id) { const v = vehicles.find((x) => x.id === d.vehicle_id); return v ? { href: `/fleet/${v.id}`, plate: v.plate, name: vehicleTitle(v) } : null; }
    if (d.driver_id) { const x = drivers.find((y) => y.id === d.driver_id); return x ? { href: `/drivers/${x.id}`, name: x.full_name } : null; }
    const f = firms.find((y) => y.id === d.firm_id); return f ? { href: "/settings", name: f.name } : null;
  };
  const active = vehicles.filter((v) => !v.archived);
  const empty = loaded && active.length === 0 && drivers.length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Вітаю, {me.full_name.split(" ")[0]}</h1>
          <p>{now.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      </div>

      {empty && (
        <div className="note">
          Почніть з автопарку: додайте тягач і причіп, потім водія. Документи з термінами вносяться в картці кожної машини й водія.
          <div className="row" style={{ marginTop: 10 }}><Link className="btn primary sm" href="/fleet">Відкрити автопарк</Link></div>
        </div>
      )}

      <div className="stats">
        <Link href="#terms" className={`stat ${late ? "alert" : ""}`}>
          <span className="k">Терміни горять</span>
          <span className="v">{soon.length}</span>
          <span className="s">{late ? `з них прострочено: ${late}` : `найближчі ${WARN_DAYS} днів`}</span>
        </Link>
        <Link href="/expenses" className="stat">
          <span className="k">Витрати цього місяця</span>
          <span className="v">{month ? moneyMulti(sumByCurrency(month)) : "…"}</span>
          <span className="s">{month ? `${month.length} записів` : ""}</span>
        </Link>
        <Link href="/fleet" className="stat">
          <span className="k">Автопарк</span>
          <span className="v">{active.filter((v) => v.kind === "tractor").length} + {active.filter((v) => v.kind === "trailer").length}</span>
          <span className="s">тягачів і причепів</span>
        </Link>
      </div>

      <div className="cols">
        <section className="card" id="terms" aria-labelledby="h-terms">
          <h2 className="sec" id="h-terms">Терміни документів</h2>
          {soon.length === 0 ? (
            <div className="empty">{loaded ? `У найближчі ${WARN_DAYS} днів нічого не закінчується.` : "Завантажую…"}</div>
          ) : (
            <div className="list">
              {soon.map((d) => {
                const o = owner(d);
                return (
                  <Link key={d.id} href={o?.href ?? "#"} className="li">
                    {o?.plate ? <Plate value={o.plate} /> : <span className="av" aria-hidden="true">{(o?.name ?? "?")[0]}</span>}
                    <div className="li-main">
                      <span className="li-title">{docLabel(d.doc_type, d.title)}</span>
                      <span className="li-sub">{o?.name}</span>
                    </div>
                    <div className="li-end"><DueBadge date={d.expires_on} /></div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="h-fleet">
          <h2 className="sec" id="h-fleet">Машини</h2>
          {active.length === 0 ? <div className="empty">{loaded ? "Ще немає машин." : "Завантажую…"}</div> : (
            <div className="list">
              {active.filter((v) => v.kind === "tractor").concat(active.filter((v) => v.kind === "trailer")).map((v) => {
                const drv = drivers.find((x) => !x.archived && x.default_tractor_id === v.id);
                return (
                  <Link key={v.id} href={`/fleet/${v.id}`} className="li">
                    <Plate value={v.plate} />
                    <div className="li-main">
                      <span className="li-title">{vehicleTitle(v)}</span>
                      <span className="li-sub">{drv?.full_name ?? (v.kind === "trailer" ? "причіп" : "водія не закріплено")}</span>
                    </div>
                    <div className="li-end"><StatusBadge status={v.status} /></div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="h-last">
        <div className="sec-head">
          <h2 className="sec" id="h-last">Останні витрати</h2>
          <Link href="/expenses" className="btn ghost sm">Усі витрати</Link>
        </div>
        {month ? <ExpenseRows rows={month.slice(0, 8)} /> : <div className="empty">Завантажую…</div>}
      </section>
    </>
  );
}
