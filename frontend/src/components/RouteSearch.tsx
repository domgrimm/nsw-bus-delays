"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { searchRoutes } from "@/lib/api";
import type { BusRoute } from "@/types";
import Skeleton from "./Skeleton";

export default function RouteSearch({
  onSelect,
}: {
  onSelect: (route: BusRoute) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer.current);
  }, [query]);

  const {
    data: results = [],
    isLoading,
    isError,
    error,
  } = useQuery<BusRoute[]>({
    queryKey: ["routes", debounced],
    queryFn: () => searchRoutes(debounced),
    enabled: debounced.length >= 2,
  });

  const handleKey = (
    e: React.KeyboardEvent<HTMLLIElement>,
    route: BusRoute,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(route);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search for a bus route (e.g. 389)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search for a bus route"
      />
      {isLoading && <Skeleton lines={3} />}
      {isError && <p className="error">Search failed: {error.message}</p>}
      {!isError && !isLoading && results.length > 0 && (
        <ul role="listbox" aria-label="Bus route results">
          {results.map((r) => (
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
      )}
    </div>
  );
}
