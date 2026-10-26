"use client";

import { useEffect, useRef, useState } from "react";

/** Leaflet завантажується з CDN лише на сторінках з картою */
type L = any; // eslint-disable-line @typescript-eslint/no-explicit-any
let leafletPromise: Promise<L> | null = null;
function loadLeaflet(): Promise<L> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as unknown as { L?: L };
  if (w.L) return Promise.resolve(w.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => resolve(w.L);
      s.onerror = () => { leafletPromise = null; reject(); };
      document.head.appendChild(s);
    });
  }
  return leafletPromise;
}

export type MapPoint = { lat: number; lon: number; label: string; kind: "load" | "unload" | "truck" | "truck-old" };

const COLORS: Record<MapPoint["kind"], string> = { load: "#1f5f99", unload: "#d9480f", truck: "#1a7f37", "truck-old": "#8a8a8a" };

/** Карта з точками маршруту, лінією по дорогах і фурами */
export function RouteMap({ points, line, height = 320 }: { points: MapPoint[]; line?: [number, number][] | null; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L>(null);
  const layer = useRef<L>(null);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify([points, line]);

  useEffect(() => {
    let off = false;
    loadLeaflet().then((Lf) => {
      if (off || !box.current) return;
      if (!map.current) {
        map.current = Lf.map(box.current, { scrollWheelZoom: false, attributionControl: true }).setView([49, 24], 5);
        Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18, attribution: "© OpenStreetMap",
        }).addTo(map.current);
      }
      layer.current?.remove();
      layer.current = Lf.layerGroup().addTo(map.current);
      const bounds: [number, number][] = [];
      if (line && line.length > 1) {
        Lf.polyline(line, { color: "#d9480f", weight: 4, opacity: 0.8 }).addTo(layer.current);
        bounds.push(...line);
      }
      for (const p of points) {
        const truck = p.kind === "truck" || p.kind === "truck-old";
        const icon = Lf.divIcon({
          className: "",
          html: truck
            ? `<div style="background:${COLORS[p.kind]};color:#fff;border:2px solid #fff;border-radius:8px;padding:2px 6px;font:700 11px/1.3 system-ui;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35)">🚚 ${p.label.replace(/</g, "&lt;")}</div>`
            : `<div style="width:16px;height:16px;border-radius:50%;background:${COLORS[p.kind]};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
          iconSize: truck ? undefined : [16, 16], iconAnchor: truck ? [10, 10] : [8, 8],
        });
        Lf.marker([p.lat, p.lon], { icon, title: p.label }).bindTooltip(p.label).addTo(layer.current);
        bounds.push([p.lat, p.lon]);
      }
      if (bounds.length > 1) map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      else if (bounds.length === 1) map.current.setView(bounds[0], 10);
      setTimeout(() => map.current?.invalidateSize(), 50);
    }).catch(() => setFailed(true));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);

  if (failed) return <div className="note">Карта не завантажилась. Перевірте інтернет і оновіть сторінку.</div>;
  return <div ref={box} className="map" style={{ height }} role="img" aria-label="Карта маршруту" />;
}
