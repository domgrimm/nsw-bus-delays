import type {
  ArrivalRecord,
  BunchingEvent,
  BusRoute,
  BusStop,
  DelayStats,
  LiveDeparture,
  Monitor,
  MonitorCreate,
  Period,
  ScheduledDepartureStats,
  TimetableResponse,
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
  from?: string,
  to?: string,
): Promise<DelayStats> {
  const params = new URLSearchParams({ period });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return fetchJson<DelayStats>(`/api/monitors/${id}/stats?${params}`);
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

export async function getMonitorBunching(
  id: string,
  period: Period,
  from?: string,
  to?: string,
): Promise<BunchingEvent[]> {
  const params = new URLSearchParams({ period });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return fetchJson<BunchingEvent[]>(`/api/monitors/${id}/bunching?${params}`);
}

export async function getRouteTimetable(
  routeNumber: string,
  stopId: string,
): Promise<TimetableResponse> {
  return fetchJson<TimetableResponse>(
    `/api/gtfs/routes/${routeNumber}/timetable?stop_id=${encodeURIComponent(stopId)}`,
  );
}

export async function getScheduledDepartureStats(
  id: string,
  scheduledTime: string,
  period: Period,
  serviceType?: string,
  from?: string,
  to?: string,
): Promise<ScheduledDepartureStats> {
  const params = new URLSearchParams({ scheduled_time: scheduledTime, period });
  if (serviceType) params.set("service_type", serviceType);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return fetchJson<ScheduledDepartureStats>(
    `/api/monitors/${id}/scheduled-departure-stats?${params}`,
  );
}

export async function getMonitorDepartures(
  id: string,
  maxResults: number = 60,
): Promise<LiveDeparture[]> {
  return fetchJson<LiveDeparture[]>(
    `/api/monitors/${id}/departures?max_results=${maxResults}`,
  );
}
