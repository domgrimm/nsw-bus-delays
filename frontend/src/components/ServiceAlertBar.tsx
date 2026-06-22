"use client";

import type { ServiceAlert } from "@/types";

interface Props {
  alerts: ServiceAlert[];
  onOpen: () => void;
}

export default function ServiceAlertBar({ alerts, onOpen }: Props) {
  if (alerts.length === 0) return null;

  const priorities = alerts
    .map((a) => a.priority)
    .filter(Boolean);
  const uniquePriorities = [...new Set(priorities)];

  return (
    <button
      className="alert-bar"
      onClick={onOpen}
      aria-label={`${alerts.length} service alert${alerts.length > 1 ? "s" : ""}`}
    >
      <span className="alert-bar__inner">
        <span className="alert-bar__icon" aria-hidden="true">
          &#9888;
        </span>
        <span className="alert-bar__text">
          {alerts.length} active service alert{alerts.length > 1 ? "s" : ""}
        </span>
        {uniquePriorities.length > 0 && (
          <span className="alert-bar__prio">
            {uniquePriorities.join(", ")}
          </span>
        )}
        <span className="alert-bar__hint">tap to view details</span>
      </span>
    </button>
  );
}
