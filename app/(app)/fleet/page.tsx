"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { DueBadge, Plate, StatusBadge } from "@/components/ui";
import { VehicleSheet } from "@/components/VehicleSheet";
import { docLabel } from "@/lib/constants";
import { fmtPlate, nearestDoc, vehicleTitle } from "@/lib/utils";
import type { Vehicle, VehicleKind } from "@/lib/types";

export default function FleetPage() {
  const { vehicles, drivers, docs, canEdit, loaded } = useData();
  const [add, setAdd] = useState<VehicleKind | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const list = vehicles.filter((v) => showArchive || !v.archived);
  const archived = vehicles.filter((v) => v.archived).length;

  function Row({ v }: { v: Vehicle }) {
    const next = nearestDoc(docs.filter((d) => d.vehicle_id === v.id));
    const trailer = v.kind === "tractor" ? vehicles.find((t) => t.id === v.default_trailer_id) : null;
    const tractor = v.kind === "trailer" ? vehicles.find((t) => t.default_trailer_id === v.id) : null;
    const driver = drivers.find((d) => !d.archived && d.default_tractor_id === v.id);
    return (
      <Link href={`/fleet/${v.id}`} className="li">
        <Plate value={v.plate} />
        <div className="li-main">
          <span className="li-title">{vehicleTitle(v)}{v.archived ? " · в архіві" : ""}</span>
          <span className="li-sub">
            {[v.kind === "trailer" && v.body_type, driver?.full_name,
              trailer && `причіп ${fmtPlate(trailer.plate)}`, tractor && `з тягачем ${fmtPlate(tractor.plate)}`,
              next && `${docLabel(next.doc_type, next.title)}`].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="li-end">
          <StatusBadge status={v.status} />
          {next && <DueBadge date={next.expires_on} />}
        </div>
      </Link>
    );
  }

  const section = (kind: VehicleKind, title: string) => {
    const rows = list.filter((v) => v.kind === kind);
    return (
      <section className="card" aria-labelledby={`h-${kind}`}>
        <div className="sec-head">
          <h2 className="sec" id={`h-${kind}`}>{title} <span className="muted">{rows.length || ""}</span></h2>
          {canEdit && <button className="btn sm" onClick={() => setAdd(kind)}>+ {kind === "tractor" ? "Тягач" : "Причіп"}</button>}
        </div>
        {rows.length ? <div className="list">{rows.map((v) => <Row key={v.id} v={v} />)}</div>
          : <div className="empty">{loaded ? `Ще немає ${kind === "tractor" ? "тягачів" : "причепів"}.` : "Завантажую…"}</div>}
      </section>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Автопарк</h1>
          <p>Тягачі й причепи окремо. У тягача можна вказати звичайний причіп.</p>
        </div>
        {archived > 0 && <button className="btn ghost sm" onClick={() => setShowArchive(!showArchive)}>{showArchive ? "Сховати архів" : `Архів (${archived})`}</button>}
      </div>
      <div className="cols">
        {section("tractor", "Тягачі")}
        {section("trailer", "Причепи")}
      </div>
      {add && <VehicleSheet kind={add} onClose={() => setAdd(null)} />}
    </>
  );
}
