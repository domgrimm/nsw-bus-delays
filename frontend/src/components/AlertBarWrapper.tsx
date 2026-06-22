"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getMonitorAlerts } from "@/lib/api";
import ServiceAlertBar from "@/components/ServiceAlertBar";
import ServiceAlertModal from "@/components/ServiceAlertModal";

export default function AlertBarWrapper() {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);

  const match = pathname?.match(/^\/monitor\/([^/]+)/);
  const monitorId = match?.[1];

  const { data: alerts = [] } = useQuery({
    queryKey: ["monitor-alerts", monitorId],
    queryFn: () => getMonitorAlerts(monitorId!),
    enabled: !!monitorId,
    refetchInterval: 300_000,
  });

  if (alerts.length === 0) return null;

  return (
    <>
      <ServiceAlertBar alerts={alerts} onOpen={() => setShowModal(true)} />
      {showModal && (
        <ServiceAlertModal alerts={alerts} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
