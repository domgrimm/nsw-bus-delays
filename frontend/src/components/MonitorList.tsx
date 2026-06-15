"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { deleteMonitor, getMonitors } from "@/lib/api";
import type { Monitor } from "@/types";
import { useToast } from "@/context/toast";
import Skeleton from "./Skeleton";

export default function MonitorList() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const {
    data: monitors = [],
    isLoading,
    isError,
    error,
  } = useQuery<Monitor[]>({
    queryKey: ["monitors"],
    queryFn: getMonitors,
    refetchInterval: 30_000,
  });

  const del = useMutation({
    mutationFn: deleteMonitor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      addToast("Monitor deleted", "success");
    },
    onError: (err: Error) => {
      addToast(`Failed to delete: ${err.message}`, "error");
    },
  });

  if (isLoading) return <Skeleton lines={3} />;
  if (isError) return <p className="error">Failed to load monitors: {error.message}</p>;

  if (monitors.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <p style={{ color: "var(--color-status-muted)", marginBottom: "1rem" }}>
          No monitors yet. Add one to start tracking bus delays.
        </p>
        <Link href="/monitor/new">
          <button>+ Add Monitor</button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {monitors.map((m) => (
        <MonitorCard key={m.id} monitor={m} onDelete={() => del.mutate(m.id)} />
      ))}
    </div>
  );
}

function MonitorCard({
  monitor,
  onDelete,
}: {
  monitor: Monitor;
  onDelete: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="card interactive-card">
      <Link href={`/monitor/${monitor.id}`} style={{ flex: 1, display: "block", textDecoration: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <h3 style={{ color: "var(--color-ink)", fontSize: "1.1rem", margin: 0 }}>
            {monitor.stop_name || monitor.stop_id}
          </h3>
          <p style={{ color: "var(--color-status-muted)", fontSize: "0.85rem", margin: 0 }}>
            Route {monitor.route_number} &middot;{" "}
            <span
              style={{
                color: monitor.active ? "var(--color-status-success)" : "var(--color-status-muted)",
                fontWeight: 600,
              }}
            >
              {monitor.active ? "Active" : "Inactive"}
            </span>
          </p>
        </div>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {showConfirm ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--color-status-danger)", fontWeight: 600, marginRight: "4px" }}>
              Are you sure?
            </span>
            <button className="danger" onClick={onDelete} style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>
              Yes
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              style={{
                background: "transparent",
                color: "var(--color-ink)",
                border: "1px solid var(--color-border)",
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
              }}
            >
              No
            </button>
          </div>
        ) : (
          <button className="danger" onClick={() => setShowConfirm(true)} style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
