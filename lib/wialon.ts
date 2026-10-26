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
  7: "Wialon відмовив у доступі.",
  8: "Токен недійсний або відкликаний. Підключіть Wialon заново.",
  1003: "Wialon тимчасово обмежив запити. Спробуйте за хвилину.",
};

export class WialonError extends Error {
  constructor(message: string, public code?: number, public svc?: string) { super(message); }
}

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
  if (typeof err === "number" && err !== 0) {
    const step = svc === "core/login" || svc === "token/login" ? "вхід" : svc === "core/search_items" ? "список машин" : svc;
    throw new WialonError(`${ERRORS[err] ?? `Wialon повернув помилку ${err}.`} (крок: ${step}, код ${err})`, err, svc);
  }
  return data as T;
}

export type WialonAuth = { token?: string; login?: string; password?: string };

type Session = { eid: string; user?: { nm?: string } };

/** Вхід: за токеном, а якщо його немає — логіном і паролем */
async function open(base: string, auth: WialonAuth): Promise<Session> {
  if (auth.token) return call<Session>(base, "token/login", { token: auth.token, fl: 1 });
  if (auth.login && auth.password) {
    try {
      return await call<Session>(base, "core/login", { user: auth.login, password: auth.password });
    } catch (e) {
      if (e instanceof WialonError && /помилку 8|недійсний/i.test(e.message)) throw new WialonError("Wialon не прийняв логін або пароль.");
      throw e;
    }
  }
  throw new WialonError("Wialon не підключено.");
}

/** Увійти логіном і паролем і одразу випустити токен лише на перегляд (щоб не зберігати пароль).
 *  Повертає токен або null, якщо сервер не дозволяє створювати токени. */
export async function tokenFromPassword(baseUrl: string, login: string, password: string): Promise<{ token: string | null; user: string; count: number }> {
  const base = normBase(baseUrl);
  const s = await open(base, { login, password });
  try {
    let token: string | null = null;
    try {
      const t = await call<{ h?: string }>(base, "token/update", {
        callMode: "create", app: "Furia", at: 0, dur: 0, fl: 0x100 | 0x200, p: "{}", items: [],
      }, s.eid);
      token = t.h ?? null;
    } catch { token = null; }
    const units = await listUnits(base, s.eid);
    return { token, user: s.user?.nm ?? login, count: units.length };
  } finally {
    call(base, "core/logout", {}, s.eid).catch(() => null);
  }
}

async function listUnits(base: string, sid: string): Promise<WialonUnit[]> {
  type Item = { id: number; nm: string; pos?: { x: number; y: number; s: number; t: number } | null };
  const ask = (flags: number) => call<{ items: Item[] }>(base, "core/search_items", {
    spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name" },
    force: 1, flags, from: 0, to: 0,
  }, sid);
  let r: { items: Item[] };
  // Якщо гостьовому запису не дозволено бачити останнє повідомлення, беремо хоча б список машин
  try { r = await ask(0x1 | 0x400); } catch (e) {
    if (e instanceof WialonError && e.code === 7) r = await ask(0x1); else throw e;
  }
  return (r.items ?? []).map((it) => ({
    id: String(it.id), name: it.nm,
    lat: it.pos?.y ?? null, lon: it.pos?.x ?? null, speed: it.pos?.s ?? null, time: it.pos?.t ?? null,
  }));
}

/** Увійти, отримати обʼєкти з останньою позицією, вийти */
export async function fetchUnits(baseUrl: string, auth: WialonAuth | string): Promise<{ user: string; units: WialonUnit[] }> {
  const base = normBase(baseUrl);
  const login = await open(base, typeof auth === "string" ? { token: auth } : auth);
  try {
    return { user: login.user?.nm ?? "", units: await listUnits(base, login.eid) };
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
