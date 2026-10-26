"use client";

import { useEffect, useState } from "react";
import { useData } from "./DataProvider";
import { ConfirmButton, Field } from "./ui";
import { disconnectWialon, saveWialonBase, saveWialonPassword, saveWialonToken, wialonStatus, wialonUnits, type WialonStatus } from "@/app/(app)/settings/wialon";
import { loginUrl } from "@/lib/wialon";
import type { WialonUnit } from "@/lib/wialon";

/** «щойно», «12 хв тому», «3 год тому», «2 дні тому» */
export function ago(unix: number) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (s < 90) return "щойно";
  if (s < 3600) return `${Math.round(s / 60)} хв тому`;
  if (s < 86400) return `${Math.round(s / 3600)} год тому`;
  return `${Math.round(s / 86400)} дн тому`;
}

/** Блок у Налаштуваннях */
export function WialonSettings() {
  const { isOwner } = useData();
  const [st, setSt] = useState<WialonStatus | null>(null);
  const [base, setBase] = useState("https://megagps.net");
  const [manual, setManual] = useState(false);
  const [token, setToken] = useState("");
  const [wLogin, setWLogin] = useState("");
  const [wPass, setWPass] = useState("");
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [units, setUnits] = useState<WialonUnit[] | null>(null);

  const load = () => wialonStatus().then((s) => { setSt(s); if (s.base_url) setBase(s.base_url); });
  useEffect(() => { load(); }, []);

  async function login() {
    setBusy(true); setMsg(null);
    const r = await saveWialonBase(base);
    if (r.error) { setBusy(false); return setMsg({ text: r.error }); }
    window.location.href = loginUrl(r.base!, `${window.location.origin}/wialon`);
  }
  async function saveManual() {
    setBusy(true); setMsg(null);
    const b = await saveWialonBase(base);
    if (b.error) { setBusy(false); return setMsg({ text: b.error }); }
    const r = await saveWialonToken(token);
    setBusy(false);
    if (r.error) return setMsg({ text: r.error });
    setToken(""); setManual(false);
    setMsg({ ok: true, text: `Підключено. Знайдено обʼєктів: ${r.count}.` });
    load();
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await saveWialonPassword(base, wLogin, wPass);
    setBusy(false);
    if (r.error) return setMsg({ text: r.error });
    setWPass("");
    setMsg({ ok: true, text: `Підключено. Знайдено обʼєктів: ${r.count}. ${r.viaToken ? "Пароль не збережено: Furia отримала власний токен." : "Сервер не дозволив створити токен, тому логін і пароль збережено в закритій частині бази."}` });
    load();
  }

  async function check() {
    setBusy(true); setMsg(null);
    const r = await wialonUnits();
    setBusy(false);
    if (r.error) return setMsg({ text: r.error });
    setUnits(r.units!);
  }

  return (
    <section className="card" aria-labelledby="h-wialon">
      <div className="sec-head">
        <h2 className="sec" id="h-wialon">Wialon</h2>
        {st?.connected && <span className="badge ok">підключено</span>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Furia бачить, де машина, швидкість і час останнього сигналу. Підключайте гостьовий обліковий запис без права змінювати дані.
      </p>
      {st?.error && <div className="error">{st.error}</div>}

      {st?.connected ? (
        <>
          <dl className="kv">
            <dt>Сервер</dt><dd>{st.base_url}</dd>
            <dt>Обліковий запис</dt><dd>{st.user_name || "—"}</dd>
          </dl>
          <div className="row">
            <button className="btn sm" onClick={check} disabled={busy}>{busy ? "Перевіряю…" : "Перевірити звʼязок"}</button>
            {isOwner && <ConfirmButton label="Відключити" className="btn ghost sm" onConfirm={async () => { await disconnectWialon(); setUnits(null); load(); }} />}
          </div>
        </>
      ) : isOwner ? (
        <>
          <Field label="Адреса сервера Wialon" htmlFor="w-base" hint="Та, де ви входите в Wialon">
            <input id="w-base" inputMode="url" autoCapitalize="off" value={base} onChange={(e) => setBase(e.target.value)} />
          </Field>
          <form className="fields" onSubmit={savePassword} autoComplete="off">
            <Field label="Гостьовий логін" htmlFor="w-login">
              <input id="w-login" autoCapitalize="off" autoComplete="off" value={wLogin} onChange={(e) => setWLogin(e.target.value)} />
            </Field>
            <Field label="Пароль" htmlFor="w-pass">
              <input id="w-pass" type="password" autoComplete="new-password" value={wPass} onChange={(e) => setWPass(e.target.value)} />
            </Field>
            <div className="row field wide">
              <button className="btn primary" type="submit" disabled={busy || !wLogin.trim() || !wPass}>{busy ? "Підключаю…" : "Підключити"}</button>
            </div>
          </form>
          <p className="muted small" style={{ margin: 0 }}>
            Використовуйте лише гостьовий запис без права змінювати дані. Furia спробує отримати власний токен, щоб не зберігати пароль.
          </p>
          <div className="row small">
            <span className="muted">Інші способи:</span>
            <button className="linkbtn" type="button" onClick={login} disabled={busy}>сторінка входу Wialon</button>
            <button className="linkbtn" type="button" onClick={() => setManual(!manual)}>вставити токен</button>
          </div>
          {manual && (
            <div className="row">
              <input aria-label="Токен Wialon" autoComplete="off" placeholder="Токен (72 символи)" value={token} onChange={(e) => setToken(e.target.value)} style={{ flex: "1 1 240px", width: "auto", fontFamily: "var(--f-mono)", fontSize: 13 }} />
              <button className="btn sm" onClick={saveManual} disabled={busy || !token.trim()}>Зберегти</button>
            </div>
          )}
        </>
      ) : st && <div className="note">Wialon ще не підключено. Підключає власник.</div>}

      {msg && <div className={msg.ok ? "note" : "error"} role="status">{msg.text}</div>}
      {units && (
        <div className="list">
          {units.length === 0 && <div className="empty">Обʼєктів не знайдено. Перевірте, чи має гостьовий запис доступ до машин.</div>}
          {units.map((u) => (
            <div key={u.id} className="li">
              <div className="li-main">
                <span className="li-title">{u.name}</span>
                <span className="li-sub">{u.time ? `сигнал ${ago(u.time)}` : "немає даних про позицію"}{u.speed != null ? ` · ${u.speed} км/год` : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Вибір обʼєкта Wialon у формі тягача */
export function UnitPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [units, setUnits] = useState<WialonUnit[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { wialonUnits().then((r) => (r.units ? setUnits(r.units) : setErr(r.error ?? ""))); }, []);
  if (err || !units) {
    return (
      <Field label="Обʼєкт у Wialon" htmlFor="v-wialon" hint={err ? `${err} Можна вписати ID обʼєкта вручну.` : "Завантажую список з Wialon…"}>
        <input id="v-wialon" value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }
  return (
    <Field label="Обʼєкт у Wialon" htmlFor="v-wialon" hint="Звідси Furia бере позицію і швидкість">
      <select id="v-wialon" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— не привʼязано —</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        {value && !units.some((u) => u.id === value) && <option value={value}>{value} (не знайдено)</option>}
      </select>
    </Field>
  );
}

/** Позиція тягача на його картці */
export function LivePosition({ unitId }: { unitId: string }) {
  const [u, setU] = useState<WialonUnit | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    const r = await wialonUnits();
    setBusy(false);
    if (r.error) return setErr(r.error);
    const found = r.units!.find((x) => x.id === unitId || x.name === unitId);
    if (!found) return setErr("Обʼєкт не знайдено у Wialon. Перевірте привʼязку в картці.");
    setErr(""); setU(found);
  }
  useEffect(() => { load(); }, [unitId]);
  const old = u?.time ? Date.now() / 1000 - u.time > 2 * 3600 : false;

  return (
    <section className="card" aria-labelledby="h-gps">
      <div className="sec-head">
        <h2 className="sec" id="h-gps">Де машина</h2>
        <button className="btn ghost sm" onClick={load} disabled={busy}>{busy ? "Оновлюю…" : "Оновити"}</button>
      </div>
      {err ? <div className="error">{err}</div> : !u ? <div className="empty">Запитую Wialon…</div> : (
        <>
          <div className="stats">
            <div className="stat"><span className="k">Швидкість</span><span className="v">{u.speed ?? 0} км/год</span><span className="s">{(u.speed ?? 0) > 3 ? "їде" : "стоїть"}</span></div>
            <div className={`stat ${old ? "alert" : ""}`}><span className="k">Останній сигнал</span><span className="v" style={{ fontSize: 20 }}>{u.time ? ago(u.time) : "—"}</span><span className="s">{old ? "давно немає звʼязку: РЕБ або трекер вимкнено" : "звʼязок є"}</span></div>
          </div>
          {u.lat != null && u.lon != null && (
            <div className="row">
              <a className="btn sm" href={`https://www.google.com/maps?q=${u.lat},${u.lon}`} target="_blank" rel="noopener noreferrer">Відкрити на карті</a>
              <span className="muted small" style={{ fontFamily: "var(--f-mono)" }}>{u.lat.toFixed(5)}, {u.lon.toFixed(5)}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
