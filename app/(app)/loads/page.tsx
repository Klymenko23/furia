"use client";

import { useCallback, useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { PushToggle } from "@/components/PushToggle";
import { ConfirmButton, Field } from "@/components/ui";
import { checkNow, disconnectLardi, lardiStatus, saveLardiToken, saveWatch } from "./actions";
import type { CheckResult } from "@/lib/lardiWatch";
import type { Cargo } from "@/lib/lardi";

type Watch = {
  id: string; name: string; from_text: string; to_text: string; from_town_id: number | null; to_town_id: number | null;
  radius_km: number; active: boolean; last_checked_at: string | null; last_error: string;
};
type Found = { watch_id: string; proposal_id: string; data: Cargo; found_at: string };

function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 2) return "щойно";
  if (m < 60) return `${m} хв тому`;
  if (m < 1440) return `${Math.round(m / 60)} год тому`;
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

export default function LoadsPage() {
  const { supabase, canEdit, isOwner } = useData();
  const [status, setStatus] = useState<{ connected?: boolean; user?: string; error?: string } | null>(null);
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [found, setFound] = useState<Found[]>([]);
  const [tableErr, setTableErr] = useState("");
  const [token, setToken] = useState("");
  const [from, setFrom] = useState("Одеса");
  const [to, setTo] = useState("Чернігів");
  const [radius, setRadius] = useState("30");
  const [msg, setMsg] = useState<{ ok?: boolean; text: string; raw?: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<{ id: string; r: CheckResult } | null>(null);

  const load = useCallback(async () => {
    setStatus(await lardiStatus());
    const w = await supabase.from("lardi_watches").select("*").order("created_at");
    if (w.error) { setTableErr("У базі ще немає таблиць для вантажів і сповіщень. Виконайте SQL з файлу 0005_lardi_push.sql у Supabase."); setWatches([]); return; }
    setTableErr("");
    setWatches(w.data as Watch[]);
    const f = await supabase.from("lardi_found").select("*").order("found_at", { ascending: false }).limit(60);
    setFound((f.data as Found[]) ?? []);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy("token"); setMsg(null);
    const r = await saveLardiToken(token);
    setBusy("");
    if (r.error) return setMsg({ text: r.error });
    setToken("");
    setMsg({ ok: true, text: `Lardi підключено: ${r.user}.` });
    load();
  }
  async function addWatch(e: React.FormEvent) {
    e.preventDefault();
    setBusy("watch"); setMsg(null);
    const r = await saveWatch({ from, to, radius: Number(radius) || 0 });
    setBusy("");
    if (r.error) return setMsg({ text: r.error });
    load();
  }
  async function toggle(w: Watch) {
    await supabase.from("lardi_watches").update({ active: !w.active }).eq("id", w.id);
    load();
  }
  async function remove(w: Watch) {
    await supabase.from("lardi_watches").delete().eq("id", w.id);
    load();
  }
  async function test(w: Watch) {
    setBusy(w.id); setResult(null);
    const r = await checkNow(w.id);
    setBusy("");
    setResult({ id: w.id, r });
    load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Вантажі</h1>
          <p>Збережені пошуки на Lardi-Trans. Furia перевіряє їх кожні 5 хвилин і надсилає пуш, щойно зʼявляється новий вантаж.</p>
        </div>
      </div>

      {tableErr && <div className="error">{tableErr}</div>}

      <PushToggle />

      <section className="card" aria-labelledby="h-lardi">
        <div className="sec-head">
          <h2 className="sec" id="h-lardi">Lardi-Trans</h2>
          {status?.connected && <span className="badge ok">підключено</span>}
        </div>
        {status?.connected ? (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small">Обліковий запис: <b>{status.user}</b></span>
            {isOwner && <ConfirmButton label="Відключити" className="btn ghost sm" onConfirm={async () => { await disconnectLardi(); load(); }} />}
          </div>
        ) : (
          <>
            <p className="muted small" style={{ margin: 0 }}>
              Потрібен токен API з Lardi: Налаштування → API → створити токен. Розділ API є лише в пакетах Lardi з доступом до API; якщо його немає, уточніть у підтримці Lardi.
            </p>
            {isOwner ? (
              <form className="row" onSubmit={connect}>
                <input aria-label="Токен Lardi" autoComplete="off" placeholder="Токен API Lardi" value={token} onChange={(e) => setToken(e.target.value)} style={{ flex: "1 1 240px", width: "auto", fontFamily: "var(--f-mono)", fontSize: 13 }} />
                <button className="btn primary" type="submit" disabled={busy === "token" || token.trim().length < 10}>{busy === "token" ? "Перевіряю…" : "Підключити"}</button>
              </form>
            ) : <div className="note">Підключає власник.</div>}
          </>
        )}
        {msg && (
          <div className={msg.ok ? "note" : "error"} role="status">{msg.text}</div>
        )}
      </section>

      <section className="card" aria-labelledby="h-watch">
        <h2 className="sec" id="h-watch">Що шукати</h2>
        {canEdit && (
          <form className="fields" onSubmit={addWatch}>
            <Field label="Звідки" htmlFor="lw-from"><input id="lw-from" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Куди" htmlFor="lw-to"><input id="lw-to" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Радіус навколо міста, км" htmlFor="lw-r"><input id="lw-r" inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} /></Field>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <button className="btn primary" type="submit" disabled={busy === "watch"}>{busy === "watch" ? "Додаю…" : "+ Стежити"}</button>
            </div>
          </form>
        )}
        {watches === null ? <div className="empty">Завантажую…</div> : watches.length === 0 ? (
          <div className="empty">Ще немає збережених пошуків.</div>
        ) : (
          <div className="list">
            {watches.map((w) => (
              <div key={w.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="li">
                  <div className="li-main">
                    <span className="li-title">{w.from_text} → {w.to_text}{!w.active ? " · на паузі" : ""}</span>
                    <span className="li-sub">
                      {[w.radius_km ? `радіус ${w.radius_km} км` : "",
                        w.from_town_id && w.to_town_id ? "міста знайдено в Lardi" : "пошук за назвою",
                        w.last_checked_at ? `перевірено ${ago(w.last_checked_at)}` : "ще не перевірявся"].filter(Boolean).join(" · ")}
                    </span>
                    {w.last_error && <span className="small" style={{ color: "var(--red)", fontWeight: 600 }}>{w.last_error}</span>}
                  </div>
                  <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                    <button className="btn sm" onClick={() => test(w)} disabled={busy === w.id}>{busy === w.id ? "Шукаю…" : "Перевірити зараз"}</button>
                    {canEdit && <button className="btn ghost sm" onClick={() => toggle(w)}>{w.active ? "Пауза" : "Увімкнути"}</button>}
                    {canEdit && <ConfirmButton label="Видалити" onConfirm={() => remove(w)} />}
                  </div>
                </div>
                {result?.id === w.id && (
                  result.r.error ? (
                    <div className="error">
                      {result.r.error}
                      {result.r.raw && <details style={{ marginTop: 6 }}><summary>Відповідь Lardi (для налаштування)</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{result.r.raw}</pre></details>}
                    </div>
                  ) : (
                    <div className="note">
                      Знайдено {result.r.found.length}, нових: {result.r.fresh}. Перша перевірка лише запамʼятовує вантажі; пуші приходитимуть про ті, що зʼявляться далі.
                      {result.r.raw && <details style={{ marginTop: 6 }}><summary>Відповідь Lardi</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{result.r.raw}</pre></details>}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="h-found">
        <h2 className="sec" id="h-found">Знайдені вантажі</h2>
        {found.length === 0 ? <div className="empty">Поки нічого. Нові вантажі зʼявлятимуться тут і в пушах.</div> : (
          <div className="list">
            {found.map((f) => (
              <a key={f.watch_id + f.proposal_id} href={f.data.url} target="_blank" rel="noopener noreferrer" className="li">
                <div className="li-main">
                  <span className="li-title">{f.data.from || "?"} → {f.data.to || "?"}</span>
                  <span className="li-sub">{[f.data.cargo, f.data.weight, f.data.body, f.data.date && `завантаження ${f.data.date}`].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="li-end">
                  {f.data.price && <b>{f.data.price}</b>}
                  <span className="small muted">{ago(f.found_at)}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
