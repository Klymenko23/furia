"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useData } from "@/components/DataProvider";
import { DocList } from "@/components/Docs";
import { DriverSheet } from "@/components/DriverSheet";
import { ExpenseRows, sumByCurrency, useExpenses } from "@/components/Expenses";
import { Plate } from "@/components/ui";
import { PAY_SCHEME_NAME } from "@/lib/constants";
import { monthStart, moneyMulti, payText, vehicleTitle } from "@/lib/utils";

export default function DriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { drivers, vehicles, canEdit, loaded, addExpense } = useData();
  const [edit, setEdit] = useState(false);
  const d = drivers.find((x) => x.id === id);
  const rows = useExpenses({ driver_id: id, limit: 100 });

  if (!d) return <div className="empty">{loaded ? "Водія не знайдено." : "Завантажую…"}</div>;

  const t = vehicles.find((v) => v.id === d.default_tractor_id);
  const trailer = t ? vehicles.find((v) => v.id === t.default_trailer_id) : null;
  const now = new Date();
  const ownMoney = rows?.filter((e) => e.paid_by === "driver" && e.spent_on >= monthStart(now.getFullYear(), now.getMonth())) ?? [];

  return (
    <>
      <Link href="/drivers" className="back">← Водії</Link>
      <div className="page-head">
        <div>
          <h1>{d.full_name}</h1>
          <p>{payText(d)}{d.archived ? " · в архіві" : ""}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => addExpense({ driver_id: d.id, vehicle_id: d.default_tractor_id ?? undefined, paid_by: "driver" })}>+ Витрата водія</button>
          {canEdit && <button className="btn" onClick={() => setEdit(true)}>Редагувати</button>}
        </div>
      </div>

      <div className="cols">
        <section className="card" aria-labelledby="h-info">
          <h2 className="sec" id="h-info">Дані</h2>
          <dl className="kv">
            <dt>Телефон</dt>
            <dd>{d.phone ? <span style={{ userSelect: "all" }}>{d.phone}</span> : "—"}</dd>
            <dt>Мессенджер</dt><dd>{d.messenger || "—"}</dd>
            <dt>Тягач</dt>
            <dd>{t ? <Link href={`/fleet/${t.id}`} className="row" style={{ gap: 8, textDecoration: "none" }}><Plate value={t.plate} /> {vehicleTitle(t)}</Link> : "—"}</dd>
            <dt>Причіп</dt>
            <dd>{trailer ? <Link href={`/fleet/${trailer.id}`} className="row" style={{ gap: 8, textDecoration: "none" }}><Plate value={trailer.plate} /> {vehicleTitle(trailer)}</Link> : "—"}</dd>
            <dt>Оплата</dt><dd>{PAY_SCHEME_NAME[d.pay_scheme]}{d.pay_percent != null && (d.pay_scheme === "percent" || d.pay_scheme === "percent_daily") ? `, ${d.pay_percent}%` : ""}</dd>
            <dt>Витратив зі своїх цього місяця</dt><dd>{moneyMulti(sumByCurrency(ownMoney))}</dd>
            {d.note && <><dt>Нотатки</dt><dd style={{ whiteSpace: "pre-line", fontWeight: 400 }}>{d.note}</dd></>}
          </dl>
        </section>
        <DocList subject={{ kind: "driver", id: d.id }} />
      </div>

      <section className="card" aria-labelledby="h-exp">
        <h2 className="sec" id="h-exp">Витрати водія</h2>
        {rows ? <ExpenseRows rows={rows} hideDriver /> : <div className="empty">Завантажую…</div>}
      </section>
      {edit && <DriverSheet driver={d} onClose={() => setEdit(false)} />}
    </>
  );
}
