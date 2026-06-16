"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";

import { getMonitor, getMonitorStats, getMonitorArrivals, getMonitorBunching } from "@/lib/api";
import type { Period } from "@/types";
import { UIProvider, useUI } from "@/context/ui";
import Skeleton from "@/components/Skeleton";
import SummaryCards from "@/components/SummaryCards";
import DelayChart from "@/components/DelayChart";
import OnTimeBarChart from "@/components/OnTimeBarChart";
import StatusPieChart from "@/components/StatusPieChart";
import ArrivalTable from "@/components/ArrivalTable";
import ArrivalDistributionChart from "@/components/ArrivalDistributionChart";
import BunchingTimeline from "@/components/BunchingTimeline";
import HeatMap from "@/components/HeatMap";

const StopMap = dynamic(() => import("@/components/StopMap"), { ssr: false });

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const periods: Period[] = ["day", "week", "month", "all_time"];
  return (
    <div className="segmented-control" role="tablist" aria-label="Time period">
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          disabled={p === value}
          className={p === value ? "active" : ""}
          role="tab"
          aria-selected={p === value}
        >
          {p === "all_time" ? "All Time" : p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  );
}

function DashboardInner() {
  const { id } = useParams<{ id: string }>();
  const { selectedPeriod, setSelectedPeriod } = useUI();
  const [showMap, setShowMap] = useState(false);

  const { data: monitor, isLoading, isError, error } = useQuery({
    queryKey: ["monitor", id],
    queryFn: () => getMonitor(id),
  });

  const { data: stats, isError: statsError, error: statsErr, isLoading: statsLoading } = useQuery({
    queryKey: ["monitor-stats", id, selectedPeriod],
    queryFn: () => getMonitorStats(id, selectedPeriod),
    refetchInterval: 60_000,
  });

  const { data: arrivals = [] } = useQuery({
    queryKey: ["monitor-arrivals", id],
    queryFn: () => getMonitorArrivals(id),
    refetchInterval: 60_000,
  });

  const { data: bunchingData = [] } = useQuery({
    queryKey: ["monitor-bunching", id, selectedPeriod],
    queryFn: () => getMonitorBunching(id, selectedPeriod),
    refetchInterval: 60_000,
  });

  const showHeatmap = selectedPeriod === "week" || selectedPeriod === "month" || selectedPeriod === "all_time";
  const showDailyBreakdown = selectedPeriod === "week" || selectedPeriod === "month" || selectedPeriod === "all_time";

  if (isLoading) return <Skeleton lines={5} />;
  if (isError) return <p className="error">Error: {error.message}</p>;
  if (!monitor) return <p className="muted">Monitor not found.</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/" className="page-header__back">
            &larr; Back to Monitors
          </Link>
          <div className="page-header__title-row">
            <span className="monitor-card__route-badge">{monitor.route_number}</span>
            <h1 className="page-heading" style={{ margin: 0 }}>
              {monitor.stop_name || `Stop ${monitor.stop_id}`}
            </h1>
          </div>
          <p className="page-header__sub">
            Stop ID: {monitor.stop_id} &middot;{" "}
            <Link href={`/monitor/${id}/history`} className="text-link">
              View History
            </Link>
            {" "}&middot;{" "}
            <Link href={`/monitor/${id}/timetable`} className="text-link">
              Timetable Comparison
            </Link>
          </p>
        </div>

        <div className="page-header__actions">
          <button
            onClick={() => setShowMap(!showMap)}
            className={`outline ${showMap ? "active" : ""}`}
            aria-expanded={showMap}
            aria-controls="stop-map-panel"
          >
            {showMap ? "▾ Hide Map" : "▸ Show Map"}
          </button>
          <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
        </div>
      </div>

      {showMap && monitor.stop_latitude !== 0 && monitor.stop_longitude !== 0 && (
        <div id="stop-map-panel" className="panel" style={{ marginBottom: "var(--space-lg)", padding: "var(--space-sm)" }}>
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

      {statsLoading && <Skeleton lines={2} />}

      {stats && <SummaryCards stats={stats} />}

      <div className="dashboard-grid">
        <div className="dashboard-main">
          {stats && stats.arrival_distribution && stats.arrival_distribution.length > 0 && (
            <div className="panel">
              <h2 className="panel-title">Arrival Probability Distribution</h2>
              <ArrivalDistributionChart data={stats.arrival_distribution} />
            </div>
          )}

          {showDailyBreakdown && stats && stats.daily_breakdown.length > 0 && (
            <div className="panel">
              <h2 className="panel-title">On-Time Performance Timeline</h2>
              <OnTimeBarChart data={stats.daily_breakdown} />
            </div>
          )}

          {bunchingData.length > 0 && (
            <div className="panel">
              <h2 className="panel-title">Bus Bunching Events</h2>
              <BunchingTimeline data={bunchingData} />
            </div>
          )}

          {bunchingData.length === 0 && showHeatmap && (
            <div className="panel">
              <h2 className="panel-title">Bus Bunching Events</h2>
              <p className="muted">No bunching events detected in this period.</p>
            </div>
          )}

          {arrivals.length > 0 && (
            <div className="panel">
              <h2 className="panel-title">Real-Time Delays (Last 20 Arrivals)</h2>
              <DelayChart data={arrivals} />
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

          {showHeatmap && stats && stats.heatmap && stats.heatmap.length > 0 && (
            <div className="panel">
              <h2 className="panel-title">
                {selectedPeriod === "all_time"
                  ? "All-Time Delay Heatmap"
                  : `Delay Heatmap (${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)})`}
              </h2>
              <HeatMap
                data={stats.heatmap}
                weekdayData={stats.weekday_heatmap}
                weekendData={stats.weekend_heatmap}
              />
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
