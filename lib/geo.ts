/** Довідник населених пунктів України (КАТОТТГ). Файл /geo/ua.json вантажиться лише коли потрібен.
 *  Крім сіл і міст можна обрати громаду, район, область або «Вся Україна» — для лінійних об'єктів
 *  та робіт без конкретного населеного пункту. Тоді нижчі рівні порожні: { n: "", h: "", r: "", o: "Одеська" }. */

export type Settlement = { n: string; h: string; r: string; o: string };
type Raw = { v: string; o: string[]; r: [string, number][]; h: [string, number][]; s: [string, string, number][] };
type Level = "s" | "h" | "r" | "o" | "ua";
type Item = Settlement & { key: string; norm: string; level: Level };

/** Позначка «Вся Україна» */
export const ALL_UA = "Україна";

let cache: Promise<Item[]> | null = null;

/** Для пошуку: регістр, апострофи, ё/е */
export const normName = (s: string) =>
  (s || "").toLowerCase().replace(/[ʼ’'`"]/g, "").replace(/ё/g, "е").replace(/\s+/g, " ").trim();

export const geoLevel = (s: Settlement): Level =>
  s.n ? "s" : s.h ? "h" : s.r ? "r" : s.o === ALL_UA ? "ua" : "o";

const isSpecialCity = (o: string) => o.startsWith("м. ");
/** «Одеська обл.», «АР Крим», «м. Київ» */
export const oblLabel = (o: string) =>
  o === ALL_UA ? "Вся Україна" : isSpecialCity(o) ? o : o.startsWith("Автономна") ? "АР Крим" : `${o} обл.`;

export function loadGeo(): Promise<Item[]> {
  if (!cache) {
    cache = fetch("/geo/ua.json", { cache: "force-cache" })
      .then((r) => r.json() as Promise<Raw>)
      .then((d) => {
        const mk = (s: Settlement, level: Level, name: string): Item => ({ ...s, level, key: geoKey(s), norm: normName(name) });
        const areas: Item[] = [
          mk({ n: "", h: "", r: "", o: ALL_UA }, "ua", "вся україна"),
          ...d.o.map((o) => mk({ n: "", h: "", r: "", o }, "o", o.replace(/^м\.\s*/, ""))),
          // у Києві й Севастополі район/громада = саме місто — їх не дублюємо
          ...d.r.filter(([, oi]) => !isSpecialCity(d.o[oi])).map(([r, oi]) => mk({ n: "", h: "", r, o: d.o[oi] }, "r", r)),
          ...d.h.filter(([, ri]) => !isSpecialCity(d.o[d.r[ri][1]])).map(([h, ri]) => mk({ n: "", h, r: d.r[ri][0], o: d.o[d.r[ri][1]] }, "h", h)),
        ];
        const places = d.s.filter(([, , hi]) => !isSpecialCity(d.o[d.r[d.h[hi][1]][1]])).map(([name, type, hi]) => {
          const [hName, ri] = d.h[hi];
          const [rName, oi] = d.r[ri];
          return mk({ n: `${type}. ${name}`, h: hName, r: rName, o: d.o[oi] }, "s", name);
        });
        return [...areas, ...places];
      })
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

/** Пошук: спершу точний збіг, потім «починається з», потім «містить». Області й райони — вище за села. */
export function searchGeo(items: Item[], q: string, limit = 12): Item[] {
  let raw = q.replace(/^(с|м|сщ|смт|село|місто|селище)\.?\s+/i, "");
  // «Одеська обл», «Ізмаїльський район», «Ренійська громада» — шукаємо лише цей рівень
  let only: Level | null = null;
  if (/\s(обл\.?|область)\s*$/i.test(raw)) { only = "o"; raw = raw.replace(/\s(обл\.?|область)\s*$/i, ""); }
  else if (/\s(р-н|район)\s*$/i.test(raw)) { only = "r"; raw = raw.replace(/\s(р-н|район)\s*$/i, ""); }
  else if (/\s(громада|тг|отг)\s*$/i.test(raw)) { only = "h"; raw = raw.replace(/\s(громада|тг|отг)\s*$/i, ""); }
  const nq = normName(raw);
  if (nq.length < 2) return [];
  const rank: Record<Level, number> = { ua: 0, o: 1, r: 2, h: 3, s: 4 };
  const exact: Item[] = [], starts: Item[] = [], has: Item[] = [];
  for (const it of items) {
    if (only && it.level !== only) continue;
    if (it.norm === nq) exact.push(it);
    else if (it.norm.startsWith(nq)) starts.push(it);
    else if (nq.length >= 3 && it.norm.includes(nq)) has.push(it);
  }
  const byLevel = (a: Item, b: Item) => rank[a.level] - rank[b.level];
  return [...exact.sort(byLevel), ...starts.sort(byLevel), ...has.sort(byLevel)].slice(0, limit);
}

/** Назва для списку й чіпів: «с. Гора», «Ренійська громада», «Ізмаїльський р-н», «Одеська обл.», «Вся Україна» */
export function geoName(s: Settlement) {
  const l = geoLevel(s);
  if (l === "s") return s.n;
  if (l === "h") return `${s.h} громада`;
  if (l === "r") return `${s.r} р-н`;
  return oblLabel(s.o);
}
/** «с. Гора, Бориспільський р-н, Київська обл.» */
export function geoShort(s: Settlement) {
  const l = geoLevel(s);
  if (l === "ua" || l === "o") return oblLabel(s.o);
  if (isSpecialCity(s.o)) return l === "s" ? s.o : `${geoName(s)}, ${s.o}`;
  if (l === "s") return `${s.n}, ${s.r} р-н, ${oblLabel(s.o)}`;
  if (l === "h") return `${s.h} громада, ${s.r} р-н, ${oblLabel(s.o)}`;
  return `${s.r} р-н, ${oblLabel(s.o)}`;
}
/** Підказка під назвою: де це */
export function geoWhere(s: Settlement) {
  const l = geoLevel(s);
  if (l === "ua") return "без прив'язки до області";
  if (l === "o") return isSpecialCity(s.o) ? "місто зі спеціальним статусом" : "уся область";
  if (isSpecialCity(s.o)) return l === "s" ? "місто зі спеціальним статусом" : s.o;
  if (l === "r") return `увесь район · ${oblLabel(s.o)}`;
  if (l === "h") return `уся громада · ${s.r} р-н · ${oblLabel(s.o)}`;
  return `${s.h} громада · ${s.r} р-н · ${oblLabel(s.o)}`;
}
export const geoKey = (s: Settlement) => `${s.n}|${s.h}|${s.r}|${s.o}`;
