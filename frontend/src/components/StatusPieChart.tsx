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

const COLORS = {
  early: "#125be4",     // Transit Blue
  on_time: "#107c41",   // Transit Green
  delayed: "#da292b",   // Transit Red
  cancelled: "#8a9099", // Muted Slate
};


export default function StatusPieChart({ stats }: { stats: DelayStats }) {
  const data = [
    { name: "Early", value: stats.early_count },
    { name: "On Time", value: stats.on_time_count },
    { name: "Delayed", value: stats.delayed_count },
    { name: "Cancelled", value: stats.cancelled_count },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <p>No data</p>;
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
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS] || "#ccc"} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
