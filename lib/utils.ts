import { CUR_SIGN, PAY_SCHEME_NAME, URGENT_DAYS, WARN_DAYS } from "./constants";
import type { Doc, Driver, Vehicle } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => iso(new Date());

export const MON_G = ["січ", "лют", "бер", "квіт", "трав", "черв", "лип", "серп", "вер", "жовт", "лист", "груд"];
export const MON_N = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];

/** «12 лист 2026» (рік — лише якщо не поточний) */
export function fmtDate(s: string | null | undefined, withYear = false) {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  const showYear = withYear || y !== new Date().getFullYear();
  return `${d} ${MON_G[m - 1]}${showYear ? ` ${y}` : ""}`;
}

/** Днів до дати (відʼємне — уже минуло) */
export function daysUntil(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - t.getTime()) / 86400000);
}

/** «1 день», «3 дні», «12 днів» */
export function nDays(n: number) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return `${n} день`;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return `${n} дні`;
  return `${n} днів`;
}

export type DueState = "none" | "ok" | "warn" | "urgent" | "late";
export function dueState(dateISO: string | null): DueState {
  if (!dateISO) return "none";
  const n = daysUntil(dateISO);
  if (n < 0) return "late";
  if (n <= URGENT_DAYS) return "urgent";
  if (n <= WARN_DAYS) return "warn";
  return "ok";
}
export function dueText(dateISO: string | null) {
  if (!dateISO) return "дата не вказана";
  const n = daysUntil(dateISO);
  if (n < 0) return `прострочено ${nDays(-n)}`;
  if (n === 0) return "сьогодні останній день";
  if (n === 1) return "до завтра";
  return `ще ${nDays(n)}`;
}

/** «1 650 €», «18 000 грн» */
export function money(amount: number | null | undefined, currency = "UAH") {
  if (amount == null) return "";
  const v = Number(amount);
  const s = v.toLocaleString("uk-UA", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const sign = CUR_SIGN[currency] ?? currency;
  return `${s} ${sign}`;
}

/** Суми по валютах: { UAH: 18000, EUR: 120 } → «18 000 грн + 120 €» */
export function moneyMulti(sums: Record<string, number>) {
  const parts = Object.entries(sums).filter(([, v]) => v).map(([c, v]) => money(v, c));
  return parts.length ? parts.join(" + ") : "0 грн";
}

/** Номер для показу: «СВ 8065 ЕН» */
export function fmtPlate(p: string) {
  const s = p.replace(/\s+/g, "").toUpperCase();
  const m = s.match(/^([A-ZА-ЯІЇЄ]{2})(\d{4})([A-ZА-ЯІЇЄ]{2})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : p.toUpperCase();
}

export function vehicleTitle(v: Vehicle) {
  return [v.make, v.model].filter(Boolean).join(" ") || (v.kind === "tractor" ? "Тягач" : "Причіп");
}

export function initials(n: string | undefined) {
  return (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Число з поля вводу: «1 650,5» → 1650.5; порожнє → null */
export function parseNum(s: string): number | null {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const monthStart = (y: number, m: number) => `${y}-${pad(m + 1)}-01`;
export const monthEnd = (y: number, m: number) => iso(new Date(y, m + 1, 0));

/** Найближчий за датою документ */
export function nearestDoc(docs: Doc[]) {
  return docs.filter((d) => d.expires_on).sort((a, b) => a.expires_on!.localeCompare(b.expires_on!))[0];
}

/** «20% від фрахту», «ставка 30 000 грн» */
export function payText(d: Driver) {
  if (d.pay_scheme === "salary") return d.salary ? `ставка ${money(d.salary, d.salary_currency)}` : PAY_SCHEME_NAME.salary.toLowerCase();
  if (d.pay_scheme === "per_trip") return "сума за рейс";
  const p = d.pay_percent != null ? `${d.pay_percent}%` : "відсоток";
  return d.pay_scheme === "percent_daily" ? `${p} + добові` : `${p} від фрахту`;
}
