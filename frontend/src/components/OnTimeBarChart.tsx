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

import type { DailyStats } from "@/types";

const OTP_BENCHMARK = 80;

export default function OnTimeBarChart({
  data,
}: {
  data: DailyStats[];
}) {
  if (data.length === 0) return <p className="muted">No daily data available.</p>;

  const chartData = data.map((d) => ({
    date: d.date,
    on_time_percentage:
      d.total_arrivals > 0
        ? Math.round((d.on_time_count / d.total_arrivals) * 100)
        : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          fontSize={12}
          stroke="var(--color-status-muted)"
        />
        <YAxis
          domain={[0, 100]}
          unit="%"
          stroke="var(--color-status-muted)"
        />
        <Tooltip
          formatter={(v: number) => `${v}%`}
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--rounded-sm)",
            color: "var(--color-ink)",
            fontSize: "0.85rem",
          }}
        />
        <ReferenceLine
          y={OTP_BENCHMARK}
          stroke="var(--color-status-warning)"
          strokeDasharray="5 5"
          strokeWidth={1.5}
          label={{
            value: `Benchmark ${OTP_BENCHMARK}%`,
            position: "right",
            fontSize: 10,
            fill: "var(--color-status-warning)",
          }}
        />
        <Bar dataKey="on_time_percentage" name="On-Time %">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.on_time_percentage >= OTP_BENCHMARK
                  ? "var(--color-status-success)"
                  : "var(--color-status-danger)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
