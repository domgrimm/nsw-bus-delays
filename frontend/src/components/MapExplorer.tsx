"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

import type { BusStop } from "@/types";

import "leaflet/dist/leaflet.css";

export default function MapExplorer({
  stops,
  onSelect,
  onSearchArea,
}: {
  stops: BusStop[];
  onSelect: (stop: BusStop) => void;
  onSearchArea?: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const onSearchAreaRef = useRef(onSearchArea);
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelect;
  onSearchAreaRef.current = onSearchArea;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(containerRef.current).setView([-33.87, 151.21], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    if (onSearchAreaRef.current) {
      const SearchControl = L.Control.extend({
        onAdd: function () {
          const div = L.DomUtil.create("div", "map-search-control");
          div.innerHTML =
            '<button style="padding:6px 12px;background:var(--color-primary);color:var(--color-surface);border:none;border-radius:var(--rounded-sm);cursor:pointer;font-weight:600;font-size:14px;white-space:nowrap">Search this area</button>';
          div.onclick = () => {
            const c = map.getCenter();
            onSearchAreaRef.current?.(c.lat, c.lng);
          };
          return div;
        },
      });
      map.addControl(new SearchControl({ position: "topright" }));
    }

    if (cancelled) {
      map.remove();
      return;
    }

    mapRef.current = map;
    setMapReady(true);

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const stop of stops) {
      const marker = L.marker([stop.latitude, stop.longitude])
        .addTo(mapRef.current)
        .bindPopup(
          `<strong>${stop.name}</strong><br/><button data-stop-id="${stop.id}" class="map-select-btn" style="margin-top:6px;padding:4px 8px;cursor:pointer;background:var(--color-primary);color:var(--color-surface);border:none;border-radius:var(--rounded-sm);font-weight:600;font-size:0.75rem">Select this stop</button>`,
        );

      marker.on("popupopen", () => {
        setTimeout(() => {
          const btn = document.querySelector(
            `button[data-stop-id="${stop.id}"]`,
          );
          if (btn) {
            btn.addEventListener(
              "click",
              () => onSelectRef.current(stop),
              { once: true },
            );
          }
        }, 50);
      });

      markersRef.current.push(marker);
    }

    if (stops.length > 0) {
      const group = L.featureGroup(markersRef.current);
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
      if (stops.length === 1) mapRef.current.setZoom(15);
    }
  }, [stops, mapReady]);

  return <div ref={containerRef} className="map-container" />;
}
