"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { getMonitorArrivals } from "@/lib/api";
import Skeleton from "@/components/Skeleton";
import ArrivalTable from "@/components/ArrivalTable";

const PAGE_SIZE = 50;

export default function MonitorHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);

  const {
    data: arrivals = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["monitor-arrivals", id],
    queryFn: () => getMonitorArrivals(id),
    refetchInterval: 30_000,
  });

  if (isLoading) return <Skeleton lines={5} />;
  if (isError) return <p className="error">Failed to load arrivals: {error.message}</p>;

  const totalPages = Math.max(1, Math.ceil(arrivals.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageData = arrivals.slice(start, start + PAGE_SIZE);

  return (
    <div>
      <Link href={`/monitor/${id}`} className="page-header__back">
        &larr; Back to Dashboard
      </Link>
      <h1 style={{ marginTop: "var(--space-sm)" }}>Arrival History</h1>
      <p className="muted" style={{ marginBottom: "var(--space-md)" }}>
        {arrivals.length.toLocaleString()} total arrivals
      </p>
      <ArrivalTable data={pageData} />

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="outline"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
          >
            &larr; Previous
          </button>
          <span className="pagination__info">
            Page {safePage} of {totalPages}
          </span>
          <button
            className="outline"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
