from fastapi import FastAPI

from app.routers import monitors, stops

app = FastAPI(title="NSW Bus Delays API", version="0.1.0")

app.include_router(stops.router, prefix="/api")
app.include_router(monitors.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
