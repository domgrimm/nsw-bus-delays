"use client";

import { useState, useCallback } from "react";
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

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function badgeVariant(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "delayed") return "danger";
  if (normalized === "early") return "primary";
  if (normalized === "cancelled") return "muted";
  return "success";
}

function delayVariant(seconds: number): "success" | "warning" | "danger" {
  if (seconds > 120) return "danger";
  if (seconds > 0) return "warning";
  return "success";
}

function formatX(time: string): string {
  const d = new Date(time);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pad(num: number): string {
  return String(num).padStart(2, "0");
}

function toDatetimeLocal(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function defaultCustomRange(): { from: string; to: string } {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: toDatetimeLocal(weekAgo), to: toDatetimeLocal(now) };
}

function PeriodSelector({
  value,
  onChange,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
}: {
  value: Period;
  onChange: (p: Period) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
}) {
  const periods: { value: Period; label: string }[] = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "all_time", label: "All Time" },
    { value: "custom", label: "Custom" },
  ];

  const handlePeriodChange = useCallback(
    (p: Period) => {
      if (p === "custom" && !customFrom && !customTo) {
        const range = defaultCustomRange();
        setCustomFrom(range.from);
        setCustomTo(range.to);
      }
      onChange(p);
    },
    [customFrom, customTo, setCustomFrom, setCustomTo, onChange],
  );

  return (
    <div className="period-selector-group">
      <div className="segmented-control" role="tablist" aria-label="Time period">
        {periods.map(({ value: pval, label }) => (
          <button
            key={pval}
            onClick={() => handlePeriodChange(pval)}
            disabled={pval === value}
            className={pval === value ? "active" : ""}
            role="tab"
            aria-selected={pval === value}
          >
            {label}
          </button>
        ))}
      </div>

      {value === "custom" && (
        <div className="date-range-row">
          <label className="date-range-label">
            From
            <input
              type="datetime-local"
              className="date-range-input"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="date-range-label">
            To
            <input
              type="datetime-local"
              className="date-range-input"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
        </div>
      )}
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
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

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

  const isCustom = period === "custom";
  const fromParam = isCustom ? customFrom : undefined;
  const toParam = isCustom ? customTo : undefined;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["scheduled-departure-stats", id, selectedTime, period, serviceType, customFrom, customTo],
    queryFn: () =>
      getScheduledDepartureStats(id, selectedTime!, period, serviceType, fromParam, toParam),
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
                  <PeriodSelector
                    value={period}
                    onChange={setPeriod}
                    customFrom={customFrom}
                    setCustomFrom={setCustomFrom}
                    customTo={customTo}
                    setCustomTo={setCustomTo}
                  />
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
                        <table>
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
                                <td>{formatTime(r.scheduled_arrival)}</td>
                                <td>{formatTime(r.actual_arrival)}</td>
                                <td className={`delay-cell delay-cell--${delayVariant(r.delay_seconds)}`}>
                                  {formatDelay(r.delay_seconds, { signed: true })}
                                </td>
                                <td>
                                  <span className={`status-badge status-${badgeVariant(r.status)}`}>
                                    {formatStatus(r.status)}
                                  </span>
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
