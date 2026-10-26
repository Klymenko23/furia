"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { RouteMap, type MapPoint } from "@/components/RouteMap";
import { StageBadge } from "@/components/TripBits";
import { Plate } from "@/components/ui";
import { ago } from "@/components/Wialon";
import { wialonUnits } from "../settings/wialon";
import { findUnit, gpsHint, isStale } from "@/lib/gps";
import { routeText } from "@/lib/trips";
import { fmtPlate, vehicleTitle } from "@/lib/utils";
import type { Stage } from "@/lib/types";
import type { WialonUnit } from "@/lib/wialon";

const ACTIVE: Stage[] = ["request", "loading", "transit", "customs", "unloading", "docs"];

export default function MapPage() {
  const { vehicles, trips, drivers } = useData();
  const [units, setUnits] = useState<WialonUnit[] | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    const r = await wialonUnits();
    if (r.error) setErr(r.error); else { setErr(""); setUnits(r.units!); }
  }
  useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t); }, []);

  const tractors = vehicles.filter((v) => v.kind === "tractor" && !v.archived);
  const rows = tractors.map((v) => {
    const u = units && v.wialon_unit ? findUnit(units, v.wialon_unit) : undefined;
    const trip = trips.find((t) => t.tractor_id === v.id && ACTIVE.includes(t.stage));
    const driver = drivers.find((d) => d.id === (trip?.driver_id ?? "")) ?? drivers.find((d) => !d.archived && d.default_tractor_id === v.id);
    return { v, u, trip, driver, hint: trip && u ? gpsHint(trip, u) : null };
  });

  const points = useMemo<MapPoint[]>(() => rows.filter((r) => r.u?.lat != null && r.u?.lon != null).map((r) => ({
    lat: r.u!.lat!, lon: r.u!.lon!,
    label: `${fmtPlate(r.v.plate)}${r.trip ? ` · №${r.trip.number}` : ""}`,
    kind: isStale(r.u!) ? "truck-old" : "truck",
  })), [rows]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Карта</h1>
          <p>Де зараз кожна фура і на якому вона етапі рейсу. Оновлюється раз на 2 хвилини.</p>
        </div>
        <button className="btn ghost sm" onClick={load}>Оновити</button>
      </div>
      {err && <div className="error">{err} Підключення — в Налаштуваннях.</div>}
      <RouteMap points={points} height={420} />
      <section className="card">
        {rows.length === 0 ? <div className="empty">Ще немає тягачів.</div> : (
          <div className="list">
            {rows.map(({ v, u, trip, driver, hint }) => (
              <div key={v.id} className="li">
                <Plate value={v.plate} />
                <div className="li-main">
                  <Link href={trip ? `/trips/${trip.id}` : `/fleet/${v.id}`} className="li-title" style={{ textDecoration: "none" }}>
                    {trip ? `№${trip.number} · ${routeText(trip)}` : vehicleTitle(v)}
                  </Link>
                  <span className="li-sub">
                    {[driver?.full_name,
                      !v.wialon_unit ? "не привʼязано до Wialon" : !u ? (units ? "немає в Wialon" : "запитую GPS…") : u.time ? `сигнал ${ago(u.time)}${u.speed ? `, ${u.speed} км/год` : ", стоїть"}` : "",
                      hint?.leftKm ? `до розвантаження ~${hint.leftKm} км` : ""].filter(Boolean).join(" · ")}
                  </span>
                  {hint?.suggest && <span className="small" style={{ color: "var(--blue)", fontWeight: 600 }}>GPS: {hint.text}</span>}
                </div>
                <div className="li-end">{trip ? <StageBadge stage={trip.stage} /> : <span className="badge none">без рейсу</span>}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
