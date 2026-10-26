"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { StageBadge } from "@/components/TripBits";
import { ConfirmButton, Field, Sheet, dbError } from "@/components/ui";
import { CLIENT_CHANNELS } from "@/lib/constants";
import { addSum, type Sums } from "@/lib/sums";
import { overdueDays, routeText } from "@/lib/trips";
import { moneyMulti, parseNum } from "@/lib/utils";
import type { Client } from "@/lib/types";

export default function ClientsPage() {
  const { clients, trips, canEdit, loaded, tripsReady } = useData();
  const [edit, setEdit] = useState<Partial<Client> | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  if (loaded && !tripsReady) return <div className="note">Спершу виконайте в Supabase файл <b>0003_trips.sql</b>.</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Замовники</h1>
          <p>Хто дає вантажі, звідки приходять заявки і хто затримує оплату.</p>
        </div>
        {canEdit && <button className="btn primary" onClick={() => setEdit({})}>+ Замовник</button>}
      </div>
      <section className="card">
        {clients.length === 0 ? <div className="empty">{loaded ? "Ще немає замовників. Вони додаються самі, коли вносите рейс." : "Завантажую…"}</div> : (
          <div className="list">
            {clients.map((c) => {
              const mine = trips.filter((t) => t.client_id === c.id);
              const owed: Sums = {};
              for (const t of mine) if (["invoiced", "originals", "awaiting"].includes(t.stage) && t.freight != null) addSum(owed, t.currency, Number(t.freight) - Number(t.paid_amount ?? 0));
              const late = mine.filter((t) => overdueDays(t) > 0).length;
              return (
                <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="li">
                    <button type="button" className="li-btn" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                      <span className="li-main">
                        <span className="li-title">{c.name}</span>
                        <span className="li-sub">{[c.contact, c.phone, c.channel, c.directions, c.payment_days != null && `відстрочка ${c.payment_days} дн`, `${mine.length} рейсів`].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="li-end">
                        {Object.keys(owed).length > 0 && <b>{moneyMulti(owed)}</b>}
                        {late > 0 && <span className="badge late">прострочено: {late}</span>}
                      </span>
                    </button>
                    {canEdit && <button type="button" className="btn ghost sm" onClick={() => setEdit(c)}>Змінити</button>}
                  </div>
                  {open === c.id && (
                    <div className="list" style={{ paddingLeft: 12, borderLeft: "3px solid var(--line)" }}>
                      {mine.length === 0 ? <div className="muted small">Рейсів ще не було.</div> : mine.slice(0, 20).map((t) => (
                        <Link key={t.id} href={`/trips/${t.id}`} className="li">
                          <div className="li-main"><span className="li-title">№{t.number} · {routeText(t)}</span></div>
                          <div className="li-end"><StageBadge stage={t.stage} /></div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      {edit && <ClientSheet c={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ClientSheet({ c, onClose }: { c: Partial<Client>; onClose: () => void }) {
  const { supabase, reload } = useData();
  const [name, setName] = useState(c.name ?? "");
  const [contact, setContact] = useState(c.contact ?? "");
  const [phone, setPhone] = useState(c.phone ?? "");
  const [channel, setChannel] = useState(c.channel ?? "");
  const [directions, setDirections] = useState(c.directions ?? "");
  const [days, setDays] = useState(c.payment_days != null ? String(c.payment_days) : "");
  const [note, setNote] = useState(c.note ?? "");
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Вкажіть назву.");
    const row = { name: name.trim(), contact: contact.trim(), phone: phone.trim(), channel, directions: directions.trim(), payment_days: parseNum(days), note: note.trim() };
    const { error } = c.id ? await supabase.from("clients").update(row).eq("id", c.id) : await supabase.from("clients").insert(row);
    if (error) return setErr(dbError(error));
    await reload(); onClose();
  }
  async function remove() {
    const { error } = await supabase.from("clients").delete().eq("id", c.id!);
    if (error) return setErr(dbError(error));
    await reload(); onClose();
  }

  return (
    <Sheet onClose={onClose} label="Замовник">
      <h2>{c.id ? c.name : "Новий замовник"}</h2>
      <form className="form" onSubmit={save}>
        <div className="fields">
          <Field label="Назва" htmlFor="c-name" wide><input id="c-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Контактна особа" htmlFor="c-contact"><input id="c-contact" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
          <Field label="Телефон" htmlFor="c-phone"><input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Звідки заявки" htmlFor="c-channel">
            <select id="c-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">— не вказано —</option>
              {CLIENT_CHANNELS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Відстрочка, днів" htmlFor="c-days"><input id="c-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
          <Field label="Звичні напрямки" htmlFor="c-dir" wide><input id="c-dir" placeholder="Польща, Чехія, Молдова" value={directions} onChange={(e) => setDirections(e.target.value)} /></Field>
          <Field label="Нотатки" htmlFor="c-note" wide><textarea id="c-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row end">
          {c.id && <ConfirmButton label="Видалити" onConfirm={remove} />}
          <button type="button" className="btn ghost" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn primary">Зберегти</button>
        </div>
      </form>
    </Sheet>
  );
}
