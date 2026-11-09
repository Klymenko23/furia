/** Перевірка збереженого пошуку Lardi. Лише для сервера (викликається з розкладу і з кнопки «Перевірити зараз» після перевірки прав). */
import { createServiceClient } from "./supabase/server";
import { LardiError, placeMatches, searchCargo, type Cargo } from "./lardi";
import { sendPush } from "./push";

async function token() {
  const { data } = await createServiceClient().from("integrations").select("token").eq("key", "lardi").maybeSingle();
  return data as { token: string } | null;
}

export type CheckResult = { found: Cargo[]; fresh: number; error?: string; raw?: string };

/** Перевірити один пошук. notify=false — лише запамʼятати знайдене без пушу (перша перевірка). */
export async function checkWatch(watchId: string, notify: boolean): Promise<CheckResult> {
  const db = createServiceClient();
  const { data: w } = await db.from("lardi_watches").select("*").eq("id", watchId).single();
  if (!w) return { found: [], fresh: 0, error: "Пошук не знайдено." };
  const t = await token();
  if (!t?.token) {
    await db.from("lardi_watches").update({ last_error: "Lardi не підключено" }).eq("id", watchId);
    return { found: [], fresh: 0, error: "Lardi не підключено: вставте токен у розділі «Вантажі»." };
  }
  try {
    const r = await searchCargo(t.token,
      { townId: w.from_town_id, country: w.from_country, radius: w.radius_km },
      { townId: w.to_town_id, country: w.to_country, radius: w.radius_km });
    // Додатково перевіряємо назви: якщо Lardi проігнорує фільтр, зайве не пройде
    const found = r.items.filter((c) => (w.from_town_id || placeMatches(c.from, w.from_text)) && (w.to_town_id || placeMatches(c.to, w.to_text)));
    const { data: seen } = await db.from("lardi_found").select("proposal_id").eq("watch_id", watchId).in("proposal_id", found.map((c) => c.id).concat("-"));
    const known = new Set((seen ?? []).map((s) => s.proposal_id));
    const fresh = found.filter((c) => !known.has(c.id));
    if (fresh.length) {
      await db.from("lardi_found").upsert(fresh.map((c) => ({ watch_id: watchId, proposal_id: c.id, data: c })), { onConflict: "watch_id,proposal_id", ignoreDuplicates: true });
    }
    // Перша перевірка після створення пошуку тільки запамʼятовує поточні вантажі
    const shouldNotify = notify && !!w.last_checked_at;
    await db.from("lardi_watches").update({ last_checked_at: new Date().toISOString(), last_error: "" }).eq("id", watchId);
    if (shouldNotify) {
      for (const c of fresh.slice(0, 5)) {
        await sendPush({
          title: `Новий вантаж: ${w.from_text} → ${w.to_text}`,
          body: [c.from && c.to ? `${c.from} → ${c.to}` : "", c.cargo, c.weight, c.price, c.date].filter(Boolean).join(" · "),
          url: c.url, tag: `lardi-${c.id}`,
        });
      }
      if (fresh.length > 5) {
        await sendPush({ title: `Ще ${fresh.length - 5} нових вантажів`, body: `${w.from_text} → ${w.to_text}`, url: "/loads", tag: `lardi-more-${watchId}` });
      }
    }
    return { found, fresh: fresh.length, raw: found.length ? undefined : r.raw };
  } catch (e) {
    const msg = e instanceof LardiError ? e.message : "Не вдалося перевірити Lardi.";
    await db.from("lardi_watches").update({ last_error: msg }).eq("id", watchId);
    return { found: [], fresh: 0, error: msg, raw: e instanceof LardiError ? e.detail : undefined };
  }
}

