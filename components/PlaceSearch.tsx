"use client";

import { useEffect, useRef, useState } from "react";
import { geocode, type Place } from "@/app/(app)/trips/geo";

/** Поле «місто/село» з пошуком по карті (Україна, ЄС, Молдова) */
export function PlaceSearch({ value, hasPoint, onText, onPick }: {
  value: string;
  hasPoint: boolean;
  onText: (v: string) => void;
  onPick: (p: Place) => void;
}) {
  const [hits, setHits] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const typed = useRef(false);

  // Пошук з паузою після введення, щоб не смикати сервіс на кожну літеру
  useEffect(() => {
    if (!typed.current || value.trim().length < 3) { setHits([]); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await geocode(value);
      setBusy(false);
      setErr(r.error ?? "");
      setHits(r.places ?? []);
      setOpen(true); setHi(0);
    }, 600);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(p: Place) { typed.current = false; onPick(p); setOpen(false); setHits([]); }

  return (
    <div className="place" ref={box}>
      <input aria-label="Місто або село" placeholder="Місто, село…" autoComplete="off" value={value}
        onChange={(e) => { typed.current = true; onText(e.target.value); }}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((hi + 1) % hits.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((hi - 1 + hits.length) % hits.length); }
          else if (e.key === "Enter") { e.preventDefault(); pick(hits[hi]); }
        }} />
      <div className="small" style={{ marginTop: 3, minHeight: 15 }}>
        {busy ? <span className="muted">шукаю на карті…</span> : hasPoint ? <span className="pin">● на карті</span> : value.trim().length >= 3 ? <span className="muted">оберіть зі списку, щоб порахувати км</span> : null}
      </div>
      {open && (hits.length > 0 || err) && (
        <div className="place-list" role="listbox">
          {err && <div className="place-opt" style={{ cursor: "default" }}>{err}</div>}
          {hits.map((h, i) => (
            <button key={`${h.lat},${h.lon}`} type="button" role="option" aria-selected={i === hi} className="place-opt"
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
              <b>{h.place} <small className="muted">{h.country}</small></b>
              <span>{h.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
