"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { getMonitor, getRouteTimetable, getScheduledDepartureStats } from "@/lib/api";
import { formatDelay } from "@/lib/format";
import type { Period, ScheduledDepartureStats } from "@/types";
import Skeleton from "@/components/Skeleton";

type ServiceType = "weekday" | "saturday" | "sunday";

const SERVICE_LABELS: Record<ServiceType, string> = {
  weekday: "Weekdays",
  saturday: "Saturdays",
  sunday: "Sundays/Holidays",
};

function formatX(time: string): string {
  const d = new Date(time);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge--${status}`}>{status.replace("_", " ")}</span>;
}

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

function SummaryCards({ stats }: { stats: ScheduledDepartureStats }) {
  const cards: { label: string; value: string; variant: string }[] = [
    {
      label: "Average Delay",
      value: formatDelay(stats.average_delay_seconds),
      variant:
        stats.average_delay_seconds > 120
          ? "danger"
          : stats.average_delay_seconds > 0
            ? "warning"
            : "success",
    },
    {
      label: "On-Time",
      value: `${stats.on_time_percentage.toFixed(1)}%`,
      variant:
        stats.on_time_percentage >= 80
          ? "success"
          : stats.on_time_percentage >= 60
            ? "warning"
            : "danger",
    },
    {
      label: "Cancelled",
      value: stats.cancelled_count.toLocaleString(),
      variant: stats.cancelled_count > 0 ? "danger" : "muted",
    },
    {
      label: "Total Arrivals",
      value: stats.total_arrivals.toLocaleString(),
      variant: "ink",
    },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => (
        <div key={c.label} className="card">
          <p className="card-label">{c.label}</p>
          <p className={`card-value status-${c.variant}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function TimetableComparisonPage() {
  const { id } = useParams<{ id: string }>();
  const [serviceType, setServiceType] = useState<ServiceType>("weekday");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");

  const { data: monitor, isLoading: monitorLoading, isError: monitorError } = useQuery({
    queryKey: ["monitor", id],
    queryFn: () => getMonitor(id),
  });

  const routeNumber = monitor?.route_number ?? "";
  const stopId = monitor?.stop_id ?? "";

  const { data: timetable, isLoading: timetableLoading } = useQuery({
    queryKey: ["timetable", routeNumber, stopId],
    queryFn: () => getRouteTimetable(routeNumber, stopId),
    enabled: !!routeNumber && !!stopId,
  });

  const times = timetable?.[serviceType] ?? [];

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["scheduled-departure-stats", id, selectedTime, period, serviceType],
    queryFn: () =>
      getScheduledDepartureStats(id, selectedTime!, period, serviceType),
    enabled: !!selectedTime,
    refetchInterval: 60_000,
  });

  if (monitorLoading) return <Skeleton lines={5} />;
  if (monitorError || !monitor) return <p className="error">Monitor not found.</p>;

  const chartData = (stats?.arrivals ?? [])
    .slice()
    .reverse()
    .map((r) => ({
      time: formatX(r.recorded_at),
      delay: r.delay_seconds,
    }));

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href={`/monitor/${id}`} className="page-header__back">
            &larr; Back to Dashboard
          </Link>
          <div className="page-header__title-row">
            <span className="monitor-card__route-badge">{monitor.route_number}</span>
            <h1 className="page-heading" style={{ margin: 0 }}>
              {monitor.stop_name || `Stop ${monitor.stop_id}`}
            </h1>
            <span className="muted" style={{ marginLeft: "var(--space-sm)" }}>
              Timetable Comparison
            </span>
          </div>
        </div>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Service type" style={{ marginBottom: "var(--space-lg)" }}>
        {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((st) => (
          <button
            key={st}
            onClick={() => {
              setServiceType(st);
              setSelectedTime(null);
            }}
            disabled={st === serviceType}
            className={st === serviceType ? "active" : ""}
            role="tab"
            aria-selected={st === serviceType}
          >
            {SERVICE_LABELS[st]}
          </button>
        ))}
      </div>

      {timetableLoading && <Skeleton lines={3} />}

      {!timetableLoading && times.length === 0 && (
        <div className="panel" style={{ marginBottom: "var(--space-lg)" }}>
          <p className="muted">
            No timetable data available for route {routeNumber} at this stop.{" "}
            GTFS data may still be loading or this stop may not be served by this route.
          </p>
        </div>
      )}

      {times.length > 0 && (
        <div className="timetable-layout">
          <div className="timetable-time-list panel">
            {times.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className={`outline ${selectedTime === t ? "active" : ""}`}
                style={{
                  fontVariantNumeric: "tabular-nums",
                  padding: "var(--space-xs) var(--space-sm)",
                  fontSize: "0.95rem",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="timetable-content">
            {!selectedTime && (
              <div className="panel">
                <p className="muted">
                  Select a scheduled time from the list to view arrival statistics.
                </p>
              </div>
            )}

            {selectedTime && (
              <>
                <div className="timetable-selected-header">
                  <h2 className="panel-title" style={{ margin: 0 }}>
                    {SERVICE_LABELS[serviceType]} at {selectedTime}
                  </h2>
                  <PeriodSelector value={period} onChange={setPeriod} />
                </div>

                {statsLoading && <Skeleton lines={3} />}

                {stats && stats.total_arrivals === 0 && (
                  <div className="panel">
                    <p className="muted">
                      No arrival records found for {serviceType} at {selectedTime} in the{" "}
                      {period === "all_time" ? "all time" : period} period. Data may not have been
                      collected yet for this scheduled time.
                    </p>
                  </div>
                )}

                {stats && stats.total_arrivals > 0 && (
                  <>
                    <SummaryCards stats={stats} />

                    {chartData.length > 0 && (
                      <div className="panel">
                        <h3 className="panel-title">Delay Over Time</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis
                              dataKey="time"
                              fontSize={12}
                              interval="preserveStartEnd"
                              stroke="var(--color-status-muted)"
                            />
                            <YAxis
                              tickFormatter={(v: number) => `${Math.round(v / 60)}m`}
                              stroke="var(--color-status-muted)"
                            />
                            <Tooltip
                              formatter={(v: number) => formatDelay(v)}
                              contentStyle={{
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--rounded-sm)",
                                color: "var(--color-ink)",
                                fontSize: "0.85rem",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="delay"
                              stroke="var(--color-primary)"
                              dot={false}
                              strokeWidth={2}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="panel">
                      <h3 className="panel-title">Recent Arrivals ({stats.total_arrivals} total)</h3>
                      <div style={{ overflowX: "auto" }}>
                        <table className="arrival-table">
                          <thead>
                            <tr>
                              <th>Scheduled</th>
                              <th>Actual</th>
                              <th>Delay</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.arrivals.slice(0, 30).map((r) => (
                              <tr key={r.id}>
                                <td>
                                  {new Date(r.scheduled_arrival).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>
                                <td>
                                  {new Date(r.actual_arrival).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>
                                <td className={r.delay_seconds > 120 ? "status-danger" : r.delay_seconds < -120 ? "text-muted" : "status-success"}>
                                  {formatDelay(r.delay_seconds)}
                                </td>
                                <td>
                                  <StatusBadge status={r.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
