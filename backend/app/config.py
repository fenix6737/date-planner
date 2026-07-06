from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://") and "+psycopg2" not in url:
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./dateplanner.db"
    hotpepper_api_key: str = ""
    yahoo_app_id: str = ""
    osrm_base_url: str = "http://localhost:5000"
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    mock_mode: bool = True
    cors_origins: str = "http://localhost:3000"

    @property
    def database_url_normalized(self) -> str:
        return normalize_database_url(self.database_url)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
