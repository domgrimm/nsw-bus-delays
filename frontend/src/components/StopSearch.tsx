"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { searchStops } from "@/lib/api";
import type { BusStop } from "@/types";
import Skeleton from "./Skeleton";

export default function StopSearch({
  onSelect,
}: {
  onSelect: (stop: BusStop) => void;
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
  } = useQuery<BusStop[]>({
    queryKey: ["stops", debounced],
    queryFn: () => searchStops(debounced),
    enabled: debounced.length >= 2,
  });

  return (
    <div>
      <input
        type="text"
        placeholder="Search for a bus stop..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isLoading && <Skeleton lines={3} />}
      {isError && <p className="error">Search failed: {error.message}</p>}
      {!isError && !isLoading && results.length > 0 && (
        <ul>
          {results.map((s) => (
            <li key={s.id} onClick={() => onSelect(s)}>
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
