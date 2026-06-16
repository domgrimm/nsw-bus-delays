"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { getMonitorArrivals } from "@/lib/api";
import Skeleton from "@/components/Skeleton";
import ArrivalTable from "@/components/ArrivalTable";

export default function MonitorHistoryPage() {
  const { id } = useParams<{ id: string }>();

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

  return (
    <div>
      <Link href={`/monitor/${id}`} className="page-header__back">
        &larr; Back to Dashboard
      </Link>
      <h1 style={{ marginTop: "var(--space-sm)" }}>Arrival History</h1>
      <ArrivalTable data={arrivals} />
    </div>
  );
}
