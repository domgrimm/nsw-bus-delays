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
  if (data.length === 0) return <p>No daily data available.</p>;

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
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis domain={[0, 100]} unit="%" />
        <Tooltip formatter={(v: number) => `${v}%`} />
        <ReferenceLine
          y={OTP_BENCHMARK}
          stroke="#d96b00"
          strokeDasharray="5 5"
          strokeWidth={1.5}
          label={{
            value: `Benchmark ${OTP_BENCHMARK}%`,
            position: "right",
            fontSize: 10,
            fill: "#d96b00",
          }}
        />
        <Bar dataKey="on_time_percentage" name="On-Time %">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.on_time_percentage >= OTP_BENCHMARK
                  ? "#107c41"
                  : "#da292b"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
