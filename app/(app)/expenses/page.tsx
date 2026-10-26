"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { ExpenseRows, sumByCurrency, useExpenses } from "@/components/Expenses";
import { CATEGORIES, catLabel } from "@/lib/constants";
import { fmtPlate, MON_N, monthEnd, monthStart, money, moneyMulti } from "@/lib/utils";
import type { Expense } from "@/lib/types";

/** Розбивка «ключ → суми по валютах», від найбільшої суми до найменшої */
function groupBy(rows: Expense[], key: (e: Expense) => string) {
  const m = new Map<string, Record<string, number>>();
  for (const e of rows) {
    const k = key(e);
    const s = m.get(k) ?? {};
    s[e.currency] = (s[e.currency] ?? 0) + Number(e.amount);
    m.set(k, s);
  }
  const total = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);
  return [...m.entries()].sort((a, b) => total(b[1]) - total(a[1]));
}

export default function ExpensesPage() {
  const { vehicles, addExpense } = useData();
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [vehicleId, setVehicleId] = useState("");
  const [category, setCategory] = useState("");
  const rows = useExpenses({ from: monthStart(y, m), to: monthEnd(y, m), vehicle_id: vehicleId || undefined, category: category || undefined });

  function shift(n: number) {
    const d = new Date(y, m + n, 1);
    setY(d.getFullYear()); setM(d.getMonth());
  }

  const byCat = rows ? groupBy(rows, (e) => e.category) : [];
  const byVeh = rows ? groupBy(rows, (e) => e.vehicle_id ?? "") : [];
  // Ширина смужок — за сумою в одній валюті, якою витрат найбільше
  const mainCur = rows?.length ? Object.entries(sumByCurrency(rows)).sort((a, b) => b[1] - a[1])[0][0] : "UAH";
  const maxCat = Math.max(1, ...byCat.map(([, s]) => s[mainCur] ?? 0));
  const maxVeh = Math.max(1, ...byVeh.map(([, s]) => s[mainCur] ?? 0));
  const vehName = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${fmtPlate(v.plate)} ${v.make}` : "Без машини";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Витрати</h1>
          <p>Пальне, дороги, колеса, запчастини, витрати водіїв.</p>
        </div>
        <button className="btn primary" onClick={() => addExpense({ vehicle_id: vehicleId || undefined, category: category || undefined })}>+ Витрата</button>
      </div>

      <div className="toolbar">
        <div className="month-nav">
          <button className="btn sm" onClick={() => shift(-1)} aria-label="Попередній місяць">‹</button>
          <b>{MON_N[m]} {y}</b>
          <button className="btn sm" onClick={() => shift(1)} aria-label="Наступний місяць">›</button>
        </div>
        <select aria-label="Машина" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">Усі машини</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{fmtPlate(v.plate)} {v.make}</option>)}
        </select>
        <select aria-label="Категорія" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Усі категорії</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="k">Усього за {MON_N[m].toLowerCase()}</span>
          <span className="v">{rows ? moneyMulti(sumByCurrency(rows)) : "…"}</span>
          <span className="s">{rows ? `${rows.length} записів` : ""}</span>
        </div>
        <div className="stat">
          <span className="k">Водії зі своїх</span>
          <span className="v">{rows ? moneyMulti(sumByCurrency(rows.filter((e) => e.paid_by === "driver"))) : "…"}</span>
          <span className="s">треба повернути або врахувати в зарплаті</span>
        </div>
      </div>

      {rows && rows.length > 0 && (
        <div className="cols">
          <section className="card" aria-labelledby="h-cat">
            <h2 className="sec" id="h-cat">За категоріями</h2>
            <div className="bars">
              {byCat.map(([k, s]) => (
                <div key={k} className="bar-row">
                  <div className="top"><span>{catLabel(k)}</span><b>{Object.entries(s).map(([c, v]) => money(v, c)).join(" + ")}</b></div>
                  <div className="bar"><i style={{ width: `${((s[mainCur] ?? 0) / maxCat) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
          <section className="card" aria-labelledby="h-veh">
            <h2 className="sec" id="h-veh">За машинами</h2>
            <div className="bars">
              {byVeh.map(([k, s]) => (
                <div key={k || "none"} className="bar-row">
                  <div className="top"><span>{vehName(k)}</span><b>{Object.entries(s).map(([c, v]) => money(v, c)).join(" + ")}</b></div>
                  <div className="bar"><i style={{ width: `${((s[mainCur] ?? 0) / maxVeh) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="card" aria-labelledby="h-list">
        <h2 className="sec" id="h-list">Записи</h2>
        {rows ? (rows.length ? <ExpenseRows rows={rows} /> : (
          <div className="empty">
            За цей місяць витрат немає.
            <button className="btn primary sm" onClick={() => addExpense()}>Додати першу</button>
          </div>
        )) : <div className="empty">Завантажую…</div>}
      </section>
    </>
  );
}
