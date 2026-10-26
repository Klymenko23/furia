"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Doc, Driver, Firm, Profile, Supplier, Vehicle } from "@/lib/types";
import { ExpenseSheet, type ExpenseDraft } from "./ExpenseSheet";

type Ctx = {
  me: Profile;
  supabase: ReturnType<typeof createClient>;
  canEdit: boolean;
  isOwner: boolean;
  loaded: boolean;
  vehicles: Vehicle[];
  drivers: Driver[];
  firms: Firm[];
  suppliers: Supplier[];
  docs: Doc[];
  reload: () => Promise<void>;
  /** Відкрити форму витрати (нову або з підставленими полями) */
  addExpense: (draft?: ExpenseDraft) => void;
  /** Лічильник, що змінюється після кожного збереження витрати — сторінки перечитують свої списки */
  expenseRev: number;
};

const DataCtx = createContext<Ctx | null>(null);

export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData поза DataProvider");
  return c;
}

export function DataProvider({ me, children }: { me: Profile; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [expenseRev, setExpenseRev] = useState(0);

  const reload = useCallback(async () => {
    const [v, d, f, s, dc] = await Promise.all([
      supabase.from("vehicles").select("*").order("kind", { ascending: false }).order("plate"),
      supabase.from("drivers").select("*").order("full_name"),
      supabase.from("firms").select("*").order("name"),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("documents").select("*").order("expires_on", { nullsFirst: false }),
    ]);
    if (v.data) setVehicles(v.data as Vehicle[]);
    if (d.data) setDrivers(d.data as Driver[]);
    if (f.data) setFirms(f.data as Firm[]);
    if (s.data) setSuppliers(s.data as Supplier[]);
    if (dc.data) setDocs(dc.data as Doc[]);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => { reload(); }, [reload]);

  const value: Ctx = {
    me, supabase,
    canEdit: me.role === "owner" || me.role === "dispatcher",
    isOwner: me.role === "owner",
    loaded, vehicles, drivers, firms, suppliers, docs, reload,
    addExpense: (d) => setDraft(d ?? {}),
    expenseRev,
  };

  return (
    <DataCtx.Provider value={value}>
      {children}
      {draft && (
        <ExpenseSheet draft={draft} onClose={() => setDraft(null)}
          onSaved={() => { setDraft(null); setExpenseRev((n) => n + 1); reload(); }} />
      )}
    </DataCtx.Provider>
  );
}
