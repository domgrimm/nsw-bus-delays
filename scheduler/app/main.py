import asyncio
import logging

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.database import SessionLocal
from app.models import MonitoredTrip
from app.poller import poll_active_monitors

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def refresh_gtfs():
    logger.info("Refreshing GTFS data...")
    backend_url = "http://backend:8000/api/gtfs/refresh"
    try:
        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.post(backend_url)
            if resp.status_code == 200:
                logger.info("GTFS refresh complete")
            else:
                logger.warning("GTFS refresh returned %s", resp.status_code)
    except Exception as e:
        logger.warning("GTFS refresh failed: %s", e)


async def main():
    db = SessionLocal()
    try:
        active_count = (
            db.query(MonitoredTrip).filter(MonitoredTrip.active == True).count()
        )
        logger.info("Starting scheduler with %d active monitor(s)", active_count)
    finally:
        db.close()

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        poll_active_monitors,
        "interval",
        seconds=settings.polling_interval_seconds,
        id="poll_tfnsw",
        replace_existing=True,
    )
    scheduler.add_job(
        refresh_gtfs,
        CronTrigger.from_crontab("0 3 * * *"),
        id="refresh_gtfs",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Polling every %d seconds (threshold=%ds, max_failures=%d)",
        settings.polling_interval_seconds,
        settings.on_time_threshold_seconds,
        settings.max_consecutive_failures,
    )
    logger.info("GTFS refresh scheduled for 3:00 AM daily")

    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        scheduler.shutdown()
        logger.info("Scheduler stopped")


if __name__ == "__main__":
    asyncio.run(main())
