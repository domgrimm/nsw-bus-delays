"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

import type { ArrivalBucket } from "@/types";

function bucketColor(delayMinutes: number): string {
  if (delayMinutes < 0) return "var(--color-delay-early-strong)";
  if (delayMinutes === 0) return "var(--color-delay-ontime)";
  if (delayMinutes <= 2) return "var(--color-delay-slight)";
  if (delayMinutes <= 5) return "var(--color-status-warning)";
  return "var(--color-status-danger)";
}

export default function ArrivalDistributionChart({
  data,
}: {
  data: ArrivalBucket[];
}) {
  if (data.length === 0) return <p className="muted">No distribution data available.</p>;

  const chartData = data.map((d) => ({
    delay_minutes: d.delay_minutes,
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="delay_minutes"
          fontSize={11}
          label={{
            value: "Delay (minutes)",
            position: "insideBottom",
            offset: -5,
            fontSize: 11,
          }}
          stroke="var(--color-status-muted)"
        />
        <YAxis
          fontSize={11}
          allowDecimals={false}
          stroke="var(--color-status-muted)"
        />
        <Tooltip
          formatter={(v: number) => [`${v} arrivals`, "Count"]}
          labelFormatter={(l: number) => {
            if (l < 0) return `${Math.abs(l)} min early`;
            if (l === 0) return "On time";
            return `${l} min late`;
          }}
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--rounded-sm)",
            color: "var(--color-ink)",
            fontSize: "0.85rem",
          }}
        />
        <ReferenceLine
          x={0}
          stroke="var(--color-status-success)"
          strokeWidth={2}
          strokeDasharray="4 4"
          label={{
            value: "On Time",
            position: "top",
            fontSize: 10,
            fill: "var(--color-status-success)",
          }}
        />
        <Bar dataKey="count">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={bucketColor(entry.delay_minutes)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
