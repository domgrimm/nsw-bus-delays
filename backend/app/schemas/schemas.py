from datetime import datetime

from pydantic import BaseModel


class MonitorCreate(BaseModel):
    stop_id: str
    route_id: str
    route_number: str
    stop_name: str | None = None
    stop_latitude: float | None = None
    stop_longitude: float | None = None
    user_label: str | None = None


class MonitorResponse(BaseModel):
    id: str
    stop_id: str
    stop_name: str
    stop_latitude: float = 0
    stop_longitude: float = 0
    route_id: str
    route_number: str
    route_name: str
    user_label: str | None
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DailyStats(BaseModel):
    date: str
    total_arrivals: int
    early_count: int
    on_time_count: int
    delayed_count: int
    average_delay_seconds: float


class DelayStats(BaseModel):
    period: str
    period_start: datetime
    period_end: datetime
    total_arrivals: int
    early_count: int
    on_time_count: int
    delayed_count: int
    cancelled_count: int
    average_delay_seconds: float
    max_delay_seconds: int
    on_time_percentage: float
    daily_breakdown: list[DailyStats]


class StopResponse(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float


class ArrivalRecordResponse(BaseModel):
    id: str
    trip_id: str
    scheduled_arrival: datetime
    actual_arrival: datetime
    delay_seconds: int
    status: str
    recorded_at: datetime

    class Config:
        from_attributes = True
