/** Wialon Remote API (Hosting і Local мають однаковий API). Лише для сервера. */

export type WialonUnit = {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  speed: number | null;   // км/год
  time: number | null;    // час останнього повідомлення, unix-секунди
};

const ERRORS: Record<number, string> = {
  1: "Сесія Wialon недійсна. Спробуйте ще раз.",
  4: "Wialon не прийняв запит.",
  7: "У цього токена немає прав на перегляд обʼєктів.",
  8: "Токен недійсний або відкликаний. Підключіть Wialon заново.",
  1003: "Wialon тимчасово обмежив запити. Спробуйте за хвилину.",
};

export class WialonError extends Error {}

/** https://megagps.net/ → https://megagps.net */
export function normBase(url: string) {
  let u = url.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.replace(/\/+$/, "");
}

async function call<T>(base: string, svc: string, params: object, sid?: string): Promise<T> {
  const body = new URLSearchParams({ params: JSON.stringify(params) });
  if (sid) body.set("sid", sid);
  let res: Response;
  try {
    res = await fetch(`${base}/wialon/ajax.html?svc=${encodeURIComponent(svc)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new WialonError("Сервер Wialon не відповідає. Перевірте адресу або чи доступний він з інтернету.");
  }
  if (!res.ok) throw new WialonError(`Сервер Wialon відповів помилкою ${res.status}. Можливо, адреса API інша — уточніть у дилера.`);
  let data: unknown;
  try { data = await res.json(); } catch { throw new WialonError("За цією адресою не знайдено API Wialon. Уточніть у дилера адресу сервера."); }
  const err = (data as { error?: number })?.error;
  if (typeof err === "number" && err !== 0) throw new WialonError(ERRORS[err] ?? `Wialon повернув помилку ${err}.`);
  return data as T;
}

/** Увійти за токеном, отримати обʼєкти з останньою позицією, вийти */
export async function fetchUnits(baseUrl: string, token: string): Promise<{ user: string; units: WialonUnit[] }> {
  const base = normBase(baseUrl);
  const login = await call<{ eid: string; user?: { nm?: string } }>(base, "token/login", { token, fl: 1 });
  try {
    type Item = { id: number; nm: string; pos?: { x: number; y: number; s: number; t: number } | null };
    const r = await call<{ items: Item[] }>(base, "core/search_items", {
      spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name" },
      force: 1, flags: 0x1 | 0x400, from: 0, to: 0,
    }, login.eid);
    const units = (r.items ?? []).map((it) => ({
      id: String(it.id),
      name: it.nm,
      lat: it.pos?.y ?? null,
      lon: it.pos?.x ?? null,
      speed: it.pos?.s ?? null,
      time: it.pos?.t ?? null,
    }));
    return { user: login.user?.nm ?? "", units };
  } finally {
    call(base, "core/logout", {}, login.eid).catch(() => null);
  }
}

/** Адреса сторінки входу Wialon, яка поверне токен лише на перегляд */
export function loginUrl(baseUrl: string, redirect: string) {
  const q = new URLSearchParams({
    client_id: "Furia",
    access_type: String(0x100 | 0x200), // онлайн-відстеження + перегляд даних, без права змінювати
    activation_time: "0",
    duration: "0",                      // без терміну дії; відкликати можна в Wialon
    flags: "0x1",
    redirect_uri: redirect,
  });
  return `${normBase(baseUrl)}/login.html?${q}`;
}
