import type {
  ArrivalRecord,
  BusRoute,
  BusStop,
  DelayStats,
  Monitor,
  MonitorCreate,
  Period,
} from "@/types";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function searchStops(query: string): Promise<BusStop[]> {
  return fetchJson<BusStop[]>(`/api/stops?q=${encodeURIComponent(query)}`);
}

export async function searchStopsNearby(
  lat: number,
  lng: number,
): Promise<BusStop[]> {
  return fetchJson<BusStop[]>(
    `/api/stops/nearby?lat=${lat}&lng=${lng}`,
  );
}

export async function getStopRoutes(stopId: string): Promise<BusRoute[]> {
  return fetchJson<BusRoute[]>(`/api/stops/${stopId}/routes`);
}

export async function searchRoutes(query: string): Promise<BusRoute[]> {
  return fetchJson<BusRoute[]>(`/api/routes?q=${encodeURIComponent(query)}`);
}

export async function getRouteStops(
  description: string,
): Promise<BusStop[]> {
  return fetchJson<BusStop[]>(
    `/api/routes/${encodeURIComponent(description)}/stops`,
  );
}

export async function getGtfsRouteStops(
  routeNumber: string,
): Promise<BusStop[]> {
  const data = await fetchJson<{ stops: BusStop[] }>(
    `/api/gtfs/routes/${routeNumber}/stops`,
  );
  return data.stops || [];
}

export async function createMonitor(data: MonitorCreate): Promise<Monitor> {
  return fetchJson<Monitor>("/api/monitors", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMonitors(): Promise<Monitor[]> {
  return fetchJson<Monitor[]>("/api/monitors");
}

export async function getMonitor(id: string): Promise<Monitor> {
  return fetchJson<Monitor>(`/api/monitors/${id}`);
}

export async function deleteMonitor(id: string): Promise<void> {
  await fetch(`/api/monitors/${id}`, { method: "DELETE" });
}

export async function getMonitorStats(
  id: string,
  period: Period,
): Promise<DelayStats> {
  return fetchJson<DelayStats>(`/api/monitors/${id}/stats?period=${period}`);
}

export async function getMonitorArrivals(
  id: string,
  from?: string,
  to?: string,
): Promise<ArrivalRecord[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return fetchJson<ArrivalRecord[]>(
    `/api/monitors/${id}/arrivals${qs ? `?${qs}` : ""}`,
  );
}
