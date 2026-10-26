"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Client, DailyRate, Doc, Driver, Firm, Profile, Supplier, Trip, Vehicle } from "@/lib/types";
import { ExpenseSheet, type ExpenseDraft } from "./ExpenseSheet";

type Ctx = {
  me: Profile;
  supabase: ReturnType<typeof createClient>;
  canEdit: boolean;
  isOwner: boolean;
  loaded: boolean;
  /** false, якщо в базі ще немає таблиці рейсів */
  tripsReady: boolean;
  vehicles: Vehicle[];
  drivers: Driver[];
  firms: Firm[];
  suppliers: Supplier[];
  docs: Doc[];
  clients: Client[];
  trips: Trip[];
  rates: DailyRate[];
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
  const [clients, setClients] = useState<Client[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rates, setRates] = useState<DailyRate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tripsReady, setTripsReady] = useState(true);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [expenseRev, setExpenseRev] = useState(0);

  const reload = useCallback(async () => {
    const [v, d, f, s, dc, cl, tr, rt] = await Promise.all([
      supabase.from("vehicles").select("*").order("kind", { ascending: false }).order("plate"),
      supabase.from("drivers").select("*").order("full_name"),
      supabase.from("firms").select("*").order("name"),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("documents").select("*").order("expires_on", { nullsFirst: false }),
      supabase.from("clients").select("*").order("name"),
      supabase.from("trips").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("daily_rates").select("*"),
    ]);
    if (v.data) setVehicles(v.data as Vehicle[]);
    if (d.data) setDrivers(d.data as Driver[]);
    if (f.data) setFirms(f.data as Firm[]);
    if (s.data) setSuppliers(s.data as Supplier[]);
    if (dc.data) setDocs(dc.data as Doc[]);
    // Рейсів і замовників може ще не бути в базі (не виконано 0003_trips.sql) — тоді просто порожньо
    if (cl.data) setClients(cl.data as Client[]);
    if (tr.data) setTrips(tr.data as Trip[]);
    setTripsReady(!tr.error);
    if (rt.data) setRates(rt.data as DailyRate[]);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => { reload(); }, [reload]);

  const value: Ctx = {
    me, supabase,
    canEdit: me.role === "owner" || me.role === "dispatcher",
    isOwner: me.role === "owner",
    loaded, tripsReady, vehicles, drivers, firms, suppliers, docs, clients, trips, rates, reload,
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
