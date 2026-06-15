"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { DailyStats } from "@/types";

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
        <Bar dataKey="on_time_percentage" name="On-Time %" fill="#107c41" />
      </BarChart>
    </ResponsiveContainer>
  );
}
