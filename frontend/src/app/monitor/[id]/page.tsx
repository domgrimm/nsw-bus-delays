"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";

import { getMonitor, getMonitorStats, getMonitorArrivals } from "@/lib/api";
import type { Period } from "@/types";
import { UIProvider, useUI } from "@/context/ui";
import Skeleton from "@/components/Skeleton";
import SummaryCards from "@/components/SummaryCards";
import DelayChart from "@/components/DelayChart";
import OnTimeBarChart from "@/components/OnTimeBarChart";
import StatusPieChart from "@/components/StatusPieChart";
import ArrivalTable from "@/components/ArrivalTable";

const StopMap = dynamic(() => import("@/components/StopMap"), { ssr: false });

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const periods: Period[] = ["day", "week", "month"];
  return (
    <div className="segmented-control">
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          disabled={p === value}
          className={p === value ? "active" : ""}
        >
          {p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  );
}

function DashboardInner() {
  const { id } = useParams<{ id: string }>();
  const { selectedPeriod, setSelectedPeriod } = useUI();
  const [showMap, setShowMap] = useState(false);

  const {
    data: monitor,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["monitor", id],
    queryFn: () => getMonitor(id),
  });

  const { data: stats, isError: statsError, error: statsErr } = useQuery({
    queryKey: ["monitor-stats", id, selectedPeriod],
    queryFn: () => getMonitorStats(id, selectedPeriod),
    refetchInterval: 60_000,
  });

  const { data: arrivals = [] } = useQuery({
    queryKey: ["monitor-arrivals", id],
    queryFn: () => getMonitorArrivals(id),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Skeleton lines={5} />;
  if (isError) return <p className="error">Error: {error.message}</p>;
  if (!monitor) return <p>Monitor not found.</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <Link href="/" style={{ fontSize: "0.85rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.5rem" }}>
            &larr; Back to Monitors
          </Link>
          <h1 style={{ marginBottom: "0.25rem" }}>
            {monitor.stop_name || `Stop ${monitor.stop_id}`}
          </h1>
          <p style={{ color: "var(--color-status-muted)", fontSize: "0.9rem", margin: 0 }}>
            Route {monitor.route_number} &middot; Stop ID: {monitor.stop_id} &middot; <Link href={`/monitor/${id}/history`} style={{ fontWeight: 600 }}>View History</Link>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          <button
            onClick={() => setShowMap(!showMap)}
            style={{
              background: showMap ? "var(--color-ink)" : "var(--color-surface)",
              color: showMap ? "var(--color-surface)" : "var(--color-ink)",
              border: "1px solid var(--color-border)",
              padding: "0.45rem 1rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              height: "38px",
              display: "flex",
              alignItems: "center"
            }}
          >
            {showMap ? "▾ Hide Map" : "▸ Show Map"}
          </button>
          <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
        </div>
      </div>

      {showMap && monitor.stop_latitude !== 0 && monitor.stop_longitude !== 0 && (
        <div className="panel" style={{ marginBottom: "1.5rem", padding: "0.5rem" }}>
          <StopMap
            stops={[
              {
                id: monitor.stop_id,
                name: monitor.stop_name,
                latitude: monitor.stop_latitude,
                longitude: monitor.stop_longitude,
              },
            ]}
            onSelect={() => {}}
            showSelect={false}
          />
        </div>
      )}

      {statsError && <p className="error">Failed to load stats: {statsErr.message}</p>}

      {stats && <SummaryCards stats={stats} />}

      <div className="dashboard-grid">
        <div className="dashboard-main">
          {arrivals.length > 0 && (
            <div className="panel">
              <h2 className="panel-title">Real-Time Delays (Last 20 Arrivals)</h2>
              <DelayChart data={arrivals} />
            </div>
          )}

          {stats && stats.daily_breakdown.length > 0 && (
            <div className="panel">
              <h2 className="panel-title">On-Time Performance Timeline</h2>
              <OnTimeBarChart data={stats.daily_breakdown} />
            </div>
          )}

          {arrivals.length > 0 && (
            <div className="panel">
              <h2 className="panel-title">Recent Arrivals Details</h2>
              <ArrivalTable data={arrivals.slice(0, 20)} />
            </div>
          )}
        </div>

        <div className="dashboard-sidebar">
          {stats && (
            <div className="panel">
              <h2 className="panel-title">Arrival Reliability Split</h2>
              <StatusPieChart stats={stats} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MonitorDashboardPage() {
  return (
    <UIProvider>
      <DashboardInner />
    </UIProvider>
  );
}
