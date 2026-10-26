/** Розрахунки по рейсу: дні, зарплата водія, відсоток за проведення, витрати, прибуток, строк оплати. */
import type { DailyRate, Driver, Expense, Firm, Trip } from "./types";
import { addSum, type Sums } from "./sums";
import { countryName } from "./constants";
import { daysUntil, fmtPlate } from "./utils";
import type { Vehicle } from "./types";

/** Перша дата завантаження і остання дата розвантаження */
export function tripDates(t: Trip) {
  const dates = t.stops.map((s) => s.date).filter(Boolean).sort();
  return { start: dates[0] ?? null, end: dates[dates.length - 1] ?? null };
}

/** Днів у рейсі (включно з першим і останнім днем) */
export function tripDays(t: Trip) {
  const { start, end } = tripDates(t);
  if (!start || !end) return 0;
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1);
}

/** «Вінниця → Познань» */
export function routeText(t: Trip) {
  const first = t.stops.find((s) => s.kind === "load");
  const last = [...t.stops].reverse().find((s) => s.kind === "unload");
  const name = (s?: { place: string; country: string }) => s ? (s.place || countryName(s.country)) : "?";
  return `${name(first)} → ${name(last)}`;
}

export type DriverPay = { sums: Sums; lines: string[] };

/** Скільки заробив водій на рейсі за його схемою оплати */
export function driverPay(t: Trip, d: Driver | undefined, rates: DailyRate[]): DriverPay {
  const sums: Sums = {};
  const lines: string[] = [];
  if (!d) return { sums, lines: ["Водія не вказано"] };
  // Ручна сума в рейсі має пріоритет (схема «сума за рейс» або домовленість)
  if (t.driver_pay != null) {
    addSum(sums, t.driver_pay_currency, Number(t.driver_pay));
    lines.push("сума за рейс");
    return { sums, lines };
  }
  if (d.pay_scheme === "salary") return { sums, lines: ["ставка — рахується в зарплаті за місяць"] };
  if (d.pay_scheme === "per_trip") return { sums, lines: ["вкажіть суму водію в рейсі"] };
  const pct = Number(d.pay_percent ?? 0);
  if (t.freight != null && pct) {
    addSum(sums, t.currency, (Number(t.freight) * pct) / 100);
    lines.push(`${pct}% від фрахту`);
  }
  if (d.pay_scheme === "percent_daily") {
    const days = tripDays(t);
    const rate = rates.find((r) => r.country === t.daily_country);
    if (days && rate) {
      addSum(sums, rate.currency, days * Number(rate.amount));
      lines.push(`добові: ${days} дн × ${rate.amount} ${rate.currency} (${countryName(rate.country)})`);
    } else lines.push(t.daily_country ? "немає ставки добових для цієї країни" : "оберіть країну для добових");
  }
  return { sums, lines };
}

export type UahBreakdown = { rate: number; gross: number; vat: number; tax: number; fee: number; net: number; taxPercent: number };

export type TripMoney = {
  freight: Sums;
  fee: Sums;          // відсоток за проведення через фірму
  driver: Sums;
  expenses: Sums;
  profit: Sums;
  feePercent: number;
  /** Для безготівки: скільки гривень реально залишиться на рахунку після ПДВ, податку і відсотка */
  uah: UahBreakdown | null;
};

const VAT = 0.2;

/** Прибуток рейсу.
 *  Безготівка з курсом: фрахт у гривнях − ПДВ (якщо рейс з ПДВ, фрахт вважається з ПДВ) − податок фірми − відсоток за проведення;
 *  далі мінус водій і витрати (у валюті рейсу перераховуються за тим самим курсом).
 *  Готівка: фрахт − водій − витрати, без податків. */
export function tripMoney(t: Trip, firm: Firm | undefined, pay: DriverPay, expenses: Expense[]): TripMoney {
  const freight: Sums = {}, fee: Sums = {}, exp: Sums = {}, profit: Sums = {};
  const feePercent = Number(firm?.fee_percent ?? 0);
  const taxPercent = Number(firm?.tax_percent ?? 0);
  for (const e of expenses) addSum(exp, e.currency, Number(e.amount));
  const rate = t.currency === "UAH" ? 1 : t.fx_rate != null ? Number(t.fx_rate) : null;
  const bank = t.payment_form !== "cash";
  let uah: UahBreakdown | null = null;

  if (t.freight != null) {
    addSum(freight, t.currency, Number(t.freight));
    if (bank && rate) {
      const gross = Number(t.freight) * rate;
      const vat = t.vat ? (gross * VAT) / (1 + VAT) : 0;
      const tax = ((gross - vat) * taxPercent) / 100;
      const f = (gross * feePercent) / 100;
      const r2 = (n: number) => Math.round(n * 100) / 100;
      uah = { rate, gross: r2(gross), vat: r2(vat), tax: r2(tax), fee: r2(f), net: r2(gross - vat - tax - f), taxPercent };
      addSum(fee, "UAH", uah.fee);
      addSum(profit, "UAH", uah.net);
    } else {
      if (bank && feePercent) addSum(fee, t.currency, (Number(t.freight) * feePercent) / 100);
      addSum(profit, t.currency, Number(t.freight));
      for (const [c, v] of Object.entries(fee)) addSum(profit, c, -v);
    }
  }
  // Водій і витрати: у валюті рейсу — у гривні за тим самим курсом, якщо рахуємо в гривнях
  const minus = (s: Sums) => {
    for (const [c, v] of Object.entries(s)) {
      if (uah && c === t.currency) addSum(profit, "UAH", -v * uah.rate);
      else addSum(profit, c, -v);
    }
  };
  minus(pay.sums);
  minus(exp);
  return { freight, fee, driver: pay.sums, expenses: exp, profit, feePercent, uah };
}

/** Строк оплати: дата отримання оригіналів (або відправки, якщо невідома) + відстрочка */
export function paymentDue(t: Trip): string | null {
  const from = t.originals_received_on ?? t.originals_sent_on;
  if (!from || t.payment_days == null) return null;
  const d = new Date(from); d.setDate(d.getDate() + Number(t.payment_days));
  return d.toISOString().slice(0, 10);
}

/** Прострочена оплата: днів після строку */
export function overdueDays(t: Trip) {
  if (t.stage === "paid" || t.stage === "cancelled") return 0;
  const due = paymentDue(t);
  if (!due) return 0;
  const n = -daysUntil(due);
  return n > 0 ? n : 0;
}

/** Що заважає перейти на наступний етап */
export function stageBlocker(t: Trip, next: Trip["stage"]): string | null {
  if (next === "transit" && t.via_poland && !t.rmpd_number.trim()) return "Рейс через Польщу: спершу внесіть номер RMPD.";
  if (next === "loading" && !t.tractor_id) return "Оберіть тягач.";
  if (next === "invoiced" && !t.docs_received_on) return "Спершу позначте, що водій надіслав ТТН або CMR.";
  if (next === "paid" && t.paid_amount == null && t.freight == null) return "Вкажіть суму оплати.";
  return null;
}

export function vehicleLabel(v?: Vehicle) {
  return v ? `${fmtPlate(v.plate)} ${v.make}`.trim() : "—";
}
