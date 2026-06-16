"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import type { DelayStats } from "@/types";

const COLORS: Record<string, string> = {
  early: "var(--color-primary)",
  on_time: "var(--color-status-success)",
  delayed: "var(--color-status-danger)",
  cancelled: "var(--color-status-muted)",
};

const LABEL_KEYS: Record<string, "early" | "on_time" | "delayed" | "cancelled"> = {
  Early: "early",
  "On Time": "on_time",
  Delayed: "delayed",
  Cancelled: "cancelled",
};

export default function StatusPieChart({ stats }: { stats: DelayStats }) {
  const data = [
    { name: "Early", value: stats.early_count },
    { name: "On Time", value: stats.on_time_count },
    { name: "Delayed", value: stats.delayed_count },
    { name: "Cancelled", value: stats.cancelled_count },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <p className="muted">No data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label
          stroke="var(--color-surface)"
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={COLORS[LABEL_KEYS[entry.name] as string] ?? "var(--color-status-muted)"}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--rounded-sm)",
            color: "var(--color-ink)",
            fontSize: "0.85rem",
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
