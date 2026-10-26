"use client";

import { useEffect, useState } from "react";
import { dueState, dueText, fmtDate, fmtPlate } from "@/lib/utils";
import { STATUS_NAME } from "@/lib/constants";
import type { VehicleStatus } from "@/lib/types";

type Theme = "light" | "dark" | "system";
const THEMES: [Theme, string, string][] = [
  ["light", "☀︎", "Світла тема"],
  ["dark", "☾", "Темна тема"],
  ["system", "Авто", "Як у системі"],
];

function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "system") delete el.dataset.theme;
  else el.dataset.theme = t;
  try {
    if (t === "system") localStorage.removeItem("furia-theme");
    else localStorage.setItem("furia-theme", t);
  } catch {}
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setTheme(t === "light" || t === "dark" ? t : "system");
  }, []);
  return (
    <div className="theme-seg" role="group" aria-label="Тема оформлення">
      {THEMES.map(([k, label, title]) => (
        <button key={k} type="button" title={title} aria-label={title} aria-pressed={theme === k}
          onClick={() => { applyTheme(k); setTheme(k); }}>{label}</button>
      ))}
    </div>
  );
}

export function Logo() {
  return (
    <>
      <span className="mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 16V2h10v3.4H7.6v2.7h5.7v3.3H7.6V16z" fill="currentColor" /></svg>
      </span>
      Furia
    </>
  );
}

export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="sheet-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

/** Кнопка видалення з підтвердженням другим натиском */
export function ConfirmButton({ label, onConfirm, className = "btn danger sm" }: { label: string; onConfirm: () => void; className?: string }) {
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 4000); return () => clearTimeout(t); }, [sure]);
  return (
    <button type="button" className={className} onClick={() => (sure ? onConfirm() : setSure(true))}>
      {sure ? "Точно? Натисніть ще раз" : label}
    </button>
  );
}

export function Plate({ value, lg }: { value: string; lg?: boolean }) {
  return <span className={`plate ${lg ? "lg" : ""}`} aria-label={`Номер ${value}`}><span>{fmtPlate(value)}</span></span>;
}

export function DueBadge({ date }: { date: string | null }) {
  const st = dueState(date);
  return <span className={`badge ${st}`} title={date ? `до ${fmtDate(date, true)}` : undefined}>{dueText(date)}</span>;
}

export function StatusBadge({ status }: { status: VehicleStatus }) {
  return <span className={`badge st-${status}`}>{STATUS_NAME[status]}</span>;
}

export function Field({ label, htmlFor, hint, wide, children }: { label: string; htmlFor?: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`field ${wide ? "wide" : ""}`}>
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="lbl">{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** Помилки бази → зрозуміла фраза */
export function dbError(e: { message?: string; code?: string } | null | undefined) {
  if (!e) return "";
  const m = e.message || "";
  if (e.code === "23505" || /duplicate|unique/i.test(m)) return "Такий запис уже є. Перевірте номер або назву.";
  if (e.code === "42501" || /row-level security|permission/i.test(m)) return "Немає прав на цю дію. Зверніться до власника.";
  if (/fetch|network/i.test(m)) return "Немає звʼязку з сервером. Перевірте інтернет і спробуйте ще раз.";
  return "Не вдалося зберегти: " + m;
}
