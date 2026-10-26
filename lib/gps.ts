/** Підказки етапу рейсу за GPS (Wialon). Етап ніколи не змінюється сам — лише пропонується. */
import { stageIndex, stageLabel } from "./constants";
import type { Stage, Trip } from "./types";
import type { WialonUnit } from "./wialon";

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Знайти обʼєкт Wialon за привʼязкою тягача (ID або назва) */
export function findUnit(units: WialonUnit[], ref: string) {
  const q = ref.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return undefined;
  const norm = (n: string) => n.toLowerCase().replace(/\s+/g, "");
  return units.find((u) => u.id === ref.trim())
    ?? units.find((u) => norm(u.name) === q)
    ?? units.find((u) => norm(u.name).includes(q) || q.includes(norm(u.name)));
}

/** Сигнал старший за 2 години — РЕБ, трекер вимкнений або немає звʼязку */
export const isStale = (u: WialonUnit) => !u.time || Date.now() / 1000 - u.time > 2 * 3600;

const NEAR_KM = 3;      // вважаємо, що машина на точці
const ROAD_FACTOR = 1.25; // дорога довша за пряму приблизно на чверть

export type GpsHint = {
  suggest?: Stage;      // який етап пропонуємо
  text: string;         // що бачимо
  leftKm?: number;      // скільки орієнтовно лишилося до розвантаження
};

export function gpsHint(t: Trip, u: WialonUnit): GpsHint {
  if (u.lat == null || u.lon == null) return { text: "Wialon не передає координати цієї машини." };
  if (isStale(u)) return { text: "Сигнал GPS застарів (можливо, РЕБ або трекер вимкнено). Етап не підказую." };
  const pos = { lat: u.lat, lon: u.lon };
  const pts = t.stops.filter((s) => s.lat != null && s.lon != null) as (Trip["stops"][number] & { lat: number; lon: number })[];
  if (pts.length === 0) return { text: "Точки рейсу не обрані на карті, тому етап за GPS не визначити." };

  const idx = stageIndex(t.stage);
  const atLoad = pts.find((s) => s.kind === "load" && haversineKm(pos, s) <= NEAR_KM);
  const atUnload = pts.find((s) => s.kind === "unload" && haversineKm(pos, s) <= NEAR_KM);
  const lastUnload = [...pts].reverse().find((s) => s.kind === "unload");
  const leftKm = lastUnload ? Math.round(haversineKm(pos, lastUnload) * ROAD_FACTOR) : undefined;
  const moving = (u.speed ?? 0) > 5;

  if (atUnload && idx < stageIndex("unloading")) {
    return { suggest: "unloading", text: `Машина на розвантаженні: ${atUnload.place}.`, leftKm: 0 };
  }
  if (atLoad && idx < stageIndex("loading")) {
    return { suggest: "loading", text: `Машина на завантаженні: ${atLoad.place}.`, leftKm };
  }
  if (t.stage === "loading" && !atLoad && moving) {
    return { suggest: "transit", text: "Машина виїхала з місця завантаження і їде.", leftKm };
  }
  const where = atLoad ? `на завантаженні (${atLoad.place})` : atUnload ? `на розвантаженні (${atUnload.place})` : moving ? `їде, ${u.speed} км/год` : "стоїть";
  return { text: `Зараз машина ${where}. Етап «${stageLabel(t.stage)}» відповідає.`, leftKm: atUnload ? 0 : leftKm };
}
