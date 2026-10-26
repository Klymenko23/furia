"use client";

import { useState } from "react";
import { useData } from "./DataProvider";
import { ConfirmButton, DueBadge, Field, Sheet, dbError } from "./ui";
import { docLabel, docTypesFor } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import type { Doc } from "@/lib/types";

type Subject = { kind: "tractor" | "trailer" | "driver" | "firm"; id: string };

const subjectCol = (s: Subject) => (s.kind === "driver" ? "driver_id" : s.kind === "firm" ? "firm_id" : "vehicle_id");

/** Документи з термінами для машини, водія чи фірми */
export function DocList({ subject }: { subject: Subject }) {
  const { docs, canEdit } = useData();
  const [edit, setEdit] = useState<Partial<Doc> | null>(null);
  const col = subjectCol(subject);
  const mine = docs
    .filter((d) => d[col] === subject.id)
    .sort((a, b) => (a.expires_on || "9999").localeCompare(b.expires_on || "9999"));
  // Яких типових документів ще не внесено — підказка, що варто додати
  const missing = docTypesFor(subject.kind).filter((t) => t.key !== "other" && !mine.some((d) => d.doc_type === t.key));

  return (
    <section className="card" aria-labelledby={`docs-${subject.id}`}>
      <div className="sec-head">
        <h2 className="sec" id={`docs-${subject.id}`}>Документи й терміни</h2>
        {canEdit && <button className="btn sm" onClick={() => setEdit({})}>+ Документ</button>}
      </div>
      {mine.length === 0 ? (
        <div className="empty">Ще немає документів. Додайте страховки, техогляд і інші папери з датою закінчення, і система нагадає заздалегідь.</div>
      ) : (
        <div className="list">
          {mine.map((d) => (
            <button key={d.id} type="button" className="li"
              disabled={!canEdit} onClick={() => setEdit(d)}>
              <div className="li-main">
                <span className="li-title">{docLabel(d.doc_type, d.title)}</span>
                <span className="li-sub">{[d.number && `№ ${d.number}`, d.expires_on && `до ${fmtDate(d.expires_on, true)}`, d.note].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="li-end"><DueBadge date={d.expires_on} /></div>
            </button>
          ))}
        </div>
      )}
      {canEdit && missing.length > 0 && (
        <div className="small muted">
          Ще не внесено: {missing.map((t, i) => (
            <span key={t.key}>{i > 0 && ", "}<button type="button" className="linkbtn" onClick={() => setEdit({ doc_type: t.key })}>{t.label}</button></span>
          ))}
        </div>
      )}
      {edit && <DocSheet subject={subject} doc={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function DocSheet({ subject, doc, onClose }: { subject: Subject; doc: Partial<Doc>; onClose: () => void }) {
  const { supabase, reload } = useData();
  const types = docTypesFor(subject.kind);
  const [type, setType] = useState(doc.doc_type ?? types[0].key);
  const [title, setTitle] = useState(doc.title ?? "");
  const [number, setNumber] = useState(doc.number ?? "");
  const [expires, setExpires] = useState(doc.expires_on ?? "");
  const [note, setNote] = useState(doc.note ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const hint = types.find((t) => t.key === type)?.hint;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (type === "other" && !title.trim()) return setErr("Напишіть назву документа.");
    setBusy(true);
    const row = { doc_type: type, title: type === "other" ? title.trim() : "", number: number.trim(), expires_on: expires || null, note: note.trim() };
    const { error } = doc.id
      ? await supabase.from("documents").update(row).eq("id", doc.id)
      : await supabase.from("documents").insert({ ...row, [subjectCol(subject)]: subject.id });
    setBusy(false);
    if (error) return setErr(dbError(error));
    await reload();
    onClose();
  }
  async function remove() {
    const { error } = await supabase.from("documents").delete().eq("id", doc.id!);
    if (error) return setErr(dbError(error));
    await reload();
    onClose();
  }

  return (
    <Sheet onClose={onClose} label="Документ">
      <h2>{doc.id ? "Документ" : "Новий документ"}</h2>
      <form className="form" onSubmit={save}>
        <div className="fields">
          <Field label="Документ" htmlFor="dc-type" wide hint={hint}>
            <select id="dc-type" value={type} onChange={(e) => setType(e.target.value)}>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          {type === "other" && (
            <Field label="Назва" htmlFor="dc-title" wide>
              <input id="dc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Напр.: Дозвіл на рух по Молдові" />
            </Field>
          )}
          <Field label="Діє до" htmlFor="dc-exp">
            <input id="dc-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </Field>
          <Field label="Номер" htmlFor="dc-num">
            <input id="dc-num" value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Коментар" htmlFor="dc-note" wide>
            <input id="dc-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Страхова, де оформлювали, сума…" />
          </Field>
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row end">
          {doc.id && <ConfirmButton label="Видалити" onConfirm={remove} />}
          <button type="button" className="btn ghost" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Зберігаю…" : "Зберегти"}</button>
        </div>
      </form>
    </Sheet>
  );
}
