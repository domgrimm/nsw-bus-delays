"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { ArrivalRecord } from "@/types";
import { formatDelay } from "@/lib/format";

function formatX(time: string): string {
  const d = new Date(time);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return isToday
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function DelayChart({ data }: { data: ArrivalRecord[] }) {
  const chartData = data
    .slice()
    .reverse()
    .map((r) => ({
      time: formatX(r.recorded_at),
      delay: r.delay_seconds,
    }));

  return (
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
  );
}
