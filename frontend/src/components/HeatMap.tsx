"use client";

import { useState, useCallback } from "react";
import type { HeatmapCell } from "@/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const WEEKEND_LABELS = ["Sat", "Sun"];
const HOUR_LABELS = [
  "00:00",
  "03:00",
  "06:00",
  "09:00",
  "12:00",
  "15:00",
  "18:00",
  "21:00",
];

function delayColor(delay: number): string {
  if (delay < -60) return "#125be4";
  if (delay < 0) return "#6ba3f0";
  if (delay === 0) return "#107c41";
  if (delay <= 60) return "#5abf5a";
  if (delay <= 120) return "#b8d94b";
  if (delay <= 180) return "#f2e03d";
  if (delay <= 300) return "#f5a623";
  if (delay <= 600) return "#e06b2b";
  if (delay <= 900) return "#c0392b";
  return "#1a1a1a";
}

function formatDelay(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(Math.round(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${s.toString().padStart(2, "0")}`;
}

const CELL_SIZE = 48;
const CELL_GAP = 4;
const LABEL_WIDTH = 48;
const HEADER_HEIGHT = 28;
const PADDING = 12;

function getSvgDims(rows: number) {
  return {
    width: LABEL_WIDTH + 8 * (CELL_SIZE + CELL_GAP) + PADDING * 2,
    height: HEADER_HEIGHT + rows * (CELL_SIZE + CELL_GAP) + PADDING * 2,
  };
}

function HeatMapGrid({
  data,
  dayLabels,
  rowOffset,
}: {
  data: HeatmapCell[];
  dayLabels: string[];
  rowOffset: number;
}) {
  const [selected, setSelected] = useState<HeatmapCell | null>(null);

  const lookup = new Map<string, HeatmapCell>();
  for (const cell of data) {
    lookup.set(`${cell.day_of_week}-${cell.hour_block}`, cell);
  }

  const handleTap = useCallback(
    (cell: HeatmapCell) => {
      setSelected((prev) => (prev === cell ? null : cell));
    },
    [],
  );

  const dims = getSvgDims(dayLabels.length);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <svg
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          style={{ display: "block", width: "100%", minWidth: dims.width, height: "auto" }}
        >
          {HOUR_LABELS.map((label, i) => (
            <text
              key={`hdr-${i}`}
              x={LABEL_WIDTH + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + PADDING}
              y={PADDING + HEADER_HEIGHT - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#8a9099"
              fontWeight={600}
            >
              {label}
            </text>
          ))}

          {dayLabels.map((label: string, row: number) => (
            <g key={`row-${row}`}>
              <text
                x={PADDING}
                y={PADDING + HEADER_HEIGHT + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + 4}
                textAnchor="end"
                fontSize={11}
                fill="#191c1f"
                fontWeight={600}
              >
                {label}
              </text>
              {Array.from({ length: 8 }, (_, col) => {
                const key = `${row + rowOffset}-${col}`;
                const cell = lookup.get(key);
                const delay = cell ? cell.average_delay_seconds : 0;
                const hasData = !!cell;
                const isSelected = selected === cell;
                const x = LABEL_WIDTH + col * (CELL_SIZE + CELL_GAP) + PADDING;
                const y = PADDING + HEADER_HEIGHT + row * (CELL_SIZE + CELL_GAP);

                return (
                  <g key={`cell-${row}-${col}`}>
                    <rect
                      x={x}
                      y={y}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      rx={3}
                      fill={hasData ? delayColor(delay) : "#e8e9eb"}
                      stroke={isSelected ? "#191c1f" : "none"}
                      strokeWidth={isSelected ? 2.5 : 0}
                      style={{ cursor: hasData ? "pointer" : "default" }}
                      onClick={() => hasData && cell && handleTap(cell)}
                      role="button"
                      tabIndex={hasData ? 0 : -1}
                      aria-label={
                        hasData && cell
                          ? `${label} ${HOUR_LABELS[col]}–${HOUR_LABELS[col + 1] || "00:00"}, avg delay ${formatDelay(delay)}, ${cell.count} arrivals`
                          : `No data`
                      }
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && hasData && cell) handleTap(cell);
                      }}
                    />
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {selected && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "0.5rem",
            background: "#191c1f",
            color: "#fff",
            padding: "0.6rem 1rem",
            borderRadius: 6,
            fontSize: "0.85rem",
            lineHeight: 1.5,
            whiteSpace: "nowrap",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.15rem" }}>
            {DAY_LABELS[selected.day_of_week]},{" "}
            {HOUR_LABELS[selected.hour_block]}–{HOUR_LABELS[selected.hour_block + 1] || "00:00"}
          </div>
          <div>Avg delay: {formatDelay(selected.average_delay_seconds)}</div>
          <div>Arrivals: {selected.count}</div>
        </div>
      )}
    </div>
  );
}

export default function HeatMap({
  data,
  weekdayData,
  weekendData,
}: {
  data: HeatmapCell[];
  weekdayData?: HeatmapCell[];
  weekendData?: HeatmapCell[];
}) {
  const hasSplit = weekdayData && weekdayData.length > 0 && weekendData && weekendData.length > 0;
  const [view, setView] = useState<"all" | "weekday" | "weekend">("all");

  return (
    <div>
      {hasSplit && (
        <div className="segmented-control" style={{ marginBottom: "0.75rem" }}>
          {(["all", "weekday", "weekend"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              disabled={v === view}
              className={v === view ? "active" : ""}
            >
              {v === "all" ? "All Days" : v === "weekday" ? "Weekdays" : "Weekends"}
            </button>
          ))}
        </div>
      )}

      {view === "all" && <HeatMapGrid data={data} dayLabels={DAY_LABELS} rowOffset={0} />}
      {view === "weekday" && hasSplit && (
        <HeatMapGrid data={weekdayData!} dayLabels={WEEKDAY_LABELS} rowOffset={0} />
      )}
      {view === "weekend" && hasSplit && (
        <HeatMapGrid data={weekendData!} dayLabels={WEEKEND_LABELS} rowOffset={5} />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          marginTop: "0.75rem",
          fontSize: "0.7rem",
          color: "#8a9099",
          flexWrap: "wrap",
        }}
      >
        <span style={{ marginRight: "0.25rem" }}>Early</span>
        {["#125be4", "#6ba3f0", "#107c41", "#5abf5a", "#b8d94b", "#f5a623", "#e06b2b", "#c0392b", "#1a1a1a"].map(
          (c) => (
            <span
              key={c}
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                borderRadius: 2,
                background: c,
              }}
            />
          )
        )}
        <span style={{ marginLeft: "0.25rem" }}>Late</span>
      </div>
    </div>
  );
}
