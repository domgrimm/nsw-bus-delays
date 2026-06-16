"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import type { BunchingEvent } from "@/types";

export default function BunchingTimeline({
  data,
}: {
  data: BunchingEvent[];
}) {
  if (data.length === 0) {
    return <p className="muted">No bunching events detected in this period.</p>;
  }

  const chartData = data.map((e) => ({
    time: new Date(e.scheduled_time).getTime(),
    label: new Date(e.scheduled_time).toLocaleString(),
    actual_gap: e.actual_headway_minutes,
    scheduled_gap: e.scheduled_headway_minutes,
    delay: e.delay_minutes,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="time"
            name="Time"
            tickFormatter={(t: number) =>
              new Date(t).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            type="number"
            domain={["dataMin", "dataMax"]}
            fontSize={11}
            stroke="var(--color-status-muted)"
          />
          <YAxis
            dataKey="actual_gap"
            name="Actual Gap (min)"
            unit=" min"
            fontSize={11}
            label={{
              value: "Actual Gap (min)",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
            }}
            stroke="var(--color-status-muted)"
          />
          <ZAxis dataKey="scheduled_gap" range={[40, 200]} />
          <Tooltip
            formatter={(v: number, name: string) => {
              if (name === "time") return new Date(v).toLocaleString();
              return [`${v} min`, name];
            }}
            labelFormatter={() => ""}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--rounded-sm)",
              color: "var(--color-ink)",
              fontSize: "0.85rem",
            }}
          />
          <Scatter
            data={chartData}
            fill="var(--color-status-danger)"
            name="Bunching Events"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="var(--color-status-danger)" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div style={{ marginTop: "0.75rem" }}>
        <table className="compact-table">
          <thead>
            <tr>
              <th>Time</th>
              <th className="numeric">Sched Gap</th>
              <th className="numeric">Actual Gap</th>
              <th className="numeric">Delay</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((e, i) => (
              <tr key={i}>
                <td>
                  {new Date(e.scheduled_time).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="numeric">{e.scheduled_headway_minutes.toFixed(1)}m</td>
                <td className="numeric danger-text">
                  {e.actual_headway_minutes.toFixed(1)}m
                </td>
                <td
                  className={`numeric ${e.delay_minutes > 2 ? "danger-text" : ""}`}
                >
                  {e.delay_minutes > 0 ? "+" : ""}
                  {e.delay_minutes.toFixed(1)}m
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
