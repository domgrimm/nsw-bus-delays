"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getStopRoutes } from "@/lib/api";
import type { BusRoute } from "@/types";
import Skeleton from "./Skeleton";

export default function RouteSelector({
  stopId,
  stopName,
  onSelect,
}: {
  stopId: string;
  stopName: string;
  onSelect: (route: BusRoute) => void;
}) {
  const [filter, setFilter] = useState("");

  const {
    data: routes = [],
    isLoading,
    isError,
    error,
  } = useQuery<BusRoute[]>({
    queryKey: ["stop-routes", stopId],
    queryFn: () => getStopRoutes(stopId),
  });

  const handleBack = () => {
    onSelect({
      route_id: "__back__",
      route_number: "",
      name: "",
      description: "",
      destination_name: "",
    } as BusRoute);
  };

  const handleKey = (
    e: React.KeyboardEvent<HTMLLIElement>,
    route: BusRoute,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(route);
    }
  };

  if (isLoading) return <Skeleton lines={5} />;
  if (isError) return <p className="error">Failed to load routes: {error.message}</p>;

  if (routes.length === 0) {
    return <p className="muted">No routes found for {stopName}.</p>;
  }

  const filtered = filter
    ? routes.filter(
        (r) =>
          r.route_number.toLowerCase().includes(filter.toLowerCase()) ||
          r.description.toLowerCase().includes(filter.toLowerCase()) ||
          r.destination_name.toLowerCase().includes(filter.toLowerCase()),
      )
    : routes;

  return (
    <div>
      <h3>
        Routes at {stopName}{" "}
        <button onClick={handleBack}>&larr; back</button>
      </h3>

      <input
        type="text"
        placeholder="Filter routes by number or destination..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filter routes"
      />

      {filtered.length === 0 && <p className="muted">No routes match.</p>}

      <ul role="listbox" aria-label="Routes">
        {filtered.slice(0, 30).map((r) => (
          <li
            key={r.route_id}
            className="selectable"
            role="option"
            tabIndex={0}
            onClick={() => onSelect(r)}
            onKeyDown={(e) => handleKey(e, r)}
            aria-selected={false}
          >
            <strong>{r.route_number}</strong>
            {r.description && <> &mdash; {r.description}</>}
          </li>
        ))}
      </ul>
    </div>
  );
}
