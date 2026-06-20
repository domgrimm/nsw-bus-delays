"use client";

import type { ArrivalRecord } from "@/types";
import { formatDelay } from "@/lib/format";

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

type StatusVariant = "danger" | "warning" | "success" | "primary" | "muted";

function badgeVariant(status: string): StatusVariant {
  const normalized = status.toLowerCase();
  if (normalized === "delayed") return "danger";
  if (normalized === "early") return "primary";
  if (normalized === "cancelled") return "muted";
  if (normalized === "no_tracking") return "warning";
  return "success";
}

function delayVariant(seconds: number): "success" | "warning" | "danger" {
  if (seconds > 120) return "danger";
  if (seconds > 0) return "warning";
  return "success";
}

export default function ArrivalTable({ data }: { data: ArrivalRecord[] }) {
  if (data.length === 0) return <p className="muted">No arrival records yet.</p>;

  return (
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
        {data.map((r) => (
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
  );
}
