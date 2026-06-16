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
    return <p>No bunching events detected in this period.</p>;
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
          <CartesianGrid strokeDasharray="3 3" />
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
          />
          <ZAxis dataKey="scheduled_gap" range={[40, 200]} />
          <Tooltip
            formatter={(v: number, name: string) => {
              if (name === "time") return new Date(v).toLocaleString();
              return [`${v} min`, name];
            }}
            labelFormatter={() => ""}
          />
          <Scatter
            data={chartData}
            fill="#da292b"
            name="Bunching Events"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#da292b" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div style={{ marginTop: "0.75rem" }}>
        <table
          style={{
            width: "100%",
            fontSize: "0.8rem",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border)" }}>
                Time
              </th>
              <th style={{ textAlign: "right", padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border)" }}>
                Sched Gap
              </th>
              <th style={{ textAlign: "right", padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border)" }}>
                Actual Gap
              </th>
              <th style={{ textAlign: "right", padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border)" }}>
                Delay
              </th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((e, i) => (
              <tr key={i}>
                <td style={{ padding: "0.35rem 0.5rem" }}>
                  {new Date(e.scheduled_time).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td style={{ textAlign: "right", padding: "0.35rem 0.5rem" }}>
                  {e.scheduled_headway_minutes.toFixed(1)}m
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "0.35rem 0.5rem",
                    color: "var(--color-status-danger)",
                    fontWeight: 600,
                  }}
                >
                  {e.actual_headway_minutes.toFixed(1)}m
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "0.35rem 0.5rem",
                    color:
                      e.delay_minutes > 2
                        ? "var(--color-status-danger)"
                        : "var(--color-ink)",
                  }}
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
