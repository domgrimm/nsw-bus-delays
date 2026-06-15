from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    tfnsw_api_key: str
    database_url: str
    polling_interval_seconds: int = 60
    on_time_threshold_seconds: int = 120
    max_consecutive_failures: int = 5


settings = Settings()
