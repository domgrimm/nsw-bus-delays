"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";

import { getMonitor, getMonitorStats, getMonitorArrivals, getMonitorBunching, generateMockMonitors } from "@/lib/api";
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
import { useToast } from "@/context/toast";

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
    <div className="segmented-control">
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          disabled={p === value}
          className={p === value ? "active" : ""}
        >
          {p === "all_time" ? "All Time" : p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  );
}

function DashboardInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { selectedPeriod, setSelectedPeriod, useMock, setUseMock } = useUI();
  const { addToast } = useToast();
  const [showMap, setShowMap] = useState(false);

  const { data: monitor, isLoading, isError, error } = useQuery({
    queryKey: ["monitor", id],
    queryFn: () => getMonitor(id),
  });

  const { data: stats, isError: statsError, error: statsErr, isLoading: statsLoading } = useQuery({
    queryKey: ["monitor-stats", id, selectedPeriod, useMock],
    queryFn: () => getMonitorStats(id, selectedPeriod, useMock),
    refetchInterval: useMock ? false : 60_000,
  });

  const { data: arrivals = [] } = useQuery({
    queryKey: ["monitor-arrivals", id],
    queryFn: () => getMonitorArrivals(id),
    refetchInterval: 60_000,
  });

  const { data: bunchingData = [] } = useQuery({
    queryKey: ["monitor-bunching", id, selectedPeriod, useMock],
    queryFn: () => getMonitorBunching(id, selectedPeriod, useMock),
    refetchInterval: useMock ? false : 60_000,
  });

  const showHeatmap = selectedPeriod === "week" || selectedPeriod === "month" || selectedPeriod === "all_time";
  const showDailyBreakdown = selectedPeriod === "week" || selectedPeriod === "month" || selectedPeriod === "all_time";

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
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Mock data
          </label>
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

      {statsLoading && <Skeleton lines={2} />}

      {stats && <SummaryCards stats={stats} />}

      <div className="dashboard-grid">
        <div className="dashboard-main">
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
              <p style={{ color: "var(--color-status-muted)", fontSize: "0.85rem" }}>
                No bunching events detected in this period.
              </p>
            </div>
          )}

          {arrivals.length > 0 && !useMock && (
            <div className="panel">
              <h2 className="panel-title">Real-Time Delays (Last 20 Arrivals)</h2>
              <DelayChart data={arrivals} />
            </div>
          )}

          {arrivals.length > 0 && !useMock && (
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

          <div className="panel">
            <h2 className="panel-title">Mock Data</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--color-status-muted)", marginBottom: "0.75rem" }}>
              Generate mock monitors with varied delay patterns for exploration.
            </p>
            <button
              onClick={async () => {
                try {
                  const result = await generateMockMonitors();
                  addToast(`Created ${result.monitor_ids.length} mock monitors`, "success");
                  router.refresh();
                } catch (e) {
                  addToast("Failed to create mock monitors", "error");
                }
              }}
              style={{ width: "100%" }}
            >
              Generate Mock Monitors
            </button>
          </div>
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
