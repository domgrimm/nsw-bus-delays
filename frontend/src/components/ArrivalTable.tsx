"use client";

import type { ArrivalRecord } from "@/types";

function formatDelay(seconds: number): string {
  const sign = seconds < 0 ? "-" : "+";
  const abs = Math.abs(Math.round(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusBadgeStyle(status: string) {
  const normalized = status.toLowerCase();
  let bg = "var(--color-status-success)";
  if (normalized === "delayed") bg = "var(--color-status-danger)";
  if (normalized === "early") bg = "var(--color-primary)";
  if (normalized === "cancelled") bg = "var(--color-status-muted)";

  return {
    backgroundColor: bg,
    color: "#ffffff",
    padding: "0.25rem 0.5rem",
    borderRadius: "var(--rounded-sm)",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    display: "inline-block",
  };
}

function getDelayStyle(seconds: number) {
  let color = "var(--color-status-success)";
  if (seconds > 120) {
    color = "var(--color-status-danger)";
  } else if (seconds > 0) {
    color = "var(--color-status-warning)";
  }
  return {
    color,
    fontWeight: 600,
  };
}

export default function ArrivalTable({ data }: { data: ArrivalRecord[] }) {
  if (data.length === 0) return <p>No arrival records yet.</p>;

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
            <td style={getDelayStyle(r.delay_seconds)}>
              {formatDelay(r.delay_seconds)}
            </td>
            <td>
              <span style={getStatusBadgeStyle(r.status)}>
                {formatStatus(r.status)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
