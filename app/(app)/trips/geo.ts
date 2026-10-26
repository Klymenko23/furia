"use server";

/** Пошук місць і розрахунок кілометрів. Працює на сервері, щоб не світити браузер користувача стороннім сервісам. */

// Україна, Молдова і всі країни ЄС
const COUNTRY_CODES = "ua,md,pl,de,cz,sk,hu,ro,bg,lt,lv,ee,at,nl,be,lu,fr,it,es,pt,dk,se,fi,ie,si,hr,gr,cy,mt";
const UA = "Furia/1.0 (transport management; https://furia-self.vercel.app)";

export type Place = { label: string; place: string; country: string; lat: number; lon: number };

export async function geocode(q: string): Promise<{ places?: Place[]; error?: string }> {
  const query = q.trim();
  if (query.length < 3) return { places: [] };
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=7&accept-language=uk&countrycodes=${COUNTRY_CODES}&q=${encodeURIComponent(query)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 86400 } });
    if (!r.ok) return { error: "Пошук місць тимчасово недоступний. Спробуйте за хвилину." };
    type Hit = { lat: string; lon: string; display_name: string; name?: string; address?: Record<string, string> };
    const hits = (await r.json()) as Hit[];
    return {
      places: hits.map((h) => {
        const a = h.address ?? {};
        const place = h.name || a.city || a.town || a.village || a.hamlet || a.municipality || h.display_name.split(",")[0];
        return { label: h.display_name, place, country: (a.country_code ?? "").toUpperCase(), lat: Number(h.lat), lon: Number(h.lon) };
      }),
    };
  } catch {
    return { error: "Немає звʼязку з сервісом карт." };
  }
}

/** Відстань по дорогах між точками [lat, lon] і лінія маршруту для карти */
export async function routeKm(points: [number, number][]): Promise<{ km?: number; line?: [number, number][]; error?: string }> {
  if (points.length < 2) return { error: "Потрібно хоча б дві точки з координатами." };
  const coords = points.map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(";");
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson`, {
      headers: { "User-Agent": UA }, next: { revalidate: 86400 },
    });
    if (!r.ok) return { error: "Сервіс маршрутів не відповідає. Кілометри можна вписати вручну." };
    const d = (await r.json()) as { code: string; routes?: { distance: number; geometry: { coordinates: [number, number][] } }[] };
    const route = d.routes?.[0];
    if (d.code !== "Ok" || !route) return { error: "Маршрут між цими точками не знайдено." };
    // Проріджуємо лінію, щоб не зберігати тисячі точок
    const all = route.geometry.coordinates;
    const step = Math.max(1, Math.ceil(all.length / 400));
    const line = all.filter((_, i) => i % step === 0 || i === all.length - 1).map(([lon, lat]) => [Number(lat.toFixed(5)), Number(lon.toFixed(5))] as [number, number]);
    return { km: Math.round(route.distance / 1000), line };
  } catch {
    return { error: "Немає звʼязку з сервісом маршрутів." };
  }
}
