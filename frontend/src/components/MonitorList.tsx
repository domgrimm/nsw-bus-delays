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
      <div className="empty-state">
        <p className="empty-state__text">
          No monitors yet. Add one to start tracking bus delays.
        </p>
        <Link href="/monitor/new">
          <button>+ Add Monitor</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="monitor-list">
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
    <div className="card interactive-card monitor-card">
      <Link href={`/monitor/${monitor.id}`} className="monitor-card__body">
        <div className="monitor-card__top">
          <span className="monitor-card__route-badge">{monitor.route_number}</span>
          <span
            className={`monitor-card__status ${monitor.active ? "monitor-card__status--active" : "monitor-card__status--inactive"}`}
          >
            {monitor.active ? "Active" : "Inactive"}
          </span>
        </div>
        <h3 className="monitor-card__title">
          {monitor.stop_name || monitor.stop_id}
        </h3>
      </Link>

      <div className="monitor-card__actions">
        {showConfirm ? (
          <div className="monitor-card__confirm">
            <span className="monitor-card__confirm-text">Are you sure?</span>
            <button
              className="danger monitor-card__btn-sm"
              onClick={onDelete}
            >
              Yes
            </button>
            <button
              className="outline monitor-card__btn-sm"
              onClick={() => setShowConfirm(false)}
            >
              No
            </button>
          </div>
        ) : (
          <button
            className="danger monitor-card__btn-md"
            onClick={() => setShowConfirm(true)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
