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

function formatDelay(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(Math.round(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${s.toString().padStart(2, "0")}`;
}

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
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" fontSize={12} interval="preserveStartEnd" />
        <YAxis tickFormatter={(v: number) => `${Math.round(v / 60)}m`} />
        <Tooltip formatter={(v: number) => formatDelay(v)} />
        <Line type="monotone" dataKey="delay" stroke="#125be4" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
