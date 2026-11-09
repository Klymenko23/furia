"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { findTown, lardiMe, LardiError, type LardiTown } from "@/lib/lardi";
import { sendPush, vapidKeys } from "@/lib/push";
import { checkWatch, type CheckResult } from "@/lib/lardiWatch";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id, role, active").eq("id", user.id).single();
  return data?.active ? (data as { id: string; role: string }) : null;
}
const office = (r?: string) => r === "owner" || r === "dispatcher" || r === "accountant";
const editor = (r?: string) => r === "owner" || r === "dispatcher";

function tableProblem(m: string) {
  return /does not exist|relation|schema cache|PGRST205|Could not find the table/i.test(m)
    ? "У базі ще немає таблиць для Lardi і сповіщень. Виконайте SQL з файлу 0005_lardi_push.sql у Supabase."
    : "Помилка бази: " + m;
}


async function token() {
  const { data } = await createServiceClient().from("integrations").select("token, user_name").eq("key", "lardi").maybeSingle();
  return data as { token: string; user_name: string } | null;
}

/* ---------- Токен Lardi ---------- */

export async function lardiStatus() {
  const u = await me();
  if (!office(u?.role)) return { error: "Немає доступу." };
  const t = await token();
  return { connected: !!t?.token, user: t?.user_name ?? "" };
}

export async function saveLardiToken(value: string) {
  const u = await me();
  if (u?.role !== "owner") return { error: "Підключати Lardi може лише власник." };
  const t = value.trim();
  if (t.length < 10) return { error: "Це не схоже на токен Lardi." };
  try {
    const name = await lardiMe(t);
    const { error } = await createServiceClient().from("integrations").upsert({ key: "lardi", token: t, user_name: name, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return { error: tableProblem(error.message) };
    return { ok: true, user: name };
  } catch (e) {
    return { error: e instanceof LardiError ? `${e.message}${e.detail ? ` Відповідь Lardi: ${e.detail}` : ""}` : "Не вдалося перевірити токен." };
  }
}

export async function disconnectLardi() {
  const u = await me();
  if (u?.role !== "owner") return { error: "Відключати Lardi може лише власник." };
  await createServiceClient().from("integrations").update({ token: "", user_name: "" }).eq("key", "lardi");
  return { ok: true };
}

/* ---------- Збережені пошуки ---------- */

export async function saveWatch(input: { id?: string; from: string; to: string; radius: number; active?: boolean }) {
  const u = await me();
  if (!editor(u?.role)) return { error: "Немає прав." };
  if (input.from.trim().length < 2 || input.to.trim().length < 2) return { error: "Вкажіть звідки і куди." };
  const t = await token();
  // Місто шукаємо в довіднику Lardi; якщо не знайшли — фільтруватимемо за назвою
  let fromTown: LardiTown | null = null, toTown: LardiTown | null = null;
  if (t?.token) {
    try {
      fromTown = await findTown(t.token, input.from);
      toTown = await findTown(t.token, input.to);
    } catch { /* без токена або без доступу — збережемо як текст */ }
  }
  const row = {
    name: `${input.from.trim()} → ${input.to.trim()}`,
    from_text: input.from.trim(), from_town_id: fromTown?.id ?? null, from_country: fromTown?.country || "UA",
    to_text: input.to.trim(), to_town_id: toTown?.id ?? null, to_country: toTown?.country || "UA",
    radius_km: Math.max(0, Math.min(200, Math.round(input.radius || 0))),
    active: input.active ?? true,
  };
  const supabase = await createClient();
  const { error } = input.id
    ? await supabase.from("lardi_watches").update({ ...row, last_checked_at: null }).eq("id", input.id)
    : await supabase.from("lardi_watches").insert(row);
  if (error) return { error: tableProblem(error.message) };
  return { ok: true };
}

/** Кнопка «Перевірити зараз» */
export async function checkNow(watchId: string) {
  const u = await me();
  if (!office(u?.role)) return { found: [], fresh: 0, error: "Немає доступу." } as CheckResult;
  return checkWatch(watchId, false);
}

/* ---------- Пуші ---------- */

export async function pushPublicKey() {
  const u = await me();
  if (!u) return { error: "Увійдіть у систему." };
  try { return { key: (await vapidKeys()).publicKey }; }
  catch { return { error: "Не вдалося підготувати сповіщення. Виконайте SQL 0005_lardi_push.sql." }; }
}

export async function testPush() {
  const u = await me();
  if (!u) return { error: "Увійдіть у систему." };
  try {
    const n = await sendPush({ title: "Furia", body: "Сповіщення працюють. Сюди приходитимуть нові вантажі й терміни.", url: "/loads", tag: "test" }, [u.id]);
    return n ? { ok: true, n } : { error: "Немає підписаних пристроїв. Спершу увімкніть сповіщення на цьому телефоні." };
  } catch (e) {
    return { error: "Не вдалося надіслати: " + (e as Error).message };
  }
}
