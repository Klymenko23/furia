"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchUnits, normBase, tokenFromPassword, WialonError, type WialonUnit } from "@/lib/wialon";

async function myRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  return data?.active ? (data.role as string) : null;
}
const isOffice = (r: string | null) => r === "owner" || r === "dispatcher" || r === "accountant";

/** Зрозуміле пояснення помилки бази для налаштувань Wialon */
function dbProblem(m: string) {
  if (/does not exist|relation|schema cache|PGRST205|Could not find the table/i.test(m))
    return "У базі ще немає таблиці для Wialon. Виконайте SQL з таблицею integrations (файл 0002_wialon.sql) у Supabase і оновіть сторінку.";
  if (/api key|apikey|JWT|Unauthorized|invalid.*key/i.test(m))
    return "Сервер не може увійти в базу: перевірте змінну SUPABASE_SERVICE_ROLE_KEY у Vercel (секретний ключ Supabase) і перезапустіть збірку.";
  return "Помилка бази: " + m;
}

async function readRow() {
  const { data, error } = await createServiceClient().from("integrations").select("*").eq("key", "wialon").maybeSingle();
  if (error) throw new WialonError(dbProblem(error.message));
  return data as { base_url: string; token: string; login?: string; password?: string; user_name: string; updated_at: string } | null;
}

export type WialonStatus = { base_url: string; connected: boolean; user_name: string; updated_at: string | null; error?: string };

export async function wialonStatus(): Promise<WialonStatus> {
  if (!isOffice(await myRole())) return { base_url: "", connected: false, user_name: "", updated_at: null, error: "Немає доступу." };
  try {
    const r = await readRow();
    return { base_url: r?.base_url ?? "", connected: !!(r?.token || (r?.login && r?.password)), user_name: r?.user_name ?? "", updated_at: r?.updated_at ?? null };
  } catch (e) {
    return { base_url: "", connected: false, user_name: "", updated_at: null, error: (e as Error).message };
  }
}

/** Зберегти адресу сервера (перед входом) */
export async function saveWialonBase(baseUrl: string) {
  if ((await myRole()) !== "owner") return { error: "Підключати Wialon може лише власник." };
  const base = normBase(baseUrl);
  if (!base) return { error: "Вкажіть адресу сервера Wialon." };
  const { error } = await createServiceClient().from("integrations")
    .upsert({ key: "wialon", base_url: base, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { error: dbProblem(error.message) };
  return { ok: true, base };
}

/** Зберегти токен (після входу на сторінці Wialon або вставлений вручну) і одразу перевірити його */
export async function saveWialonToken(token: string, userName = "") {
  if ((await myRole()) !== "owner") return { error: "Підключати Wialon може лише власник." };
  const t = token.trim();
  if (!/^[0-9a-f]{40,}$/i.test(t)) return { error: "Це не схоже на токен Wialon. Він складається з 72 символів (цифри й латинські літери a–f)." };
  let row;
  try { row = await readRow(); } catch (e) { return { error: (e as Error).message }; }
  if (!row?.base_url) return { error: "Спершу вкажіть адресу сервера Wialon." };
  try {
    const r = await fetchUnits(row.base_url, t);
    const { error } = await createServiceClient().from("integrations")
      .update({ token: t, user_name: userName || r.user, updated_at: new Date().toISOString() }).eq("key", "wialon");
    if (error) return { error: "Не вдалося зберегти токен." };
    return { ok: true, count: r.units.length };
  } catch (e) {
    return { error: e instanceof WialonError ? e.message : "Не вдалося перевірити токен." };
  }
}

export async function disconnectWialon() {
  if ((await myRole()) !== "owner") return { error: "Відключати Wialon може лише власник." };
  await createServiceClient().from("integrations").update({ token: "", user_name: "", login: "", password: "" }).eq("key", "wialon");
  return { ok: true };
}

/** Обʼєкти Wialon з останньою позицією (для привʼязки і для картки машини) */
export async function wialonUnits(): Promise<{ units?: WialonUnit[]; error?: string }> {
  if (!isOffice(await myRole())) return { error: "Немає доступу." };
  try {
    const row = await readRow();
    if (!row?.token && !(row?.login && row?.password)) return { error: "Wialon не підключено." };
    return { units: (await fetchUnits(row.base_url, { token: row.token, login: row.login, password: row.password })).units };
  } catch (e) {
    return { error: e instanceof WialonError ? e.message : "Не вдалося отримати дані з Wialon." };
  }
}

/** Підключення логіном і паролем гостьового запису. Пароль зберігається, лише якщо сервер не дав створити токен. */
export async function saveWialonPassword(baseUrl: string, login: string, password: string) {
  if ((await myRole()) !== "owner") return { error: "Підключати Wialon може лише власник." };
  const base = normBase(baseUrl);
  if (!base || !login.trim() || !password) return { error: "Вкажіть адресу, логін і пароль." };
  try {
    const r = await tokenFromPassword(base, login.trim(), password);
    const row = r.token
      ? { key: "wialon", base_url: base, token: r.token, login: "", password: "", user_name: r.user, updated_at: new Date().toISOString() }
      : { key: "wialon", base_url: base, token: "", login: login.trim(), password, user_name: r.user, updated_at: new Date().toISOString() };
    const { error } = await createServiceClient().from("integrations").upsert(row, { onConflict: "key" });
    if (error) return { error: dbProblem(error.message) };
    return { ok: true, count: r.count, viaToken: !!r.token };
  } catch (e) {
    return { error: e instanceof WialonError ? e.message : "Не вдалося підключитися до Wialon." };
  }
}
