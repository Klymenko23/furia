/** Lardi-Trans Public API v2. Лише для сервера: токен ніколи не потрапляє в браузер. */

const BASE = "https://api.lardi-trans.com/v2";

export class LardiError extends Error {
  constructor(message: string, public detail = "") { super(message); }
}

export type LardiTown = { id: number; name: string; area: string; country: string };

export type Cargo = {
  id: string;
  from: string;
  to: string;
  date: string;
  cargo: string;
  weight: string;
  body: string;
  price: string;
  url: string;
};

async function call(token: string, path: string, init?: { method?: string; body?: unknown; query?: Record<string, string> }) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(init?.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: { Authorization: token, Accept: "application/json", "Content-Type": "application/json", "Accept-Language": "uk" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new LardiError("Lardi-Trans не відповідає. Спробуйте пізніше.");
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw new LardiError("Lardi не прийняв токен або для API потрібен платний пакет.", text.slice(0, 400));
  if (res.status === 429) throw new LardiError("Lardi обмежив кількість запитів. Наступна перевірка буде пізніше.");
  if (!res.ok) throw new LardiError(`Lardi відповів помилкою ${res.status}.`, text.slice(0, 400));
  try { return JSON.parse(text); } catch { throw new LardiError("Lardi повернув незрозумілу відповідь.", text.slice(0, 400)); }
}

/** Масив з будь-якої обгортки відповіді: [..], {result:[..]}, {result:{items:[..]}}, {content:[..]}… */
function pickArray(d: unknown, keys = ["proposals", "items", "content", "towns", "list", "data"]): Record<string, unknown>[] {
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    for (const k of ["result", ...keys]) {
      if (k in o) { const a = pickArray(o[k], keys); if (a.length) return a; }
    }
  }
  return [];
}

const str = (v: unknown): string => (v == null ? "" : typeof v === "object" ? "" : String(v));

/** Перевірка токена: дані користувача */
export async function lardiMe(token: string) {
  const d = await call(token, "/users/user");
  const o = (d?.result ?? d) as Record<string, unknown>;
  return str(o.name) || str(o.companyName) || str(o.refId) || "обліковий запис Lardi";
}

/** Пошук міста в довіднику Lardi. Шлях у різних версіях документації трохи різний — пробуємо по черзі. */
export async function findTown(token: string, name: string): Promise<LardiTown | null> {
  const q = name.trim();
  if (q.length < 2) return null;
  const tries: [string, Record<string, string>][] = [
    ["/references/towns/by/name", { query: q, language: "uk", limit: "5" }],
    ["/references/towns/by-name", { name: q, language: "uk" }],
    ["/references/towns", { query: q, language: "uk" }],
  ];
  for (const [path, query] of tries) {
    try {
      const list = pickArray(await call(token, path, { query }));
      if (!list.length) continue;
      const exact = list.find((t) => norm(str(t.name)) === norm(q)) ?? list[0];
      const id = Number(exact.id ?? exact.townId);
      if (!id) continue;
      return { id, name: str(exact.name), area: str(exact.areaName ?? exact.area), country: str(exact.countrySign ?? exact.country) || "UA" };
    } catch (e) {
      if (e instanceof LardiError && /токен|платний/.test(e.message)) throw e;
    }
  }
  return null;
}

type Dir = { townId: number | null; country: string; radius: number };

/** Нові заявки на вантаж за напрямком (спершу найсвіжіші) */
export async function searchCargo(token: string, from: Dir, to: Dir): Promise<{ items: Cargo[]; raw: string }> {
  const row = (d: Dir) => (d.townId ? { countrySign: d.country, townId: d.townId, townRadius: d.radius } : { countrySign: d.country });
  const body = {
    page: 1,
    size: 50,
    sortByCountFirst: false,
    filter: {
      directionFrom: { directionRows: [row(from)] },
      directionTo: { directionRows: [row(to)] },
      onlyActual: true,
    },
  };
  const d = await call(token, "/proposals/search/cargo", { method: "POST", body });
  const list = pickArray(d);
  return { items: list.map(toCargo).filter((c) => c.id), raw: JSON.stringify(d).slice(0, 600) };
}

function place(w: unknown): string {
  const arr = Array.isArray(w) ? w : [];
  return arr.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return str(o.townFullName) || [str(o.town ?? o.townName), str(o.countrySign)].filter(Boolean).join(", ") || str(o.region ?? o.area);
  }).filter(Boolean).join(" → ");
}

function toCargo(p: Record<string, unknown>): Cargo {
  const id = str(p.id);
  const price = str(p.paymentPrice ?? p.price);
  const cur = str(p.paymentCurrency ?? p.currency ?? (p.paymentCurrencyId === 4 ? "грн" : ""));
  const mass = str(p.gruzMass ?? p.mass ?? p.mass1);
  return {
    id,
    from: place(p.waypointListSource) || str(p.from),
    to: place(p.waypointListTarget) || str(p.to),
    date: str(p.dateFrom ?? p.dateFromISO ?? p.date).slice(0, 10),
    cargo: str(p.gruzName ?? p.cargoName ?? p.cargo),
    weight: mass ? `${mass} т` : "",
    body: str(p.bodyType ?? p.bodyTypeName),
    price: price ? `${price} ${cur}`.trim() : str(p.paymentValue ?? p.paymentPriceDescription),
    url: id ? `https://lardi-trans.com/gruz/view/${id}/` : "https://lardi-trans.com/gruz/",
  };
}

/** Порівняння назв міст без різниці мов і подвоєнь: «Одесса» = «Одеса», «Чернигов» = «Чернігів» */
export function norm(s: string) {
  return s.toLowerCase()
    .replace(/[ʼ'’`-]/g, "")
    .replace(/[іїиы]/g, "и").replace(/[єэ]/g, "е").replace(/ё/g, "е")
    .replace(/(.)\1+/g, "$1")
    .trim();
}

/** Чи підходить текст місця під назву, яку ввів користувач (порівнюємо початок слова) */
export function placeMatches(placeText: string, wanted: string) {
  const w = norm(wanted).slice(0, 6);
  if (w.length < 3) return true;
  return norm(placeText).split(/[\s,→()]+/).some((word) => word.startsWith(w));
}
