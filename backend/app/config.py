from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Writing Revision Collection API"

    ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    FRONTEND_ORIGINS: list[str] = ["http://localhost:8000", "https://localhost:8000", "null", "file://"]

    DATA_DIR: Path = Path(__file__).resolve().parent.parent / "data"
    DATABASE_URL: str = f"sqlite:///{(DATA_DIR / 'rev_app.db').as_posix()}"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.ENV == "production":
            self.DEBUG = False

settings = Settings()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
