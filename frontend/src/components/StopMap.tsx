"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

import type { BusStop } from "@/types";

import "leaflet/dist/leaflet.css";

export default function StopMap({
  stops,
  onSelect,
  showSelect = true,
}: {
  stops: BusStop[];
  onSelect: (stop: BusStop) => void;
  showSelect?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    const map = L.map(containerRef.current).setView([-33.87, 151.21], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    if (cancelled) {
      map.remove();
      return;
    }

    mapRef.current = map;
    setMapReady(true);

    const sizeTimer = setTimeout(() => {
      if (!cancelled && mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(sizeTimer);
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
          `<strong>${stop.name}</strong>${
            showSelect
              ? `<br/><button data-stop-id="${stop.id}" class="map-select-btn" style="margin-top:6px;padding:4px 8px;cursor:pointer;background:var(--color-primary);color:var(--color-surface);border:none;border-radius:var(--rounded-sm);font-weight:600;font-size:0.75rem">Select this stop</button>`
              : ""
          }`,
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
    }
  }, [stops, mapReady, showSelect]);

  return <div ref={containerRef} className="map-container map-container--compact" />;
}
