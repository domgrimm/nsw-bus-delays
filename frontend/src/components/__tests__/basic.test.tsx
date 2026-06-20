import { render, screen } from "@testing-library/react";

import Skeleton from "../Skeleton";
import SummaryCards from "../SummaryCards";
import type { DelayStats } from "@/types";

describe("Skeleton", () => {
  it("renders requested number of lines", () => {
    const { container } = render(<Skeleton lines={4} />);
    const bars = container.firstChild?.childNodes;
    expect(bars?.length).toBe(4);
  });
});

const mockStats: DelayStats = {
  period: "day",
  period_start: "2026-06-15T00:00:00Z",
  period_end: "2026-06-15T23:59:59Z",
  total_arrivals: 100,
  early_count: 10,
  on_time_count: 70,
  delayed_count: 20,
  cancelled_count: 0,
  no_tracking_count: 0,
  average_delay_seconds: 45.5,
  max_delay_seconds: 300,
  on_time_percentage: 70,
  daily_breakdown: [],
  heatmap: [],
  percentile: null,
  arrival_distribution: [],
  weekday_heatmap: [],
  weekend_heatmap: [],
};

describe("SummaryCards", () => {
  it("renders all three cards", () => {
    render(<SummaryCards stats={mockStats} />);
    expect(screen.getByText("Average Delay")).toBeInTheDocument();
    expect(screen.getByText("On-Time")).toBeInTheDocument();
    expect(screen.getByText("Total Arrivals")).toBeInTheDocument();
  });

  it("displays computed values", () => {
    render(<SummaryCards stats={mockStats} />);
    expect(screen.getByText("0:46")).toBeInTheDocument();
    expect(screen.getByText("70.0%")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });
});
