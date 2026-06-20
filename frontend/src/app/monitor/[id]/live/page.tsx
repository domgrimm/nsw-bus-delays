"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { getMonitor, getMonitorDepartures } from "@/lib/api";
import { formatDelay } from "@/lib/format";
import type { LiveDeparture } from "@/types";
import Skeleton from "@/components/Skeleton";

const PAGE_SIZE = 20;

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

function formatTimeShort(isoString: string): string {
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")!.value;
  const m = parts.find((p) => p.type === "minute")!.value;
  return `${h}:${m}`;
}

type StatusVariant = "danger" | "warning" | "success" | "primary" | "muted";

function computeStatus(dep: LiveDeparture): { status: string; variant: StatusVariant; delay: number } {
  if (dep.is_cancelled) {
    return { status: "Cancelled", variant: "muted", delay: 0 };
  }
  if (!dep.has_tracking) {
    return { status: "No Tracking", variant: "warning", delay: 0 };
  }
  const scheduled = new Date(dep.scheduled_departure).getTime();
  const estimated = dep.estimated_departure ? new Date(dep.estimated_departure).getTime() : scheduled;
  const delay = Math.round((estimated - scheduled) / 1000);

  if (delay < -120) return { status: "Early", variant: "primary", delay };
  if (delay > 120) return { status: "Delayed", variant: "danger", delay };
  return { status: "On Time", variant: "success", delay };
}

export default function LiveTimetablePage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(0);

  const { data: monitor, isLoading: monitorLoading } = useQuery({
    queryKey: ["monitor", id],
    queryFn: () => getMonitor(id),
  });

  const { data: departures = [], isLoading: departuresLoading } = useQuery({
    queryKey: ["monitor-departures", id],
    queryFn: () => getMonitorDepartures(id, 100),
    refetchInterval: 60_000,
  });

  const totalPages = Math.max(1, Math.ceil(departures.length / PAGE_SIZE));
  const paged = useMemo(
    () => departures.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [departures, page],
  );

  if (page >= totalPages && totalPages > 0) {
    setPage(0);
  }

  if (monitorLoading) {
    return <Skeleton lines={8} />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link href={`/monitor/${id}`} className="page-header__back">
            &larr; Back to Dashboard
          </Link>
          <div className="page-header__title-row">
            {monitor && (
              <span className="monitor-card__route-badge">{monitor.route_number}</span>
            )}
            <h1 className="page-heading" style={{ margin: 0 }}>
              {monitor?.stop_name || `Stop ${monitor?.stop_id || ""}`}
            </h1>
            <span className="muted" style={{ marginLeft: "var(--space-sm)" }}>
              Live Timetable
            </span>
          </div>
        </div>
      </div>

      {departuresLoading ? (
        <Skeleton lines={12} />
      ) : departures.length === 0 ? (
        <p className="muted">No upcoming departures found.</p>
      ) : (
        <>
          <div className="pagination-bar">
            <span className="muted">
              Showing {paged.length} of {departures.length} departures
            </span>
            <div className="pagination-controls">
              <button
                className="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                &larr; Prev
              </button>
              <span className="muted">
                Page {page + 1} of {totalPages}
              </span>
              <button
                className="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next &rarr;
              </button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Scheduled</th>
                <th>Estimated</th>
                <th>Delay</th>
                <th>Status</th>
                <th>Destination</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((dep) => {
                const { status, variant, delay } = computeStatus(dep);
                return (
                  <tr key={dep.trip_id}>
                    <td>{formatTime(dep.scheduled_departure)}</td>
                    <td>
                      {dep.estimated_departure
                        ? formatTime(dep.estimated_departure)
                        : formatTime(dep.scheduled_departure)}
                    </td>
                    <td className={`delay-cell delay-cell--${variant === "danger" ? "danger" : variant === "primary" ? "warning" : "success"}`}>
                      {status === "Cancelled" || status === "No Tracking"
                        ? "\u2014"
                        : formatDelay(delay, { signed: true })}
                    </td>
                    <td>
                      <span className={`status-badge status-${variant}`}>
                        {status}
                      </span>
                    </td>
                    <td>{dep.destination_name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
