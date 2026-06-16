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

export default function ArrivalDistributionChart({
  data,
}: {
  data: ArrivalBucket[];
}) {
  if (data.length === 0) return <p>No distribution data available.</p>;

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const chartData = data.map((d) => ({
    delay_minutes: d.delay_minutes,
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="delay_minutes"
          fontSize={11}
          label={{
            value: "Delay (minutes)",
            position: "insideBottom",
            offset: -5,
            fontSize: 11,
          }}
        />
        <YAxis fontSize={11} allowDecimals={false} />
        <Tooltip
          formatter={(v: number) => [`${v} arrivals`, "Count"]}
          labelFormatter={(l: number) => {
            if (l < 0) return `${Math.abs(l)} min early`;
            if (l === 0) return "On time";
            return `${l} min late`;
          }}
        />
        <ReferenceLine
          x={0}
          stroke="#107c41"
          strokeWidth={2}
          strokeDasharray="4 4"
          label={{ value: "On Time", position: "top", fontSize: 10, fill: "#107c41" }}
        />
        {chartData.map((entry) => (
          <Cell
            key={`cell-${entry.delay_minutes}`}
            fill={
              entry.delay_minutes < 0
                ? "#125be4"
                : entry.delay_minutes === 0
                  ? "#107c41"
                  : entry.delay_minutes <= 2
                    ? "#5abf5a"
                    : entry.delay_minutes <= 5
                      ? "#d96b00"
                      : "#da292b"
            }
          />
        ))}
        <Bar dataKey="count" fill="#125be4">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.delay_minutes < 0
                  ? "#125be4"
                  : entry.delay_minutes === 0
                    ? "#107c41"
                    : entry.delay_minutes <= 2
                      ? "#5abf5a"
                      : entry.delay_minutes <= 5
                        ? "#d96b00"
                        : "#da292b"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
