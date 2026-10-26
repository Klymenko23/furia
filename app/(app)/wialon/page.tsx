"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveWialonToken } from "../settings/wialon";

/** Сюди Wialon повертає після входу: /wialon?access_token=…&user_name=… */
export default function WialonCallback() {
  const [msg, setMsg] = useState("Підключаю Wialon…");
  const [ok, setOk] = useState<boolean | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const q = new URLSearchParams(window.location.search);
    const token = q.get("access_token");
    // токен прибираємо з адресного рядка, щоб він не лишився в історії браузера
    window.history.replaceState(null, "", "/wialon");
    if (!token) {
      setOk(false);
      setMsg(q.get("error") ? "Вхід у Wialon скасовано або не вдався." : "Wialon не повернув токен. Спробуйте ще раз із Налаштувань.");
      return;
    }
    saveWialonToken(token, q.get("user_name") ?? "").then((r) => {
      if (r.error) { setOk(false); setMsg(r.error); }
      else { setOk(true); setMsg(`Wialon підключено. Знайдено обʼєктів: ${r.count}. Тепер привʼяжіть тягач до свого обʼєкта в картці машини.`); }
    });
  }, []);

  return (
    <section className="card" style={{ maxWidth: 560 }}>
      <h1 className="sec">Підключення Wialon</h1>
      <div className={ok === false ? "error" : "note"} role="status">{msg}</div>
      <div className="row">
        <Link className="btn primary" href={ok ? "/fleet" : "/settings"}>{ok ? "До автопарку" : "До налаштувань"}</Link>
      </div>
    </section>
  );
}
