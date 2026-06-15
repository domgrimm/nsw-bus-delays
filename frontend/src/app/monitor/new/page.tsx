"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

import { createMonitor, searchStops, searchStopsNearby, getGtfsRouteStops } from "@/lib/api";
import type { BusRoute, BusStop } from "@/types";
import { useToast } from "@/context/toast";
import StopSearch from "@/components/StopSearch";
import RouteSearch from "@/components/RouteSearch";
import RouteSelector from "@/components/RouteSelector";
import dynamic from "next/dynamic";

const MapExplorer = dynamic(() => import("@/components/MapExplorer"), {
  ssr: false,
});

type Tab = "map" | "route" | "stop";

export default function NewMonitorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [tab, setTab] = useState<Tab>("map");
  const [stop, setStop] = useState<BusStop | null>(null);
  const [route, setRoute] = useState<BusRoute | null>(null);
  const [mapQuery, setMapQuery] = useState("");

  const { data: mapStops = [] } = useQuery<BusStop[]>({
    queryKey: ["stops", mapQuery],
    queryFn: () => searchStops(mapQuery),
    enabled: mapQuery.length >= 2,
  });

  const create = useMutation({
    mutationFn: () =>
      createMonitor({
        stop_id: stop!.id,
        stop_name: stop!.name,
        stop_latitude: stop!.latitude,
        stop_longitude: stop!.longitude,
        route_id: route!.route_id,
        route_number: route!.route_number,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      addToast("Monitor created", "success");
      router.push("/");
    },
    onError: (err: Error) => {
      addToast(`Failed to create: ${err.message}`, "error");
    },
  });

  const handleRouteSelect = (r: BusRoute | null) => {
    if (!r) { setRoute(null); return; }
    if (r.route_id === "__back__") { setStop(null); setRoute(null); return; }
    setRoute(r);
  };

  const handleMapStopSelect = (s: BusStop) => {
    setStop(s);
    setTab("stop");
    setRoute(null);
  };

  if (stop && route) {
    return (
      <ConfirmStep
        stop={stop}
        route={route}
        onBack={() => { setStop(null); setRoute(null); }}
        onCreate={() => create.mutate()}
        isCreating={create.isPending}
        createError={create.isError ? create.error?.message : null}
      />
    );
  }

  return (
    <div>
      <h1>New Monitor</h1>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["map", "route", "stop"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setStop(null); setRoute(null); }}
            disabled={tab === t}
          >
            {t === "map" ? "By Map" : t === "route" ? "By Route" : "By Stop"}
          </button>
        ))}
      </div>

      {tab === "stop" && (
        <StopFlow
          stop={stop}
          onStopSelect={setStop}
          onRouteSelect={handleRouteSelect}
        />
      )}

      {tab === "route" && (
        <RouteFlow
          route={route}
          stop={stop}
          onStopSelect={setStop}
          onRouteSelect={handleRouteSelect}
        />
      )}

      {tab === "map" && <MapFlow stops={mapStops} query={mapQuery} onQueryChange={setMapQuery} onStopSelect={handleMapStopSelect} />}
    </div>
  );
}

function StopFlow({
  stop,
  onStopSelect,
  onRouteSelect,
}: {
  stop: BusStop | null;
  onStopSelect: (s: BusStop) => void;
  onRouteSelect: (r: BusRoute | null) => void;
}) {
  if (!stop) return <StopSearch onSelect={onStopSelect} />;
  return (
    <RouteSelector
      stopId={stop.id}
      stopName={stop.name}
      onSelect={(r) => onRouteSelect(r.route_id === "__back__" ? null : r)}
    />
  );
}

function RouteFlow({
  route,
  stop,
  onStopSelect,
  onRouteSelect,
}: {
  route: BusRoute | null;
  stop: BusStop | null;
  onStopSelect: (s: BusStop) => void;
  onRouteSelect: (r: BusRoute | null) => void;
}) {
  const { data: routeStops = [] } = useQuery<BusStop[]>({
    queryKey: ["gtfs-route-stops", route?.route_number],
    queryFn: () => getGtfsRouteStops(route!.route_number),
    enabled: !!route?.route_number,
  });

  if (!route) return <RouteSearch onSelect={onRouteSelect} />;

  if (!stop) {
    return (
      <div>
        <p>
          Route <strong>{route.route_number}</strong>
          {route.description && <> &mdash; {route.description}</>}
        </p>
        <button onClick={() => onRouteSelect(null)}>Change route</button>

        {routeStops.length > 0 && (
          <MapExplorer
            stops={routeStops.map((s) => ({ ...s, id: s.id || "" }))}
            onSelect={onStopSelect}
          />
        )}

        <p>Select a stop on this route:</p>
        <StopSearch onSelect={onStopSelect} />
      </div>
    );
  }

  return (
    <RouteSelector
      stopId={stop.id}
      stopName={stop.name}
      onSelect={(r) => onRouteSelect(r.route_id === "__back__" ? null : r)}
    />
  );
}

function MapFlow({
  stops,
  query,
  onQueryChange,
  onStopSelect,
}: {
  stops: BusStop[];
  query: string;
  onQueryChange: (q: string) => void;
  onStopSelect: (s: BusStop) => void;
}) {
  const [mapStops, setMapStops] = useState<BusStop[]>([]);

  const handleSearchArea = async (lat: number, lng: number) => {
    try {
      const nearby = await searchStopsNearby(lat, lng);
      setMapStops(nearby);
    } catch {
      // ignore
    }
  };

  const displayedStops = mapStops.length > 0 ? mapStops : stops;

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          placeholder="Search for a stop to show on the map..."
          value={query}
          onChange={(e) => { onQueryChange(e.target.value); setMapStops([]); }}
          style={{ flex: 1 }}
        />
        {query && (
          <button onClick={() => { onQueryChange(""); setMapStops([]); }}>Clear</button>
        )}
      </div>
      <MapExplorer
        stops={displayedStops}
        onSelect={onStopSelect}
        onSearchArea={handleSearchArea}
      />
      {displayedStops.length === 0 && query.length >= 2 && (
        <p>No stops found. Try a different search.</p>
      )}
      {mapStops.length > 0 && (
        <p style={{ marginTop: "0.5rem", color: "#666" }}>
          {mapStops.length} stop{mapStops.length !== 1 ? "s" : ""} found in this area.
        </p>
      )}
    </div>
  );
}

function ConfirmStep({
  stop,
  route,
  onBack,
  onCreate,
  isCreating,
  createError,
}: {
  stop: BusStop;
  route: BusRoute;
  onBack: () => void;
  onCreate: () => void;
  isCreating: boolean;
  createError: string | null;
}) {
  return (
    <div>
      <p>
        <strong>{stop.name}</strong> &mdash; Route {route.route_number}
      </p>
      {route.description && (
        <p style={{ color: "#666", fontSize: "0.9rem" }}>{route.description}</p>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button onClick={onBack}>Change</button>
        <button onClick={onCreate} disabled={isCreating}>
          {isCreating ? "Creating..." : "Create Monitor"}
        </button>
      </div>
      {createError && <p className="error">Failed to create: {createError}</p>}
    </div>
  );
}
