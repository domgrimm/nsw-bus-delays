import type { DelayStats } from "@/types";
import { formatDelay } from "@/lib/format";

type StatusVariant = "danger" | "warning" | "success" | "muted" | "ink";

function variantForDelay(seconds: number): StatusVariant {
  if (seconds > 120) return "danger";
  if (seconds > 0) return "warning";
  return "success";
}

export default function SummaryCards({ stats }: { stats: DelayStats }) {
  const cards: { label: string; value: string; variant: StatusVariant }[] = [
    {
      label: "Average Delay",
      value: formatDelay(stats.average_delay_seconds),
      variant: variantForDelay(stats.average_delay_seconds),
    },
    {
      label: "On-Time",
      value: `${stats.on_time_percentage.toFixed(1)}%`,
      variant:
        stats.on_time_percentage >= 80
          ? "success"
          : stats.on_time_percentage >= 60
            ? "warning"
            : "danger",
    },
    {
      label: "Cancelled",
      value: stats.cancelled_count.toLocaleString(),
      variant: stats.cancelled_count > 0 ? "danger" : "muted",
    },
    {
      label: "Total Arrivals",
      value: stats.total_arrivals.toLocaleString(),
      variant: "ink",
    },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => (
        <div key={c.label} className="card">
          <p className="card-label">{c.label}</p>
          <p className={`card-value status-${c.variant}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
