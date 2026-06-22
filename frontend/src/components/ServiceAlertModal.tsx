"use client";

import { useState } from "react";
import type { ServiceAlert } from "@/types";

interface Props {
  alerts: ServiceAlert[];
  onClose: () => void;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<div[^>]*>\s*(?:&nbsp;|\s)*\s*<\/div>/gi, "")
    .replace(/<p[^>]*>\s*(?:&nbsp;|\s)*\s*<\/p>/gi, "");
}

function formatTime(raw: string): string {
  if (!raw) return "";
  try {
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return raw;
    return dt.toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
}

function AlertBody({ description }: { description: string }) {
  const sanitized = sanitizeHtml(description);
  return (
    <div
      className="alert-body"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

function AlertTimes({ alert }: { alert: ServiceAlert }) {
  if (!alert.posted_at && !alert.updated_at && !alert.url) return null;
  return (
    <div className="alert-times">
      {alert.posted_at && (
        <span className="alert-times__item">
          Posted: {formatTime(alert.posted_at)}
        </span>
      )}
      {alert.updated_at && alert.updated_at !== alert.posted_at && (
        <span className="alert-times__item">
          Updated: {formatTime(alert.updated_at)}
        </span>
      )}
      {alert.url && (
        <a
          className="alert-times__link"
          href={alert.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View full alert details &rarr;
        </a>
      )}
    </div>
  );
}

function AlertMeta({ alert }: { alert: ServiceAlert }) {
  return (
    <div className="alert-meta">
      {alert.priority && (
        <span className="alert-meta__badge">
          Priority: {alert.priority}
        </span>
      )}
      {alert.alert_type && (
        <span className="alert-meta__badge alert-meta__badge--type">
          {alert.alert_type}
        </span>
      )}
    </div>
  );
}

function AccordionSection({
  alert,
  defaultOpen = false,
}: {
  alert: ServiceAlert;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const headerLabel = alert.title || alert.alert_type || "Service Alert";

  return (
    <div className={`accordion ${open ? "accordion--open" : ""}`}>
      <button
        className="accordion__trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="accordion__header">
          <span className="accordion__title">{headerLabel}</span>
          {alert.priority && (
            <span className="accordion__badge">{alert.priority}</span>
          )}
        </div>
        <span className="accordion__chevron" aria-hidden="true">
          {open ? "\u25B4" : "\u25BE"}
        </span>
      </button>
      <div className="accordion__panel" hidden={!open}>
        {alert.title && alert.alert_type && alert.title !== alert.alert_type && (
          <span className="alert-single__type">{alert.alert_type}</span>
        )}
        <AlertBody description={alert.description} />
        <AlertTimes alert={alert} />
        <AlertMeta alert={alert} />
      </div>
    </div>
  );
}

export default function ServiceAlertModal({ alerts, onClose }: Props) {
  const manyAlerts = alerts.length >= 2;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            &#9888; {alerts.length} Service Alert{alerts.length > 1 ? "s" : ""}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {manyAlerts ? (
            <div className="accordion-list">
              {alerts.map((alert) => (
                <AccordionSection key={alert.id} alert={alert} />
              ))}
            </div>
          ) : (
            alerts[0] && (
              <div className="alert-single">
                {alerts[0].title && (
                  <h3 className="alert-single__title">{alerts[0].title}</h3>
                )}
                {alerts[0].alert_type && (
                  <span className="alert-single__type">
                    {alerts[0].alert_type}
                  </span>
                )}
                <AlertBody description={alerts[0].description} />
                <AlertTimes alert={alerts[0]} />
                <AlertMeta alert={alerts[0]} />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
