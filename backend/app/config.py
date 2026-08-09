from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]  # repo root (swytchcode-buildathon/)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"
    jira_project_key: str = ""
    jira_site_domain: str = ""
    notion_kb_page_ids: str = ""
    support_from_email: str = ""
    github_repo: str = ""
    resend_from_email: str = ""
    cors_origins: str = "http://localhost:5173"


settings = Settings()
