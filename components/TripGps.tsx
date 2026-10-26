"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "./DataProvider";
import { RouteMap, type MapPoint } from "./RouteMap";
import { ago } from "./Wialon";
import { wialonUnits } from "@/app/(app)/settings/wialon";
import { findUnit, gpsHint, isStale } from "@/lib/gps";
import { stageLabel } from "@/lib/constants";
import { fmtPlate } from "@/lib/utils";
import type { Stage, Trip } from "@/lib/types";
import type { WialonUnit } from "@/lib/wialon";

const ACTIVE: Stage[] = ["request", "loading", "transit", "customs", "unloading"];

/** Карта рейсу: точки, лінія маршруту, фура з Wialon і підказка етапу */
export function TripGps({ trip, onStage }: { trip: Trip; onStage: (s: Stage) => void }) {
  const { vehicles, canEdit } = useData();
  const tractor = vehicles.find((v) => v.id === trip.tractor_id);
  const [unit, setUnit] = useState<WialonUnit | null>(null);
  const [err, setErr] = useState("");
  const live = ACTIVE.includes(trip.stage) && !!tractor?.wialon_unit;

  async function load() {
    if (!tractor?.wialon_unit) return;
    const r = await wialonUnits();
    if (r.error) return setErr(r.error);
    const u = findUnit(r.units!, tractor.wialon_unit);
    if (!u) return setErr("Обʼєкт тягача не знайдено у Wialon.");
    setErr(""); setUnit(u);
  }
  // Поки рейс у дорозі — оновлюємо позицію раз на 2 хвилини
  useEffect(() => {
    if (!live) return;
    load();
    const t = setInterval(load, 120000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, tractor?.wialon_unit]);

  const points = useMemo<MapPoint[]>(() => {
    const p: MapPoint[] = trip.stops.filter((s) => s.lat != null && s.lon != null)
      .map((s) => ({ lat: s.lat!, lon: s.lon!, label: `${s.kind === "load" ? "Завантаження" : "Розвантаження"}: ${s.place}`, kind: s.kind }));
    if (unit?.lat != null && unit.lon != null) {
      p.push({ lat: unit.lat, lon: unit.lon, label: tractor ? fmtPlate(tractor.plate) : unit.name, kind: isStale(unit) ? "truck-old" : "truck" });
    }
    return p;
  }, [trip.stops, unit, tractor]);

  const hint = unit ? gpsHint(trip, unit) : null;
  if (points.length === 0 && !live) {
    return (
      <section className="card" aria-labelledby="h-map">
        <h2 className="sec" id="h-map">Карта</h2>
        <div className="note">Оберіть точки маршруту зі списку на карті в «Редагувати» — зʼявиться маршрут і кілометри.</div>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="h-map">
      <div className="sec-head">
        <h2 className="sec" id="h-map">Карта{trip.km ? <span className="muted"> · {trip.km.toLocaleString("uk-UA")} км по дорогах</span> : null}</h2>
        {live && <button className="btn ghost sm" onClick={load}>Оновити GPS</button>}
      </div>
      <RouteMap points={points} line={trip.route_line} />
      {live && unit && (
        <div className="small muted">
          {unit.time ? `Сигнал ${ago(unit.time)}` : "Немає часу сигналу"}{unit.speed != null ? ` · ${unit.speed} км/год` : ""}
          {hint?.leftKm ? ` · до розвантаження ~${hint.leftKm.toLocaleString("uk-UA")} км` : ""}
        </div>
      )}
      {hint && (
        hint.suggest ? (
          <div className="suggest">
            <span>{hint.text} Перевести рейс на етап «{stageLabel(hint.suggest)}»?</span>
            {canEdit && <button className="btn primary sm" onClick={() => onStage(hint.suggest!)}>Так, перевести</button>}
          </div>
        ) : <div className="muted small">{hint.text}</div>
      )}
      {err && <div className="error">{err}</div>}
      {!tractor?.wialon_unit && ACTIVE.includes(trip.stage) && <div className="muted small">Тягач не привʼязаний до Wialon, тому фури на карті немає.</div>}
    </section>
  );
}
