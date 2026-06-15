import type { DelayStats } from "@/types";

function formatDelay(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(Math.round(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${s.toString().padStart(2, "0")}`;
}

export default function SummaryCards({ stats }: { stats: DelayStats }) {
  const cards = [
    {
      label: "Average Delay",
      value: formatDelay(stats.average_delay_seconds),
      color: stats.average_delay_seconds > 120 ? "var(--color-status-danger)" : "var(--color-status-success)",
    },
    {
      label: "On-Time",
      value: `${stats.on_time_percentage.toFixed(1)}%`,
      color: stats.on_time_percentage >= 80 ? "var(--color-status-success)" : "var(--color-status-warning)",
    },
    {
      label: "Cancelled",
      value: stats.cancelled_count.toLocaleString(),
      color: stats.cancelled_count > 0 ? "var(--color-status-danger)" : "var(--color-status-muted)",
    },
    {
      label: "Total Arrivals",
      value: stats.total_arrivals.toLocaleString(),
      color: "var(--color-ink)",
    },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => (
        <div key={c.label} className="card" style={{ borderTop: `3px solid ${c.color}` }}>
          <p className="card-label">{c.label}</p>
          <p className="card-value" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
