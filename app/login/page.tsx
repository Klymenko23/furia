"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo, ThemeToggle } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError("Невірна пошта або пароль. Перевірте дані або зверніться до власника фірми.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="logo"><Logo /></div>
        <p>Автопарк, водії, документи й витрати в одному місці</p>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="email">Пошта</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Входжу…" : "Увійти"}</button>
        <div style={{ display: "flex", justifyContent: "center" }}><ThemeToggle /></div>
      </form>
    </main>
  );
}
