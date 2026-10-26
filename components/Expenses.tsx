"use client";

import { useEffect, useState } from "react";
import { useData } from "./DataProvider";
import { Plate } from "./ui";
import { catIcon, catLabel, PAID_BY_NAME } from "@/lib/constants";
import { fmtDate, money, moneyMulti } from "@/lib/utils";
import type { Expense } from "@/lib/types";

export type ExpenseFilter = { from?: string; to?: string; vehicle_id?: string; driver_id?: string; trip_id?: string; category?: string; limit?: number };

/** Завантажує витрати за фільтром і перечитує після кожного збереження */
export function useExpenses(f: ExpenseFilter) {
  const { supabase, expenseRev } = useData();
  const [rows, setRows] = useState<Expense[] | null>(null);
  const key = JSON.stringify(f);
  useEffect(() => {
    let off = false;
    let q = supabase.from("expenses").select("*").order("spent_on", { ascending: false }).order("created_at", { ascending: false });
    if (f.from) q = q.gte("spent_on", f.from);
    if (f.to) q = q.lte("spent_on", f.to);
    if (f.vehicle_id) q = q.eq("vehicle_id", f.vehicle_id);
    if (f.driver_id) q = q.eq("driver_id", f.driver_id);
    if (f.trip_id) q = q.eq("trip_id", f.trip_id);
    if (f.category) q = q.eq("category", f.category);
    q.limit(f.limit ?? 1000).then(({ data }) => { if (!off) setRows((data as Expense[]) ?? []); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, key, expenseRev]);
  return rows;
}

/** Сума по валютах */
export function sumByCurrency(rows: Expense[]) {
  const s: Record<string, number> = {};
  for (const r of rows) s[r.currency] = (s[r.currency] ?? 0) + Number(r.amount);
  return s;
}

export function ExpenseRows({ rows, hideVehicle, hideDriver }: { rows: Expense[]; hideVehicle?: boolean; hideDriver?: boolean }) {
  const { vehicles, drivers, suppliers, addExpense } = useData();
  if (rows.length === 0) return <div className="empty">Витрат немає.</div>;
  return (
    <div className="list">
      {rows.map((r) => {
        const v = vehicles.find((x) => x.id === r.vehicle_id);
        const d = drivers.find((x) => x.id === r.driver_id);
        const s = suppliers.find((x) => x.id === r.supplier_id);
        return (
          <button key={r.id} type="button" className="li" onClick={() => addExpense(r)}>
            <span aria-hidden="true" className="li-ico">{catIcon(r.category)}</span>
            <div className="li-main">
              <span className="li-title">{catLabel(r.category)}{s ? ` · ${s.name}` : ""}</span>
              <span className="li-sub">
                {[fmtDate(r.spent_on), !hideDriver && d?.full_name, r.paid_by !== "firm" && PAID_BY_NAME[r.paid_by].toLowerCase(), r.mileage && `${r.mileage.toLocaleString("uk-UA")} км`, r.note].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="li-end">
              <b>{money(r.amount, r.currency)}</b>
              {!hideVehicle && v && <Plate value={v.plate} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function TotalLine({ rows, label = "Разом" }: { rows: Expense[]; label?: string }) {
  return <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">{label}</span><b>{moneyMulti(sumByCurrency(rows))}</b></div>;
}
