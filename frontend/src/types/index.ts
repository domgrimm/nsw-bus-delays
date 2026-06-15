export interface BusStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface BusRoute {
  route_id: string;
  route_number: string;
  name: string;
  description: string;
  destination_name: string;
}

export interface Monitor {
  id: string;
  stop_id: string;
  stop_name: string;
  stop_latitude: number;
  stop_longitude: number;
  route_id: string;
  route_number: string;
  route_name: string;
  user_label: string | null;
  active: boolean;
  created_at: string;
}

export interface MonitorCreate {
  stop_id: string;
  stop_name?: string;
  stop_latitude?: number;
  stop_longitude?: number;
  route_id: string;
  route_number: string;
  user_label?: string;
}

export type Period = "day" | "week" | "month";

export interface DailyStats {
  date: string;
  total_arrivals: number;
  early_count: number;
  on_time_count: number;
  delayed_count: number;
  average_delay_seconds: number;
}

export interface DelayStats {
  period: Period;
  period_start: string;
  period_end: string;
  total_arrivals: number;
  early_count: number;
  on_time_count: number;
  delayed_count: number;
  cancelled_count: number;
  average_delay_seconds: number;
  max_delay_seconds: number;
  on_time_percentage: number;
  daily_breakdown: DailyStats[];
}

export interface ArrivalRecord {
  id: string;
  trip_id: string;
  scheduled_arrival: string;
  actual_arrival: string;
  delay_seconds: number;
  status: "early" | "on_time" | "delayed" | "cancelled";
  recorded_at: string;
}
