import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base

import enum


class ArrivalStatus(str, enum.Enum):
    early = "early"
    on_time = "on_time"
    delayed = "delayed"
    cancelled = "cancelled"


class BusStop(Base):
    __tablename__ = "bus_stops"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stop_id = Column(String(64), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    monitored_trips = relationship("MonitoredTrip", back_populates="stop")


class BusRoute(Base):
    __tablename__ = "bus_routes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id = Column(String(64), unique=True, nullable=False)
    route_number = Column(String(16), nullable=False)
    name = Column(String(255), nullable=False)

    monitored_trips = relationship("MonitoredTrip", back_populates="route")


class MonitoredTrip(Base):
    __tablename__ = "monitored_trips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stop_id = Column(UUID(as_uuid=True), ForeignKey("bus_stops.id"), nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("bus_routes.id"), nullable=False)
    user_label = Column(String(255))
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False)

    stop = relationship("BusStop", back_populates="monitored_trips")
    route = relationship("BusRoute", back_populates="monitored_trips")
    arrival_records = relationship(
        "ArrivalRecord", back_populates="monitored_trip", cascade="all, delete-orphan"
    )


class ArrivalRecord(Base):
    __tablename__ = "arrival_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitored_trip_id = Column(
        UUID(as_uuid=True), ForeignKey("monitored_trips.id"), nullable=False
    )
    trip_id = Column(String(128), nullable=False)
    scheduled_arrival = Column(DateTime(timezone=True), nullable=False)
    actual_arrival = Column(DateTime(timezone=True), nullable=False)
    delay_seconds = Column(Integer, nullable=False)
    status = Column(Enum(ArrivalStatus), nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False)

    monitored_trip = relationship("MonitoredTrip", back_populates="arrival_records")
