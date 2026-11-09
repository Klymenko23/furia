"use client";

import { useEffect, useState } from "react";
import { useData } from "./DataProvider";
import { pushPublicKey, testPush } from "@/app/(app)/loads/actions";

function b64ToBytes(b64: string) {
  const s = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "checking" | "unsupported" | "ios-home" | "denied" | "off" | "on";

/** Кнопка «Увімкнути сповіщення на цьому телефоні» */
export function PushToggle() {
  const { supabase } = useData();
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(ios && !standalone ? "ios-home" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      const k = await pushPublicKey();
      if (k.error) throw new Error(k.error);
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.key!) });
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const device = /iPhone/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Компʼютер";
      const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device }, { onConflict: "endpoint" });
      if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? "Спершу виконайте SQL 0005_lardi_push.sql у Supabase." : error.message);
      setState("on");
      setMsg({ ok: true, text: "Сповіщення увімкнено на цьому пристрої." });
    } catch (e) {
      setMsg({ text: (e as Error).message || "Не вдалося увімкнути сповіщення." });
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setBusy(false); setState("off"); setMsg(null);
  }

  async function test() {
    setBusy(true);
    const r = await testPush();
    setBusy(false);
    setMsg(r.error ? { text: r.error } : { ok: true, text: "Надіслано. За кілька секунд має прийти сповіщення." });
  }

  return (
    <section className="card" aria-labelledby="h-push">
      <div className="sec-head">
        <h2 className="sec" id="h-push">Сповіщення на телефон</h2>
        {state === "on" && <span className="badge ok">увімкнено</span>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>Нові вантажі з Lardi, терміни страховок і документів, прострочені оплати. Вмикається окремо на кожному телефоні.</p>
      {state === "ios-home" && (
        <div className="note">
          На iPhone сповіщення працюють лише з іконки на екрані «Додому»: у Safari натисніть «Поділитися» → «На екран Додому», відкрийте Furia з цієї іконки й поверніться сюди.
        </div>
      )}
      {state === "unsupported" && <div className="note">Цей браузер не підтримує сповіщення. Спробуйте Chrome або Safari з іконки на екрані «Додому».</div>}
      {state === "denied" && <div className="note">Сповіщення заборонені в налаштуваннях браузера або телефона для цього сайту. Дозвольте їх там і оновіть сторінку.</div>}
      <div className="row">
        {state === "off" && <button className="btn primary" onClick={enable} disabled={busy}>{busy ? "Вмикаю…" : "Увімкнути сповіщення"}</button>}
        {state === "on" && <button className="btn" onClick={test} disabled={busy}>Надіслати тестове</button>}
        {state === "on" && <button className="btn ghost sm" onClick={disable} disabled={busy}>Вимкнути на цьому пристрої</button>}
      </div>
      {msg && <div className={msg.ok ? "note" : "error"} role="status">{msg.text}</div>}
    </section>
  );
}
