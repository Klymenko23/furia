"use server";

/** Офіційний курс НБУ на дату (гривень за 1 одиницю валюти) */
export async function nbuRate(currency: string, dateISO: string): Promise<{ rate?: number; date?: string; error?: string }> {
  if (currency === "UAH") return { rate: 1, date: dateISO };
  const d = dateISO.replace(/-/g, "");
  try {
    const r = await fetch(`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${encodeURIComponent(currency)}&date=${d}&json`, { next: { revalidate: 3600 } });
    if (!r.ok) return { error: "Сайт НБУ не відповідає. Впишіть курс вручну." };
    const rows = (await r.json()) as { rate: number; exchangedate: string }[];
    if (!rows[0]?.rate) return { error: "НБУ не повернув курс на цю дату." };
    return { rate: rows[0].rate, date: dateISO };
  } catch {
    return { error: "Немає звʼязку з НБУ. Впишіть курс вручну." };
  }
}
