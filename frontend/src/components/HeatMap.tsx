"use client";

import { useState, useCallback, useRef, useLayoutEffect } from "react";
import type { HeatmapCell } from "@/types";
import { formatDelay } from "@/lib/format";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

const LEGEND_STOPS = [
  "var(--color-delay-early-strong)",
  "var(--color-delay-early-light)",
  "var(--color-delay-ontime)",
  "var(--color-delay-slight)",
  "var(--color-delay-mild)",
  "var(--color-delay-moderate)",
  "var(--color-delay-high)",
  "var(--color-delay-severe)",
  "var(--color-delay-extreme)",
];

function delayColor(delay: number): string {
  if (delay < -60) return "var(--color-delay-early-strong)";
  if (delay < 0) return "var(--color-delay-early-light)";
  if (delay === 0) return "var(--color-delay-ontime)";
  if (delay <= 60) return "var(--color-delay-slight)";
  if (delay <= 120) return "var(--color-delay-mild)";
  if (delay <= 180) return "var(--color-delay-moderate)";
  if (delay <= 300) return "var(--color-delay-high)";
  if (delay <= 600) return "var(--color-delay-severe)";
  return "var(--color-delay-extreme)";
}

const CELL_SIZE = 32;
const CELL_GAP = 3;
const LEFT_PAD = 56;
const PADDING = 8;
const HEADER_HEIGHT = 24;

const GRID_LEFT = LEFT_PAD;
const GRID_TOP = HEADER_HEIGHT + PADDING;

