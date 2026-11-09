/** Пуш-сповіщення (Web Push). Лише для сервера. Ключі VAPID створюються один раз і зберігаються в базі. */
import webpush from "web-push";
import { createServiceClient } from "./supabase/server";

const SUBJECT = "https://furia-self.vercel.app";

export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const db = createServiceClient();
  const { data } = await db.from("integrations").select("login, token").eq("key", "vapid").maybeSingle();
  if (data?.login && data?.token) return { publicKey: data.login, privateKey: data.token };
  const k = webpush.generateVAPIDKeys();
  // login = публічний ключ, token = приватний (таблиця читається тільки сервером)
  await db.from("integrations").upsert({ key: "vapid", login: k.publicKey, token: k.privateKey }, { onConflict: "key" });
  return { publicKey: k.publicKey, privateKey: k.privateKey };
}

export type PushMessage = { title: string; body: string; url: string; tag?: string };

/** Надіслати всім підписаним пристроям вказаних користувачів (або всім, якщо список порожній) */
export async function sendPush(msg: PushMessage, userIds?: string[]) {
  const db = createServiceClient();
  const keys = await vapidKeys();
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  let q = db.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (userIds?.length) q = q.in("user_id", userIds);
  const { data: subs } = await q;
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // Пристрій відписався або підписка застаріла — прибираємо
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return sent;
}
