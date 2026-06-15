"""Seed script to pre-populate common bus stops and routes.

Usage:
    python -m app.seed

This script is optional — monitors are created on-demand via the API.
"""
import logging

from app.database import SessionLocal, engine
from app.database import Base
from app.models import BusRoute, BusStop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COMMON_STOPS: list[dict] = [
    {"stop_id": "200013", "name": "Town Hall Station, Park St, Stand H", "latitude": -33.8731, "longitude": 151.2063},
    {"stop_id": "200014", "name": "Wynyard Station, Clarence St, Stand R", "latitude": -33.8655, "longitude": 151.2056},
    {"stop_id": "200015", "name": "Central Station, Chalmers St, Stand F", "latitude": -33.8827, "longitude": 151.2065},
    {"stop_id": "200016", "name": "Circular Quay, Alfred St, Stand B", "latitude": -33.8614, "longitude": 151.2106},
    {"stop_id": "200017", "name": "Parramatta Station, Stand A1", "latitude": -33.8175, "longitude": 151.0033},
    {"stop_id": "200018", "name": "Chatswood Station, Stand A", "latitude": -33.7971, "longitude": 151.1901},
    {"stop_id": "200019", "name": "Bondi Junction Station, Stand A", "latitude": -33.8926, "longitude": 151.2473},
    {"stop_id": "200020", "name": "Strathfield Station, Stand A", "latitude": -33.8715, "longitude": 151.0917},
]

COMMON_ROUTES: list[dict] = [
    {"route_id": "370", "route_number": "370", "name": "Coogee to Glebe Point"},
    {"route_id": "333", "route_number": "333", "name": "Circular Quay to North Bondi"},
    {"route_id": "438X", "route_number": "438X", "name": "Martin Place to Great North Walk"},
    {"route_id": "610X", "route_number": "610X", "name": "Castle Hill to City"},
    {"route_id": "M20", "route_number": "M20", "name": "Wynyard to Zetland"},
    {"route_id": "B1", "route_number": "B1", "name": "Mona Vale to City"},
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for stop_data in COMMON_STOPS:
            existing = db.query(BusStop).filter(BusStop.stop_id == stop_data["stop_id"]).first()
            if not existing:
                db.add(BusStop(**stop_data))
                logger.info("Added stop: %s", stop_data["name"])

        for route_data in COMMON_ROUTES:
            existing = db.query(BusRoute).filter(BusRoute.route_id == route_data["route_id"]).first()
            if not existing:
                db.add(BusRoute(**route_data))
                logger.info("Added route: %s", route_data["name"])

        db.commit()
        logger.info("Seeding complete")
    except Exception as e:
        db.rollback()
        logger.error("Seeding failed: %s", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
