import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkWatch } from "@/lib/lardiWatch";
import { sendPush } from "@/lib/push";
import { docLabel } from "@/lib/constants";
import { daysUntil, fmtPlate, nDays } from "@/lib/utils";
import { overdueDays, routeText } from "@/lib/trips";
import type { Doc, Driver, Trip, Vehicle } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Викликається з Supabase (pg_cron) кожні 5 хвилин. */
export async function POST(req: Request) {
  const db = createServiceClient();
  const { data: secret } = await db.from("integrations").select("token").eq("key", "cron").maybeSingle();
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret?.token || got !== secret.token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const report: Record<string, unknown> = {};

  // 1. Збережені пошуки Lardi
  const { data: watches } = await db.from("lardi_watches").select("id").eq("active", true);
  let fresh = 0;
  for (const w of watches ?? []) {
    const r = await checkWatch(w.id, true);
    fresh += r.fresh;
  }
  report.lardi = { watches: watches?.length ?? 0, fresh };

  // 2. Раз на день о 9:00 за Києвом — терміни документів і прострочені оплати
  const kyiv = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const part = (t: string) => kyiv.find((p) => p.type === t)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const hour = Number(part("hour"));
  const { data: daily } = await db.from("integrations").select("user_name").eq("key", "daily").maybeSingle();
  if (hour >= 9 && daily?.user_name !== today) {
    await db.from("integrations").upsert({ key: "daily", user_name: today, updated_at: new Date().toISOString() }, { onConflict: "key" });
    report.daily = await dailyDigest();
  }
  return NextResponse.json({ ok: true, ...report });
}

const REMIND_AT = [30, 14, 7, 3, 1, 0];

async function dailyDigest() {
  const db = createServiceClient();
  const [{ data: docs }, { data: vehicles }, { data: drivers }, { data: trips }] = await Promise.all([
    db.from("documents").select("*").not("expires_on", "is", null),
    db.from("vehicles").select("*"),
    db.from("drivers").select("*"),
    db.from("trips").select("*").in("stage", ["invoiced", "originals", "awaiting"]),
  ]);
  const owner = (d: Doc) => {
    const v = (vehicles as Vehicle[] | null)?.find((x) => x.id === d.vehicle_id);
    if (v) return fmtPlate(v.plate);
    return (drivers as Driver[] | null)?.find((x) => x.id === d.driver_id)?.full_name ?? "фірма";
  };
  let sent = 0;
  for (const d of (docs as Doc[] | null) ?? []) {
    const n = daysUntil(d.expires_on!);
    if (!REMIND_AT.includes(n) && n !== -1) continue;
    const when = n < 0 ? "термін минув учора" : n === 0 ? "закінчується сьогодні" : `закінчується через ${nDays(n)}`;
    await sendPush({ title: `${docLabel(d.doc_type, d.title)}: ${owner(d)}`, body: when, url: d.vehicle_id ? `/fleet/${d.vehicle_id}` : d.driver_id ? `/drivers/${d.driver_id}` : "/settings", tag: `doc-${d.id}` });
    sent++;
  }
  const late = ((trips as Trip[] | null) ?? []).filter((t) => overdueDays(t) > 0);
  if (late.length) {
    await sendPush({
      title: late.length === 1 ? "Прострочена оплата рейсу" : `Прострочено оплату ${late.length} рейсів`,
      body: late.slice(0, 3).map((t) => `№${t.number} ${routeText(t)} (−${nDays(overdueDays(t))})`).join("; "),
      url: "/trips", tag: "late-payments",
    });
    sent++;
  }
  return { sent };
}