function getSvgDims(rows: number) {
  return {
    width: LEFT_PAD + 8 * (CELL_SIZE + CELL_GAP) + PADDING,
    height: GRID_TOP + rows * (CELL_SIZE + CELL_GAP) + PADDING,
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
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!hovered || !tooltipRef.current) return;
    const el = tooltipRef.current;
    el.style.left = `${mousePos.x + 12}px`;
    el.style.top = `${mousePos.y - 10}px`;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      el.style.left = `${mousePos.x - rect.width - 12}px`;
    }
    if (rect.bottom > window.innerHeight - 8) {
      el.style.top = `${mousePos.y - rect.height - 10}px`;
    }
    if (parseInt(el.style.left) < 8) el.style.left = "8px";
    if (parseInt(el.style.top) < 8) el.style.top = "8px";
  }, [hovered, mousePos]);

  const lookup = new Map<string, HeatmapCell>();
  for (const cell of data) {
    lookup.set(`${cell.day_of_week}-${cell.hour_block}`, cell);
  }

  const handleMouseEnter = useCallback(
    (cell: HeatmapCell, e: React.MouseEvent) => {
      setHovered(cell);
      setMousePos({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleMouseMove = useCallback(
    (_cell: HeatmapCell, e: React.MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
  }, []);

  const dims = getSvgDims(dayLabels.length);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <svg
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          style={{ display: "block", width: "100%", height: "auto" }}
          role="grid"
          aria-label="Delay heat map"
        >
          {HOUR_LABELS.map((label, i) => (
            <text
              key={`hdr-${i}`}
              x={GRID_LEFT + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2}
              y={GRID_TOP - 6}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-status-muted)"
              fontWeight={600}
            >
              {label}
            </text>
          ))}

          {dayLabels.map((label: string, row: number) => (
            <g key={`row-${row}`}>
              <text
                x={LEFT_PAD - 4}
                y={GRID_TOP + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + 1}
                textAnchor="end"
                fontSize={11}
                fill="var(--color-ink)"
                fontWeight={600}
              >
                {label}
              </text>
              {Array.from({ length: 8 }, (_, col) => {
                const key = `${row + rowOffset}-${col}`;
                const cell = lookup.get(key);
                const delay = cell ? cell.average_delay_seconds : 0;
                const hasData = !!cell;
                const isHovered = hovered === cell;
                const x = GRID_LEFT + col * (CELL_SIZE + CELL_GAP);
                const y = GRID_TOP + row * (CELL_SIZE + CELL_GAP);

                return (
                  <g key={`cell-${row}-${col}`}>
                    <rect
                      x={x}
                      y={y}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      rx={4}
                      fill={hasData ? delayColor(delay) : "var(--color-border)"}
                      stroke={isHovered ? "var(--color-ink)" : "none"}
                      strokeWidth={isHovered ? 2.5 : 0}
                      style={{ cursor: hasData ? "pointer" : "default" }}
                      onMouseEnter={(e) => hasData && cell && handleMouseEnter(cell, e)}
                      onMouseMove={(e) => hasData && cell && handleMouseMove(cell, e)}
                      onMouseLeave={handleMouseLeave}
                      role="gridcell"
                      tabIndex={hasData ? 0 : -1}
                      aria-label={
                        hasData && cell
                          ? `${label} ${HOUR_LABELS[col]}–${HOUR_LABELS[col + 1] || "00:00"}, avg delay ${formatDelay(delay)}, ${cell.count} arrivals`
                          : `No data`
                      }
                    />
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {hovered && (
        <div ref={tooltipRef} className="heatmap-tooltip" style={{ position: "fixed", left: mousePos.x + 12, top: mousePos.y - 10 }}>
          <div className="heatmap-tooltip__title">
            {dayLabels[hovered.day_of_week] || DAY_LABELS[hovered.day_of_week]},{" "}
            {HOUR_LABELS[hovered.hour_block]}–{HOUR_LABELS[hovered.hour_block + 1] || "00:00"}
          </div>
          <div>Avg delay: {formatDelay(hovered.average_delay_seconds)}</div>
          <div>Arrivals: {hovered.count}</div>
        </div>
      )}
    </div>
  );
}

function aggregateByGroup(
  weekdayData: HeatmapCell[],
  weekendData: HeatmapCell[],
): HeatmapCell[] {
  function groupAverage(cells: HeatmapCell[], groupDow: number): HeatmapCell[] {
    const byHour = new Map<number, { sumDelay: number; totalCount: number }>();
    for (const c of cells) {
      const prev = byHour.get(c.hour_block) || { sumDelay: 0, totalCount: 0 };
      prev.sumDelay += c.average_delay_seconds * c.count;
      prev.totalCount += c.count;
      byHour.set(c.hour_block, prev);
    }
    return Array.from(byHour.entries()).map(([hb, acc]) => ({
      day_of_week: groupDow,
      hour_block: hb,
      average_delay_seconds: acc.totalCount > 0 ? acc.sumDelay / acc.totalCount : 0,
      count: acc.totalCount,
    }));
  }
  return [
    ...groupAverage(weekdayData, 0),
    ...groupAverage(weekendData, 1),
  ];
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
  const [view, setView] = useState<"all" | "grouped">("all");

  return (
    <div>
      <div className="segmented-control" style={{ marginBottom: "0.75rem" }}>
        <button
          onClick={() => setView("all")}
          disabled={view === "all"}
          className={view === "all" ? "active" : ""}
        >
          All Days
        </button>
        <button
          onClick={() => setView("grouped")}
          disabled={view === "grouped" || !hasSplit}
          className={view === "grouped" ? "active" : ""}
        >
          Weekdays &amp; Weekends
        </button>
      </div>

      {view === "all" && <HeatMapGrid data={data} dayLabels={DAY_LABELS} rowOffset={0} />}
      {view === "grouped" && hasSplit && (
        <HeatMapGrid
          data={aggregateByGroup(weekdayData!, weekendData!)}
          dayLabels={["Weekdays", "Weekends"]}
          rowOffset={0}
        />
      )}

      <div className="heatmap-legend">
        <span className="heatmap-legend__end">Early</span>
        {LEGEND_STOPS.map((c) => (
          <span
            key={c}
            className="heatmap-legend__swatch"
            style={{ background: c }}
          />
        ))}
        <span className="heatmap-legend__end">Late</span>
      </div>
    </div>
  );
}
