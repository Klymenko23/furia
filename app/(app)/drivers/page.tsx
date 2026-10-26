"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { DriverSheet } from "@/components/DriverSheet";
import { DueBadge, Plate } from "@/components/ui";
import { docLabel } from "@/lib/constants";
import { initials, nearestDoc, payText } from "@/lib/utils";

export default function DriversPage() {
  const { drivers, vehicles, docs, canEdit, loaded } = useData();
  const [add, setAdd] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const list = drivers.filter((d) => showArchive || !d.archived);
  const archived = drivers.filter((d) => d.archived).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Водії</h1>
          <p>Схема оплати, закріплений тягач і терміни документів.</p>
        </div>
        <div className="row">
          {archived > 0 && <button className="btn ghost sm" onClick={() => setShowArchive(!showArchive)}>{showArchive ? "Сховати архів" : `Архів (${archived})`}</button>}
          {canEdit && <button className="btn primary" onClick={() => setAdd(true)}>+ Водій</button>}
        </div>
      </div>
      <section className="card">
        {list.length === 0 ? <div className="empty">{loaded ? "Ще немає водіїв." : "Завантажую…"}</div> : (
          <div className="list">
            {list.map((d) => {
              const t = vehicles.find((v) => v.id === d.default_tractor_id);
              const next = nearestDoc(docs.filter((x) => x.driver_id === d.id));
              return (
                <Link key={d.id} href={`/drivers/${d.id}`} className="li">
                  <span className="av" aria-hidden="true">{initials(d.full_name)}</span>
                  <div className="li-main">
                    <span className="li-title">{d.full_name}{d.archived ? " · в архіві" : ""}</span>
                    <span className="li-sub">{[payText(d), d.phone, next && docLabel(next.doc_type, next.title)].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="li-end">
                    {t && <Plate value={t.plate} />}
                    {next && <DueBadge date={next.expires_on} />}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      {add && <DriverSheet onClose={() => setAdd(false)} />}
    </>
  );
}
